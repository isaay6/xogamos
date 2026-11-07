// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { bookings, facilities, municipalityProfiles, socialTariff, users } from '../db/schema';
import { computeStreak } from '../domain/streak';
import { localDateOf } from '../domain/time';
import { err, ok, type Result } from './result';

export type UserRow = typeof users.$inferSelect;

export type Summary = {
	displayName: string;
	provider: UserRow['provider'];
	email: string | null;
	phone: string | null;
	isResident: boolean;
	/** Declaración propia de empadronamiento en este concello (sin verificar). */
	residencyDeclaredAt: Date | null;
	socialTariff: (typeof socialTariff.enumValues)[number] | null;
	avatarKey: string | null;
	hasAvatarPhoto: boolean;
	onboardedAt: Date | null;
	penaltyUntil: Date | null;
	streak: number;
	bookingsThisYear: number;
	favouriteTypeId: string | null;
};

/**
 * Resumen de «Eu» en un concello: datos de contacto, empadronamiento, penalización
 * vigente (null si ya pasó), racha, reservas no canceladas del año local y tipo
 * favorito (más reservas no canceladas; en empate, el de la reserva más reciente).
 * Sin perfil en el concello, todo a cero. `null` si el usuario no existe.
 */
export async function getSummary(
	db: Db,
	municipalityId: string,
	userId: string,
	now: Date
): Promise<Summary | null> {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	if (!user) return null;
	const [profile] = await db
		.select()
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.municipalityId, municipalityId),
				eq(municipalityProfiles.userId, userId)
			)
		);
	const base = {
		displayName: user.displayName,
		provider: user.provider,
		email: user.email,
		phone: user.phone,
		avatarKey: user.avatarKey,
		hasAvatarPhoto: user.avatarMime !== null,
		onboardedAt: user.onboardedAt
	};
	if (!profile) {
		return {
			...base,
			isResident: false,
			residencyDeclaredAt: null,
			socialTariff: null,
			penaltyUntil: null,
			streak: 0,
			bookingsThisYear: 0,
			favouriteTypeId: null
		};
	}

	const rows = await db
		.select({
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			status: bookings.status,
			typeId: facilities.typeId
		})
		.from(bookings)
		.innerJoin(
			facilities,
			and(eq(facilities.id, bookings.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.where(and(eq(bookings.municipalityId, municipalityId), eq(bookings.profileId, profile.id)));

	const year = localDateOf(now).slice(0, 4);
	const live = rows.filter((r) => r.status !== 'cancelled');
	const byType = new Map<string, { count: number; latest: number }>();
	for (const r of live) {
		const t = byType.get(r.typeId) ?? { count: 0, latest: -Infinity };
		t.count++;
		t.latest = Math.max(t.latest, r.startsAt.getTime());
		byType.set(r.typeId, t);
	}
	let favouriteTypeId: string | null = null;
	let best = { count: 0, latest: -Infinity };
	for (const [typeId, t] of byType) {
		if (t.count > best.count || (t.count === best.count && t.latest > best.latest)) {
			favouriteTypeId = typeId;
			best = t;
		}
	}

	return {
		...base,
		isResident: profile.isResident,
		residencyDeclaredAt: profile.residencyDeclaredAt,
		socialTariff: profile.socialTariff,
		penaltyUntil: profile.penaltyUntil && profile.penaltyUntil > now ? profile.penaltyUntil : null,
		streak: computeStreak(rows, now),
		bookingsThisYear: live.filter((r) => localDateOf(r.startsAt).startsWith(`${year}-`)).length,
		favouriteTypeId
	};
}

/** Correo y teléfono editables; cadena vacía (tras recortar) = borrar; ausente = no cambiar. */
export const ContactInput = z
	.object({
		email: z
			.union([z.string().trim().max(200), z.null()])
			.transform((v) => (v === '' ? null : v))
			.pipe(z.union([z.email().max(200), z.null()]))
			.optional(),
		phone: z
			.union([z.string().trim().max(40), z.null()])
			.transform((v) => (v === '' ? null : v))
			.optional()
	})
	.strict();

export type ContactPatch = { email?: string | null; phone?: string | null };

export async function updateContact(
	db: Db,
	userId: string,
	patch: ContactPatch
): Promise<Result<UserRow, 'VALIDATION_FAILED'>> {
	const parsed = ContactInput.safeParse(patch);
	if (!parsed.success) return err('VALIDATION_FAILED');
	const set: Partial<Pick<UserRow, 'email' | 'phone'>> = {};
	if (parsed.data.email !== undefined) set.email = parsed.data.email;
	if (parsed.data.phone !== undefined) set.phone = parsed.data.phone;
	if (Object.keys(set).length === 0) {
		const [row] = await db.select().from(users).where(eq(users.id, userId));
		return row ? ok(row) : err('VALIDATION_FAILED');
	}
	const [row] = await db.update(users).set(set).where(eq(users.id, userId)).returning();
	return row ? ok(row) : err('VALIDATION_FAILED');
}
