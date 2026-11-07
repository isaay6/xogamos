// SPDX-License-Identifier: EUPL-1.2
import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	ne,
	notInArray,
	or
} from 'drizzle-orm';
import type { Db } from '../db/client';
import { addLocalMonths, localDateOf, localMonthStart } from '../domain/time';
import { err, ok, type Result } from './result';
import {
	bookings,
	entities,
	facilities,
	facilityTypes,
	municipalities,
	municipalityProfiles,
	passes,
	users,
	type BookingRow,
	type ProfileRow
} from '../db/schema';

export async function getProfile(
	db: Db,
	municipalityId: string,
	userId: string
): Promise<ProfileRow | null> {
	const [row] = await db
		.select()
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.municipalityId, municipalityId),
				eq(municipalityProfiles.userId, userId)
			)
		);
	return row ?? null;
}

/** Perfil de la persona en el concello; lo crea como no empadronada si no existe. */
export async function ensureProfile(
	db: Db,
	municipalityId: string,
	userId: string
): Promise<ProfileRow> {
	await db
		.insert(municipalityProfiles)
		.values({ municipalityId, userId, isResident: false })
		.onConflictDoNothing({
			target: [municipalityProfiles.municipalityId, municipalityProfiles.userId]
		});
	const profile = await getProfile(db, municipalityId, userId);
	if (!profile) throw new Error('PROFILE_NOT_FOUND');
	return profile;
}

/** Reserva del propio perfil en el concello, o null (otra persona u otro concello). */
export async function getOwnBooking(
	db: Db,
	municipalityId: string,
	profileId: string,
	bookingId: string
): Promise<BookingRow | null> {
	const [row] = await db
		.select()
		.from(bookings)
		.where(
			and(
				eq(bookings.id, bookingId),
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.profileId, profileId)
			)
		);
	return row ?? null;
}

/** Estados del historial (mockup B4): los chips «Próxima», «Feita», «Non fuches» y «Cancelada». */
export const HISTORY_STATES = ['proxima', 'feita', 'non_fuches', 'cancelada'] as const;
export type HistoryState = (typeof HISTORY_STATES)[number];

/**
 * Estado de historial de una reserva. Una confirmada sigue «próxima» mientras no acaba (como en
 * la lista, que conserva las que están en curso); ya acabada y sin marcar cuenta como hecha,
 * igual que en la racha: nadie dijo que faltase.
 */
export function historyState(status: BookingRow['status'], endsAt: Date, now: Date): HistoryState {
	if (status === 'cancelled') return 'cancelada';
	if (status === 'no_show') return 'non_fuches';
	if (status === 'attended') return 'feita';
	return endsAt.getTime() > now.getTime() ? 'proxima' : 'feita';
}

/** Condición SQL de cada estado del historial (la misma regla que `historyState`). */
function historyCondition(state: HistoryState, now: Date) {
	switch (state) {
		case 'cancelada':
			return eq(bookings.status, 'cancelled');
		case 'non_fuches':
			return eq(bookings.status, 'no_show');
		case 'proxima':
			return and(eq(bookings.status, 'confirmed'), gt(bookings.endsAt, now));
		case 'feita':
			return or(
				eq(bookings.status, 'attended'),
				and(eq(bookings.status, 'confirmed'), lte(bookings.endsAt, now))
			);
	}
}

/**
 * Reservas propias en el concello.
 * - `upcoming`: las que empiezan desde `now`, sin las canceladas (decisión 1), en orden ascendente;
 *   con `includeOngoing`, también las que ya empezaron pero aún no acabaron (el PIN sigue
 *   haciendo falta en la puerta);
 * - `past` (historial antiguo): las ya empezadas y todas las canceladas, en orden descendente;
 * - `all` (historial): todas, en orden descendente.
 *
 * Filtros: `month` ('YYYY-MM', mes local de Madrid: una reserva a las 00:30 del día 1 es de ese
 * mes) y `status` (estado del historial).
 */
export async function listMyBookings(
	db: Db,
	municipalityId: string,
	profileId: string,
	opts: {
		scope: 'upcoming' | 'past' | 'all';
		now: Date;
		includeOngoing?: boolean;
		month?: string;
		status?: HistoryState;
	}
) {
	const { now, scope } = opts;
	const upcoming = scope === 'upcoming';
	const scopeCondition =
		scope === 'upcoming'
			? and(
					opts.includeOngoing ? gt(bookings.endsAt, now) : gte(bookings.startsAt, now),
					ne(bookings.status, 'cancelled')
				)
			: scope === 'past'
				? or(lt(bookings.startsAt, now), eq(bookings.status, 'cancelled'))
				: undefined;
	const monthCondition = opts.month
		? and(
				gte(bookings.startsAt, localMonthStart(opts.month)),
				lt(bookings.startsAt, localMonthStart(addLocalMonths(opts.month, 1)))
			)
		: undefined;
	return db
		.select({
			id: bookings.id,
			facilityId: bookings.facilityId,
			facilityName: facilities.name,
			facilityLocation: facilities.location,
			facilityAddress: facilities.address,
			typeId: facilities.typeId,
			typeNameGl: facilityTypes.nameGl,
			typeNameEs: facilityTypes.nameEs,
			bookingMode: facilityTypes.bookingMode,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			unitIndex: bookings.unitIndex,
			seats: bookings.seats,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			status: bookings.status,
			accessCode: bookings.accessCode,
			priceCents: bookings.priceCents,
			entityName: entities.name
		})
		.from(bookings)
		.innerJoin(
			facilities,
			and(eq(facilities.id, bookings.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.leftJoin(entities, eq(entities.id, bookings.entityId))
		.innerJoin(
			facilityTypes,
			and(eq(facilityTypes.id, facilities.typeId), eq(facilityTypes.municipalityId, municipalityId))
		)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.profileId, profileId),
				scopeCondition,
				monthCondition,
				opts.status ? historyCondition(opts.status, now) : undefined
			)
		)
		.orderBy(upcoming ? asc(bookings.startsAt) : desc(bookings.startsAt));
}

/**
 * Concellos seguidos: los de `municipalityIds` quedan con `followed = true` (perfil creado
 * si falta, como no empadronado); el resto de perfiles de la persona pasan a `false`.
 * Nunca se borra un perfil: puede tener reservas.
 */
export async function followMunicipalities(
	db: Db,
	userId: string,
	municipalityIds: string[]
): Promise<Result<void, 'UNKNOWN_MUNICIPALITY'>> {
	const ids = [...new Set(municipalityIds)];
	if (ids.length > 0) {
		const found = await db
			.select({ id: municipalities.id })
			.from(municipalities)
			.where(inArray(municipalities.id, ids));
		if (found.length !== ids.length) return err('UNKNOWN_MUNICIPALITY');
	}
	await db.transaction(async (tx) => {
		if (ids.length > 0) {
			await tx
				.insert(municipalityProfiles)
				.values(ids.map((municipalityId) => ({ municipalityId, userId, isResident: false })))
				.onConflictDoNothing({
					target: [municipalityProfiles.municipalityId, municipalityProfiles.userId]
				});
			await tx
				.update(municipalityProfiles)
				.set({ followed: true })
				.where(
					and(
						eq(municipalityProfiles.userId, userId),
						inArray(municipalityProfiles.municipalityId, ids)
					)
				);
		}
		await tx
			.update(municipalityProfiles)
			.set({ followed: false })
			.where(
				and(
					eq(municipalityProfiles.userId, userId),
					ids.length > 0 ? notInArray(municipalityProfiles.municipalityId, ids) : undefined
				)
			);
	});
	return ok(undefined);
}

/** Engade un concello á persoa, creando o perfil non empadroado se aínda non existe. */
export async function joinMunicipality(
	db: Db,
	userId: string,
	municipalityId: string
): Promise<Result<void, 'UNKNOWN_MUNICIPALITY'>> {
	const [municipality] = await db
		.select({ id: municipalities.id })
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!municipality) return err('UNKNOWN_MUNICIPALITY');
	await db
		.insert(municipalityProfiles)
		.values({ municipalityId, userId, isResident: false, followed: true })
		.onConflictDoUpdate({
			target: [municipalityProfiles.municipalityId, municipalityProfiles.userId],
			set: { followed: true }
		});
	return ok(undefined);
}

export type LeaveMunicipalityError = 'NOT_FOLLOWED' | 'FUTURE_BOOKINGS' | 'ACTIVE_PASS';

/**
 * Deixar un concello conserva o perfil e o historial, pero non pode ocultar unha reserva futura
 * nin un abono vixente que a persoa aínda necesita usar.
 */
export async function leaveMunicipality(
	db: Db,
	userId: string,
	municipalityId: string,
	now: Date
): Promise<Result<void, LeaveMunicipalityError>> {
	const blocked = await leaveBlock(db, userId, municipalityId, now);
	if (blocked) return err(blocked);
	const profile = (await getProfile(db, municipalityId, userId))!;
	await db
		.update(municipalityProfiles)
		.set({ followed: false })
		.where(eq(municipalityProfiles.id, profile.id));
	return ok(undefined);
}

/** Por que non se pode deixar este concello agora; `null` se se pode. */
export async function leaveBlock(
	db: Db,
	userId: string,
	municipalityId: string,
	now: Date
): Promise<LeaveMunicipalityError | null> {
	const profile = await getProfile(db, municipalityId, userId);
	if (!profile?.followed) return 'NOT_FOLLOWED';
	const [future, activePass] = await Promise.all([
		db
			.select({ id: bookings.id })
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, municipalityId),
					eq(bookings.profileId, profile.id),
					eq(bookings.status, 'confirmed'),
					gte(bookings.startsAt, now)
				)
			)
			.limit(1),
		db
			.select({ id: passes.id })
			.from(passes)
			.where(
				and(
					eq(passes.profileId, profile.id),
					lte(passes.startsOn, localDateOf(now)),
					gte(passes.endsOn, localDateOf(now))
				)
			)
			.limit(1)
	]);
	if (future.length > 0) return 'FUTURE_BOOKINGS';
	if (activePass.length > 0) return 'ACTIVE_PASS';
	return null;
}

/** Concellos seguidos de la persona, con el estado verificado y la declaración de cada uno. */
export async function listFollowed(db: Db, userId: string) {
	const rows = await db
		.select({
			municipalityId: municipalities.id,
			slug: municipalities.slug,
			name: municipalities.name,
			primaryColor: municipalities.primaryColor,
			hasLogo: municipalities.logo,
			logoVersion: municipalities.logoVersion,
			isResident: municipalityProfiles.isResident,
			residencyDeclaredAt: municipalityProfiles.residencyDeclaredAt
		})
		.from(municipalityProfiles)
		.innerJoin(municipalities, eq(municipalities.id, municipalityProfiles.municipalityId))
		.where(and(eq(municipalityProfiles.userId, userId), eq(municipalityProfiles.followed, true)))
		.orderBy(asc(municipalities.name));
	return rows.map((row) => ({ ...row, hasLogo: row.hasLogo !== null }));
}

/**
 * La persona declara que está empadronada en el concello. Solo anota la fecha: `is_resident`
 * (verificado, el que fija el precio) lo cambia únicamente el personal. Crea el perfil si falta.
 */
export async function declareResidency(
	db: Db,
	userId: string,
	municipalityId: string,
	now: Date
): Promise<void> {
	await ensureProfile(db, municipalityId, userId);
	await db
		.update(municipalityProfiles)
		.set({ residencyDeclaredAt: now })
		.where(
			and(
				eq(municipalityProfiles.municipalityId, municipalityId),
				eq(municipalityProfiles.userId, userId)
			)
		);
}

/** Fin de la bienvenida. Idempotente: conserva la primera fecha. */
export async function completeOnboarding(db: Db, userId: string, now: Date): Promise<void> {
	await db
		.update(users)
		.set({ onboardedAt: now })
		.where(and(eq(users.id, userId), isNull(users.onboardedAt)));
}
