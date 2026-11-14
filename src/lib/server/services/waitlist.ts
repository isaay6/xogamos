// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	facilities,
	facilityTypes,
	municipalities,
	municipalityProfiles,
	waitlistEntries,
	type BookingRow,
	type WaitlistEntryRow
} from '../db/schema';
import { isPenalized, withinBookingWindow } from '../domain/policies';
import { addLocalDays, localDateOf, localTimeOf } from '../domain/time';
import { facilityLockQuery, loadDayAvailability, type Tx } from './bookings';
import { notify } from './notifications';
import { err, ok, type Result } from './result';

export type WaitlistError =
	| 'NOT_FOUND'
	| 'IN_PAST'
	| 'TOO_FAR_AHEAD'
	| 'PENALIZED'
	| 'SLOT_AVAILABLE'
	| 'NOT_ALIGNED'
	| 'ALREADY_WAITING'
	| 'WAITLIST_LIMIT'
	| 'NOT_WAITLIST_OWNER';

export type JoinWaitlistInput = {
	municipalityId: string;
	facilityId: string;
	profileId: string;
	startsAt: Date;
	now: Date;
};

/** Apunta a una franja llena tras serializar la instalación, igual que las reservas. */
export async function joinWaitlist(
	db: Db,
	input: JoinWaitlistInput
): Promise<Result<WaitlistEntryRow, WaitlistError>> {
	return db.transaction(async (tx) => {
		const [facility] = await facilityLockQuery(tx, input.municipalityId, input.facilityId);
		if (!facility || !facility.active) return err('NOT_FOUND');
		const [type] = await tx
			.select({ bookingMode: facilityTypes.bookingMode })
			.from(facilityTypes)
			.where(
				and(
					eq(facilityTypes.id, facility.typeId),
					eq(facilityTypes.municipalityId, input.municipalityId)
				)
			);
		const [profile] = await tx
			.select()
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.id, input.profileId),
					eq(municipalityProfiles.municipalityId, input.municipalityId)
				)
			);
		const [policy] = await tx
			.select()
			.from(municipalities)
			.where(eq(municipalities.id, input.municipalityId));
		if (!type || !profile || !policy) return err('NOT_FOUND');
		const windowError = withinBookingWindow(input.startsAt, input.now, policy);
		if (windowError) return err(windowError);
		if (isPenalized(profile.penaltyUntil, input.now)) return err('PENALIZED');
		await expireOffers(tx, input.now, input.facilityId, input.startsAt);
		const slots = await loadDayAvailability(
			tx,
			facility,
			type.bookingMode,
			localDateOf(input.startsAt)
		);
		const slot = slots.find((value) => value.startsAt.getTime() === input.startsAt.getTime());
		if (!slot) return err('NOT_ALIGNED');
		const full =
			type.bookingMode === 'unit'
				? slot.freeUnits.length === 0
				: type.bookingMode === 'capacity'
					? slot.remainingSeats === 0
					: !slot.free;
		if (!full) return err('SLOT_AVAILABLE');
		const active = await tx
			.select({ id: waitlistEntries.id, status: waitlistEntries.status })
			.from(waitlistEntries)
			.where(
				and(
					eq(waitlistEntries.profileId, input.profileId),
					inArray(waitlistEntries.status, ['waiting', 'offered'])
				)
			);
		if (
			active.some((entry) => entry.status === 'waiting' || entry.status === 'offered') &&
			active.length >= 3
		)
			return err('WAITLIST_LIMIT');
		try {
			const [entry] = await tx
				.insert(waitlistEntries)
				.values({ ...input, createdAt: input.now })
				.returning();
			return ok(entry);
		} catch {
			return err('ALREADY_WAITING');
		}
	});
}

export async function leaveWaitlist(
	db: Db,
	input: { id: string; profileId: string; now: Date }
): Promise<Result<void, 'NOT_FOUND' | 'NOT_WAITLIST_OWNER'>> {
	const [entry] = await db.select().from(waitlistEntries).where(eq(waitlistEntries.id, input.id));
	if (!entry) return err('NOT_FOUND');
	if (entry.profileId !== input.profileId) return err('NOT_WAITLIST_OWNER');
	await db
		.update(waitlistEntries)
		.set({ status: 'withdrawn', offeredUntil: null })
		.where(eq(waitlistEntries.id, input.id));
	return ok(undefined);
}

export async function listMyWaitlist(db: Db, profileId: string, now: Date) {
	return db.transaction(async (tx) => {
		await expireOffers(tx, now);
		return tx
			.select({ entry: waitlistEntries, facilityName: facilities.name })
			.from(waitlistEntries)
			.innerJoin(facilities, eq(facilities.id, waitlistEntries.facilityId))
			.where(eq(waitlistEntries.profileId, profileId))
			.orderBy(asc(waitlistEntries.startsAt));
	});
}

/** Caducidad perezosa; cada oferta que vence deja paso a la siguiente de la misma franja. */
export async function expireOffers(tx: Tx, now: Date, facilityId?: string, startsAt?: Date) {
	const expired = await tx
		.select()
		.from(waitlistEntries)
		.where(
			and(
				eq(waitlistEntries.status, 'offered'),
				lte(waitlistEntries.offeredUntil, now),
				facilityId ? eq(waitlistEntries.facilityId, facilityId) : undefined,
				startsAt ? eq(waitlistEntries.startsAt, startsAt) : undefined
			)
		);
	for (const entry of expired) {
		await tx
			.update(waitlistEntries)
			.set({ status: 'expired', offeredUntil: null })
			.where(eq(waitlistEntries.id, entry.id));
		await offerSlot(tx, entry.municipalityId, entry.facilityId, entry.startsAt, now);
	}
}

/** Ofrece la primera espera FIFO. No crea una oferta demasiado cerca del inicio. */
async function offerSlot(
	tx: Tx,
	municipalityId: string,
	facilityId: string,
	startsAt: Date,
	now: Date
) {
	if (startsAt.getTime() - now.getTime() < 15 * 60_000) return;
	const [next] = await tx
		.select()
		.from(waitlistEntries)
		.where(
			and(
				eq(waitlistEntries.facilityId, facilityId),
				eq(waitlistEntries.startsAt, startsAt),
				eq(waitlistEntries.status, 'waiting')
			)
		)
		.orderBy(asc(waitlistEntries.createdAt))
		.limit(1);
	if (!next) return;
	const offeredUntil = new Date(Math.min(now.getTime() + 30 * 60_000, startsAt.getTime()));
	await tx
		.update(waitlistEntries)
		.set({ status: 'offered', offeredUntil })
		.where(eq(waitlistEntries.id, next.id));
	const [facility] = await tx
		.select({ name: facilities.name })
		.from(facilities)
		.where(eq(facilities.id, facilityId));
	const [profile] = await tx
		.select({ userId: municipalityProfiles.userId })
		.from(municipalityProfiles)
		.where(eq(municipalityProfiles.id, next.profileId));
	if (facility && profile)
		await notify(tx, {
			userId: profile.userId,
			municipalityId,
			kind: 'waitlist_offer',
			params: {
				facilityName: facility.name,
				date: localDateOf(startsAt),
				time: localTimeOf(startsAt),
				offeredUntil: offeredUntil.toISOString()
			}
		});
}

export async function offerFreedSlot(tx: Tx, booking: BookingRow, now: Date) {
	await facilityLockQuery(tx, booking.municipalityId, booking.facilityId);
	await expireOffers(tx, now, booking.facilityId, booking.startsAt);
	await offerSlot(tx, booking.municipalityId, booking.facilityId, booking.startsAt, now);
}

/** Una oferta vigente reserva una plaza para su destinataria. */
export async function mayBookOfferedSlot(
	tx: Tx,
	input: { facilityId: string; startsAt: Date; profileId: string; now: Date }
) {
	await expireOffers(tx, input.now, input.facilityId, input.startsAt);
	const offered = await tx
		.select()
		.from(waitlistEntries)
		.where(
			and(
				eq(waitlistEntries.facilityId, input.facilityId),
				eq(waitlistEntries.startsAt, input.startsAt),
				eq(waitlistEntries.status, 'offered'),
				gt(waitlistEntries.offeredUntil, input.now)
			)
		);
	return { offered, mine: offered.find((entry) => entry.profileId === input.profileId) };
}

export async function claimWaitlistOffer(
	tx: Tx,
	profileId: string,
	facilityId: string,
	startsAt: Date
) {
	await tx
		.update(waitlistEntries)
		.set({ status: 'booked', offeredUntil: null })
		.where(
			and(
				eq(waitlistEntries.profileId, profileId),
				eq(waitlistEntries.facilityId, facilityId),
				eq(waitlistEntries.startsAt, startsAt),
				eq(waitlistEntries.status, 'offered')
			)
		);
}

/** Alternativas deterministas: misma instalación, mismo tipo y, finalmente, mañana. */
export async function suggestAlternatives(
	db: Db,
	input: {
		municipalityId: string;
		facilityId: string;
		startsAt?: Date;
		date?: string;
		now: Date;
		limit?: number;
	}
) {
	const limit = input.limit ?? 3;
	const date =
		input.date ?? (input.startsAt ? localDateOf(input.startsAt) : localDateOf(input.now));
	const [facility] = await db
		.select()
		.from(facilities)
		.where(
			and(eq(facilities.id, input.facilityId), eq(facilities.municipalityId, input.municipalityId))
		);
	if (!facility) return [];
	const peers = await db
		.select()
		.from(facilities)
		.where(
			and(
				eq(facilities.municipalityId, input.municipalityId),
				eq(facilities.typeId, facility.typeId),
				eq(facilities.active, true)
			)
		);
	const ordered = [facility, ...peers.filter((entry) => entry.id !== facility.id)];
	const dates = [date, addLocalDays(date, 1)];
	const suggestions: Array<{ facilityId: string; startsAt: Date; endsAt: Date }> = [];
	for (const day of dates)
		for (const item of ordered) {
			const [type] = await db
				.select({ bookingMode: facilityTypes.bookingMode })
				.from(facilityTypes)
				.where(eq(facilityTypes.id, item.typeId));
			if (!type) continue;
			const slots = await loadDayAvailability(db, item, type.bookingMode, day);
			for (const slot of slots) {
				// Non se suxiren franxas que xa comezaron, aínda que a súa capacidade estea libre.
				const after =
					slot.startsAt.getTime() > input.now.getTime() &&
					(!input.startsAt || slot.startsAt.getTime() > input.startsAt.getTime());
				const free =
					type.bookingMode === 'unit'
						? slot.freeUnits.length > 0
						: type.bookingMode === 'capacity'
							? slot.remainingSeats > 0
							: slot.free;
				if (after && free)
					suggestions.push({ facilityId: item.id, startsAt: slot.startsAt, endsAt: slot.endsAt });
				if (suggestions.length >= limit) return suggestions;
			}
		}
	return suggestions;
}
