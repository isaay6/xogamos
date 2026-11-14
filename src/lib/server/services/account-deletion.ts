// SPDX-License-Identifier: EUPL-1.2
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	entityMembers,
	municipalityProfiles,
	notifications,
	outboxEmails,
	passes,
	requests,
	sessions,
	staffRoles,
	tournamentEntries,
	tournaments,
	users
} from '../db/schema';
import { waitlistEntries } from '../db/schema';
import { cancelBookingTx } from './bookings';
import { err, ok, type Result } from './result';
import { walletBalance } from './wallet';

export type AccountDeletionError = 'STAFF_MEMBER' | 'SOLE_ENTITY_RESPONSIBLE' | 'WALLET_BALANCE';

/**
 * Conservamos una fila de usuario anonimizada: las reservas, el libro mayor y el registro de
 * actividad tienen FKs históricas restrictivas y deben seguir contando en los agregados.
 */
export async function deleteAccount(
	db: Db,
	userId: string,
	now: Date
): Promise<Result<void, AccountDeletionError>> {
	return db.transaction(async (tx) => {
		const [staff] = await tx
			.select({ id: staffRoles.id })
			.from(staffRoles)
			.where(eq(staffRoles.userId, userId));
		if (staff) return err('STAFF_MEMBER');
		const memberships = await tx
			.select({ entityId: entityMembers.entityId })
			.from(entityMembers)
			.where(eq(entityMembers.userId, userId));
		for (const membership of memberships) {
			const [{ count }] = await tx
				.select({ count: sql<number>`count(*)` })
				.from(entityMembers)
				.where(eq(entityMembers.entityId, membership.entityId));
			if (Number(count) === 1) return err('SOLE_ENTITY_RESPONSIBLE');
		}
		if ((await walletBalance(tx, userId)) > 0) return err('WALLET_BALANCE');

		const profiles = await tx
			.select({ id: municipalityProfiles.id, municipalityId: municipalityProfiles.municipalityId })
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.userId, userId));
		const profileIds = profiles.map((profile) => profile.id);
		if (profileIds.length) {
			await tx
				.update(waitlistEntries)
				.set({ status: 'withdrawn', offeredUntil: null })
				.where(inArray(waitlistEntries.profileId, profileIds));
			const future = await tx
				.select({ id: bookings.id, municipalityId: bookings.municipalityId })
				.from(bookings)
				.where(
					and(
						inArray(bookings.profileId, profileIds),
						eq(bookings.status, 'confirmed'),
						gt(bookings.startsAt, now)
					)
				);
			for (const booking of future) {
				await cancelBookingTx(tx, {
					municipalityId: booking.municipalityId,
					bookingId: booking.id,
					byStaff: true,
					reason: 'Eliminación da conta',
					now
				});
			}
			await tx
				.update(passes)
				.set({ cancelledAt: now })
				.where(
					and(
						inArray(passes.profileId, profileIds),
						gt(passes.endsOn, now.toISOString().slice(0, 10))
					)
				);
			await tx
				.update(municipalityProfiles)
				.set({
					isResident: false,
					followed: false,
					residencyDeclaredAt: null,
					residencyVerifiedAt: null,
					residencyVerifiedBy: null,
					socialTariff: null,
					rulesAcceptedAt: null,
					penaltyUntil: null,
					noShowCount: 0
				})
				.where(inArray(municipalityProfiles.id, profileIds));
		}
		// Solicitudes: as pendentes quedan retiradas; en todas bórranse os textos e o teléfono.
		await tx
			.update(requests)
			.set({ status: 'retirada', response: 'Conta eliminada', decidedAt: now, updatedAt: now })
			.where(
				and(eq(requests.userId, userId), inArray(requests.status, ['pendente', 'mais_datos']))
			);
		await tx
			.update(requests)
			.set({ title: 'Solicitude anonimizada', description: '', phone: '' })
			.where(eq(requests.userId, userId));
		// Torneos: fóra dos que aínda non empezaron; nas inscricións quedan sen nomes de terceiros.
		const today = now.toISOString().slice(0, 10);
		const upcoming = tx
			.select({ id: tournaments.id })
			.from(tournaments)
			.where(gt(tournaments.startsOn, today));
		await tx
			.update(tournamentEntries)
			.set({ cancelledAt: now })
			.where(
				and(
					eq(tournamentEntries.userId, userId),
					isNull(tournamentEntries.cancelledAt),
					inArray(tournamentEntries.tournamentId, upcoming)
				)
			);
		await tx
			.update(tournamentEntries)
			.set({ teamName: null, members: null })
			.where(eq(tournamentEntries.userId, userId));
		await tx.delete(entityMembers).where(eq(entityMembers.userId, userId));
		await tx.delete(notifications).where(eq(notifications.userId, userId));
		await tx.delete(sessions).where(eq(sessions.userId, userId));
		const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
		if (user?.email) await tx.delete(outboxEmails).where(eq(outboxEmails.toAddress, user.email));
		await tx
			.update(users)
			.set({
				provider: 'local',
				subject: `deleted:${userId}`,
				displayName: 'Conta eliminada',
				email: null,
				phone: null,
				notifyEmail: false,
				notifyConsentAt: null,
				onboardedAt: null,
				avatarKey: null,
				avatarPhoto: null,
				avatarMime: null,
				textSize: 'normal',
				highContrast: false,
				reduceMotion: 'system',
				easyBooking: false,
				dniHash: null
			})
			.where(eq(users.id, userId));
		return ok(undefined);
	});
}
