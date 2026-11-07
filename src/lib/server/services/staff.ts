// SPDX-License-Identifier: EUPL-1.2
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, gte, ilike, inArray, lt, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	entities,
	facilities,
	facilityTypes,
	municipalityProfiles,
	openingHours,
	seasonBookings,
	staffRoles,
	users
} from '../db/schema';
import { dniLetterOk, dniSuggestions, hashDni, normalizeDni } from '../domain/dni';
import type { SocialTariff } from '../domain/policies';
import type { BookingMode } from '../domain/types';
import { seasonOccurrence } from '../domain/seasons';
import { localDateTimeToUtc, weekdayOf } from '../domain/time';
import { localDayBounds } from './bookings';
import { notify } from './notifications';
import { err, ok, type Result } from './result';
import { writeActivity } from './activity-log';

export type AgendaEntry = {
	id: string;
	startsAt: Date;
	endsAt: Date;
	unitIndex: number | null;
	seats: number;
	channel: 'online' | 'phone' | 'desk';
	status: string;
	profileId: string;
	displayName: string;
	entityName?: string | null;
	phone: string | null;
	accessCode: string;
	priceCents: number;
	isResident: boolean;
	noShowCount: number;
};

/** Crea unha identidade que aínda non entrou e dálle un rol no concello. */
export async function addStaffIdentity(
	db: Db,
	municipalityId: string,
	identity: { provider: 'clave' | 'chave365'; subject: string; displayName: string },
	role: 'conserxe' | 'admin' | 'apertura'
): Promise<boolean> {
	return db.transaction(async (tx) => {
		await tx
			.insert(users)
			.values({ ...identity, email: null })
			.onConflictDoNothing({
				target: [users.provider, users.subject]
			});
		const [user] = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.provider, identity.provider), eq(users.subject, identity.subject)));
		if (!user) return false;
		await tx
			.insert(staffRoles)
			.values({ municipalityId, userId: user.id, role })
			.onConflictDoNothing();
		return true;
	});
}

export type AgendaFacility = {
	facilityId: string;
	facilityName: string;
	location: string;
	mascot: string;
	color: string;
	bookingMode: BookingMode;
	units: number;
	capacity: number;
	bookings: AgendaEntry[];
	/** Ocurrencias de las reservas de temporada ese día, con el nombre de la entidad. */
	seasons: AgendaSeason[];
};

export type AgendaSeason = {
	id: string;
	entityName: string;
	startsAt: Date;
	endsAt: Date;
	unitIndex: number | null;
};

/**
 * Reservas del día local en las instalaciones del concello, agrupadas por instalación
 * (ordenadas por edificio y nombre). Salen todas las instalaciones activas, también las
 * que no tienen reservas ese día, y las inactivas que sí las tengan. Incluye lo que necesita el panel lateral del
 * conserje: código, precio, empadronamiento y faltas del periodo. Las reservas de temporada
 * de ese día van aparte (`seasons`), con el nombre de la entidad.
 */
export async function getAgenda(
	db: Db,
	municipalityId: string,
	date: string
): Promise<AgendaFacility[]> {
	const { dayStart, dayEnd } = localDayBounds(date);
	const rows = await db
		.select({
			id: bookings.id,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			unitIndex: bookings.unitIndex,
			seats: bookings.seats,
			channel: bookings.channel,
			status: bookings.status,
			profileId: bookings.profileId,
			displayName: users.displayName,
			phone: users.phone,
			accessCode: bookings.accessCode,
			priceCents: bookings.priceCents,
			isResident: municipalityProfiles.isResident,
			noShowCount: municipalityProfiles.noShowCount,
			entityName: entities.name,
			facilityId: facilities.id,
			facilityName: facilities.name,
			location: facilities.location,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			bookingMode: facilityTypes.bookingMode,
			units: facilities.units,
			capacity: facilities.capacity
		})
		.from(bookings)
		.innerJoin(
			facilities,
			and(eq(facilities.id, bookings.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.innerJoin(
			facilityTypes,
			and(eq(facilityTypes.id, facilities.typeId), eq(facilityTypes.municipalityId, municipalityId))
		)
		.innerJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.id, bookings.profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.leftJoin(entities, eq(entities.id, bookings.entityId))
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				gte(bookings.startsAt, dayStart),
				lt(bookings.startsAt, dayEnd)
			)
		)
		.orderBy(
			asc(facilities.location),
			asc(facilities.name),
			asc(facilities.id),
			asc(bookings.startsAt)
		);

	const active = await db
		.select({
			facilityId: facilities.id,
			facilityName: facilities.name,
			location: facilities.location,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			bookingMode: facilityTypes.bookingMode,
			units: facilities.units,
			capacity: facilities.capacity
		})
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(eq(facilityTypes.id, facilities.typeId), eq(facilityTypes.municipalityId, municipalityId))
		)
		.where(and(eq(facilities.municipalityId, municipalityId), eq(facilities.active, true)));

	const groups = new Map<string, AgendaFacility>();
	for (const f of active) groups.set(f.facilityId, { ...f, bookings: [], seasons: [] });
	for (const row of rows) {
		const {
			facilityId,
			facilityName,
			location,
			mascot,
			color,
			bookingMode,
			units,
			capacity,
			...entry
		} = row;
		let group = groups.get(facilityId);
		if (!group) {
			group = {
				facilityId,
				facilityName,
				location,
				mascot,
				color,
				bookingMode,
				units,
				capacity,
				bookings: [],
				seasons: []
			};
			groups.set(facilityId, group);
		}
		group.bookings.push(entry);
	}

	// Temporadas del día (solo en las instalaciones que ya salen en la agenda).
	const seasons = await db
		.select()
		.from(seasonBookings)
		.where(
			and(
				eq(seasonBookings.municipalityId, municipalityId),
				eq(seasonBookings.weekday, weekdayOf(date)),
				lte(seasonBookings.fromDate, date),
				gte(seasonBookings.toDate, date)
			)
		)
		.orderBy(asc(seasonBookings.startsTime), asc(seasonBookings.id));
	for (const season of seasons) {
		const occurrence = seasonOccurrence(season, date);
		const group = groups.get(season.facilityId);
		if (!occurrence || !group) continue;
		group.seasons.push({
			id: season.id,
			entityName: season.entityName,
			unitIndex: season.unitIndex,
			...occurrence
		});
	}
	// Mismo orden que la consulta de reservas: edificio, nombre e id.
	return [...groups.values()].sort(
		(a, b) =>
			a.location.localeCompare(b.location) ||
			a.facilityName.localeCompare(b.facilityName) ||
			a.facilityId.localeCompare(b.facilityId)
	);
}

const toMinutes = (hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

/**
 * Columnas de la agenda: apertura mínima y cierre máximo (en minutos) de las instalaciones
 * activas ese día de la semana. Sin horarios, 09:00–22:00.
 */
export async function getAgendaHours(
	db: Db,
	municipalityId: string,
	date: string
): Promise<{ startMinute: number; endMinute: number }> {
	const rows = await db
		.select({ opens: openingHours.opens, closes: openingHours.closes })
		.from(openingHours)
		.innerJoin(
			facilities,
			and(eq(facilities.id, openingHours.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.where(and(eq(facilities.active, true), eq(openingHours.weekday, weekdayOf(date))));
	if (rows.length === 0) return { startMinute: 9 * 60, endMinute: 22 * 60 };
	return {
		startMinute: Math.min(...rows.map((r) => toMinutes(r.opens))),
		endMinute: Math.max(...rows.map((r) => toMinutes(r.closes)))
	};
}

/** Duración total (ms) de la unión de intervalos `[s, e)`; los vacíos no cuentan. */
export function unionMs(intervals: { s: number; e: number }[]): number {
	const live = intervals.filter((i) => i.e > i.s).sort((a, b) => a.s - b.s);
	let total = 0;
	let cur: { s: number; e: number } | null = null;
	for (const i of live) {
		if (cur && i.s <= cur.e) cur.e = Math.max(cur.e, i.e);
		else {
			if (cur) total += cur.e - cur.s;
			cur = { ...i };
		}
	}
	return cur ? total + cur.e - cur.s : total;
}

/**
 * Minutos de apertura de cada instalación activa del concello en cada fecha local: el horario de
 * ese día de la semana menos los cierres que lo pisan. 0 = pechada ese día. Las horas se pasan a
 * instantes con `localDateTimeToUtc`, así que el día del cambio de hora cuenta lo que dura de verdad.
 */
export async function getOpenMinutes(
	db: Db,
	municipalityId: string,
	dates: string[]
): Promise<Map<string, Map<string, number>>> {
	const out = new Map<string, Map<string, number>>();
	if (dates.length === 0) return out;
	const hours = await db
		.select({
			facilityId: openingHours.facilityId,
			weekday: openingHours.weekday,
			opens: openingHours.opens,
			closes: openingHours.closes
		})
		.from(openingHours)
		.innerJoin(
			facilities,
			and(eq(facilities.id, openingHours.facilityId), eq(facilities.municipalityId, municipalityId))
		);
	const sorted = [...dates].sort();
	const { dayStart } = localDayBounds(sorted[0]);
	const { dayEnd } = localDayBounds(sorted[sorted.length - 1]);
	const shut = await db
		.select({
			facilityId: closures.facilityId,
			startsAt: closures.startsAt,
			endsAt: closures.endsAt
		})
		.from(closures)
		.innerJoin(
			facilities,
			and(eq(facilities.id, closures.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.where(and(lt(closures.startsAt, dayEnd), gt(closures.endsAt, dayStart)));
	for (const date of dates) {
		const weekday = weekdayOf(date);
		for (const h of hours) {
			if (h.weekday !== weekday) continue;
			const from = localDateTimeToUtc(date, h.opens).getTime();
			const to = localDateTimeToUtc(date, h.closes).getTime();
			// Se restan los trozos cerrados, unidos antes por si dos cierres se solapan.
			const cut = shut
				.filter((c) => c.facilityId === h.facilityId)
				.map((c) => ({
					s: Math.max(from, c.startsAt.getTime()),
					e: Math.min(to, c.endsAt.getTime())
				}));
			const ms = Math.max(0, to - from) - unionMs(cut);
			const byDate = out.get(h.facilityId) ?? new Map<string, number>();
			byDate.set(date, (byDate.get(date) ?? 0) + Math.max(0, Math.round(ms / 60_000)));
			out.set(h.facilityId, byDate);
		}
	}
	return out;
}

export type PersonOut = {
	profileId: string;
	userId: string;
	displayName: string;
	phone: string | null;
};

const MAX_PEOPLE = 20;

const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

const digits = (s: string) => s.replace(/\D/g, '');

/** Cifras mínimas de `q` para comparar también con el teléfono. */
const MIN_PHONE_DIGITS = 3;

/**
 * Personas con perfil en el concello cuyo nombre contiene `q` (sin mayúsculas ni tildes)
 * o, si `q` tiene al menos 3 cifras, cuyo teléfono las contiene (solo cifras). Máx. 20.
 */
export async function searchPeople(
	db: Db,
	municipalityId: string,
	q: string
): Promise<PersonOut[]> {
	const needle = fold(q.trim());
	const rows = await db
		.select({
			profileId: municipalityProfiles.id,
			userId: users.id,
			displayName: users.displayName,
			phone: users.phone
		})
		.from(municipalityProfiles)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(eq(municipalityProfiles.municipalityId, municipalityId))
		.orderBy(asc(users.displayName), asc(municipalityProfiles.id));
	const qDigits = digits(q);
	const byPhone = qDigits.length >= MIN_PHONE_DIGITS;
	return rows
		.filter(
			(r) =>
				fold(r.displayName).includes(needle) ||
				(byPhone && r.phone !== null && digits(r.phone).includes(qDigits))
		)
		.slice(0, MAX_PEOPLE);
}

/**
 * Alta de un vecino sin Cl@ve: usuario local y perfil (no empadronado) en el concello. Con `dni`
 * guarda solo su hash (`dniSecret` obligatorio); un DNI sin forma o con la letra mal es un error de
 * programación (la pantalla lo valida antes con `normalizeDni` y `dniLetterOk`). Si ese DNI ya es
 * de otra persona, `DNI_EXISTS` (la pantalla la busca con `findPersonByDni`).
 */
export async function createLocalPerson(
	db: Db,
	municipalityId: string,
	input: { displayName: string; phone: string; dni?: string },
	dniSecret?: string
): Promise<Result<PersonOut, 'DNI_EXISTS'>> {
	let dniHash: string | null = null;
	if (input.dni !== undefined) {
		const dni = normalizeDni(input.dni);
		if (!dni || !dniLetterOk(dni)) throw new RangeError('INVALID_DNI');
		if (!dniSecret) throw new Error('DNI_SECRET_REQUIRED');
		dniHash = hashDni(dni, dniSecret);
	}
	try {
		return ok(
			await db.transaction(async (tx) => {
				const [user] = await tx
					.insert(users)
					.values({
						provider: 'local',
						subject: randomUUID(),
						displayName: input.displayName,
						phone: input.phone,
						dniHash
					})
					.returning();
				const [profile] = await tx
					.insert(municipalityProfiles)
					.values({ municipalityId, userId: user.id, isResident: false })
					.returning();
				return {
					profileId: profile.id,
					userId: user.id,
					displayName: user.displayName,
					phone: user.phone
				};
			})
		);
	} catch (e) {
		if (dniHash !== null && isUniqueViolation(e, 'users_dni_hash_unique')) {
			return err('DNI_EXISTS');
		}
		throw e;
	}
}

/** Violación de la restricción única `constraint` (código 23505), también envuelta por drizzle. */
function isUniqueViolation(e: unknown, constraint: string): boolean {
	for (let cur = e as { code?: string; constraint?: string; cause?: unknown } | undefined; cur;) {
		if (cur.code === '23505') return cur.constraint === undefined || cur.constraint === constraint;
		cur = cur.cause as typeof cur;
	}
	return false;
}

/**
 * Perfil (no empadronado) de una persona en este concello, creado si falta: para reservar a quien
 * se encontró por DNI y solo tenía perfil en otro concello. NOT_FOUND si el usuario no existe.
 */
export async function ensureProfileForStaff(
	db: Db,
	municipalityId: string,
	userId: string
): Promise<Result<PersonOut, 'NOT_FOUND'>> {
	const [user] = await db
		.select({ id: users.id, displayName: users.displayName, phone: users.phone })
		.from(users)
		.where(eq(users.id, userId));
	if (!user) return err('NOT_FOUND');
	await db
		.insert(municipalityProfiles)
		.values({ municipalityId, userId, isResident: false })
		.onConflictDoNothing({
			target: [municipalityProfiles.municipalityId, municipalityProfiles.userId]
		});
	const [profile] = await db
		.select({ id: municipalityProfiles.id })
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.municipalityId, municipalityId),
				eq(municipalityProfiles.userId, userId)
			)
		);
	return ok({ profileId: profile.id, userId, displayName: user.displayName, phone: user.phone });
}

// ── DNI, empadronamiento y tarifa social (mostrador v1) ──────────────────────

export type DniPerson = {
	userId: string;
	displayName: string;
	profileId: string | null;
	isResident: boolean;
	socialTariff: SocialTariff | null;
};

export type DniLookup =
	| { status: 'found'; person: DniPerson }
	| { status: 'not_found'; suggestions: string[] }
	| { status: 'invalid' };

/** «Hadrián Seixo Mouriño» → «Hadrián S. M.»: lo que ve el personal de un concello sin su perfil. */
const maskName = (name: string) => {
	const [first, ...rest] = name.trim().split(/\s+/);
	return [first, ...rest.map((w) => `${w[0]}.`)].join(' ');
};

/**
 * Busca a una persona por su DNI/NIE completo (solo coincidencia exacta del hash). Un anaco o algo
 * sin forma de DNI es `invalid`; con la letra mal, `not_found` con las sugerencias aritméticas de
 * `dniSuggestions`. Si la persona no tiene perfil en este concello, sale sin perfil y con el
 * nombre abreviado: el nombre completo solo lo ve el personal de un concello donde tiene perfil.
 */
export async function findPersonByDni(
	db: Db,
	municipalityId: string,
	input: string,
	secret: string
): Promise<DniLookup> {
	const dni = normalizeDni(input);
	if (!dni) return { status: 'invalid' };
	if (!dniLetterOk(dni)) return { status: 'not_found', suggestions: dniSuggestions(dni) };
	const [row] = await db
		.select({
			userId: users.id,
			displayName: users.displayName,
			profileId: municipalityProfiles.id,
			isResident: municipalityProfiles.isResident,
			socialTariff: municipalityProfiles.socialTariff
		})
		.from(users)
		.leftJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.userId, users.id),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.where(eq(users.dniHash, hashDni(dni, secret)));
	if (!row) return { status: 'not_found', suggestions: [] };
	const hasProfile = row.profileId !== null;
	return {
		status: 'found',
		person: {
			userId: row.userId,
			displayName: hasProfile ? row.displayName : maskName(row.displayName),
			profileId: row.profileId,
			isResident: row.isResident ?? false,
			socialTariff: row.socialTariff ?? null
		}
	};
}

export type ResidencyOut = { id: string; isResident: boolean; residencyVerifiedAt: Date | null };

/**
 * El personal comprueba el empadronamiento: `is_resident`, cuándo y quién. Avisa a la persona
 * (`residency_verified`) solo si pasa a estar empadronada; repetirlo, o verificar a quien ya lo
 * estaba, solo anota la verificación. Perfil de otro concello: NOT_FOUND.
 */
export async function verifyResidency(
	db: Db,
	municipalityId: string,
	profileId: string,
	staffUserId: string,
	now: Date
): Promise<Result<ResidencyOut, 'NOT_FOUND'>> {
	const scope = and(
		eq(municipalityProfiles.id, profileId),
		eq(municipalityProfiles.municipalityId, municipalityId)
	);
	return db.transaction(async (tx): Promise<Result<ResidencyOut, 'NOT_FOUND'>> => {
		const [before] = await tx
			.select({
				userId: municipalityProfiles.userId,
				isResident: municipalityProfiles.isResident,
				verifiedAt: municipalityProfiles.residencyVerifiedAt
			})
			.from(municipalityProfiles)
			.where(scope)
			.for('update');
		if (!before) return err('NOT_FOUND');
		if (before.isResident && before.verifiedAt) {
			return ok({ id: profileId, isResident: true, residencyVerifiedAt: before.verifiedAt });
		}
		// Ya empadronada (sin verificación anotada): solo se anota; el precio no cambia, sin aviso.
		const changes = !before.isResident;
		const [row] = await tx
			.update(municipalityProfiles)
			.set({ isResident: true, residencyVerifiedAt: now, residencyVerifiedBy: staffUserId })
			.where(scope)
			.returning({
				id: municipalityProfiles.id,
				isResident: municipalityProfiles.isResident,
				residencyVerifiedAt: municipalityProfiles.residencyVerifiedAt
			});
		if (changes) {
			await notify(tx, {
				userId: before.userId,
				municipalityId,
				kind: 'residency_verified',
				params: {}
			});
		}
		return ok(row);
	});
}

/** Tarifa social del perfil (o null para quitarla). Solo la asigna el personal. */
export async function setSocialTariff(
	db: Db,
	municipalityId: string,
	profileId: string,
	tariff: SocialTariff | null
): Promise<Result<{ id: string; socialTariff: SocialTariff | null }, 'NOT_FOUND'>> {
	const [row] = await db
		.update(municipalityProfiles)
		.set({ socialTariff: tariff })
		.where(
			and(
				eq(municipalityProfiles.id, profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.returning({ id: municipalityProfiles.id, socialTariff: municipalityProfiles.socialTariff });
	return row ? ok(row) : err('NOT_FOUND');
}

export type PersonDetail = PersonOut & {
	isResident: boolean;
	socialTariff: SocialTariff | null;
	noShowCount: number;
	penaltyUntil: Date | null;
	/** Declaración da propia persoa e comprobación do persoal (null se non as hai). */
	residencyDeclaredAt: Date | null;
	residencyVerifiedAt: Date | null;
	/** Debuxo do catálogo e se ten foto propia (a foto sérvese en `/api/v1/users/{id}/avatar`). */
	avatar: { key: string | null; hasPhoto: boolean };
};

/** Persona con perfil en el concello (con faltas y penalización), o null si es de otro. */
export async function getPersonDetail(
	db: Db,
	municipalityId: string,
	profileId: string
): Promise<PersonDetail | null> {
	const [row] = await db
		.select({
			profileId: municipalityProfiles.id,
			userId: users.id,
			displayName: users.displayName,
			phone: users.phone,
			isResident: municipalityProfiles.isResident,
			socialTariff: municipalityProfiles.socialTariff,
			noShowCount: municipalityProfiles.noShowCount,
			penaltyUntil: municipalityProfiles.penaltyUntil,
			residencyDeclaredAt: municipalityProfiles.residencyDeclaredAt,
			residencyVerifiedAt: municipalityProfiles.residencyVerifiedAt,
			avatarKey: users.avatarKey,
			hasPhoto: sql<boolean>`${users.avatarPhoto} is not null`
		})
		.from(municipalityProfiles)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(
			and(
				eq(municipalityProfiles.id, profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		);
	if (!row) return null;
	const { avatarKey, hasPhoto, ...rest } = row;
	return { ...rest, avatar: { key: avatarKey, hasPhoto: Boolean(hasPhoto) } };
}

export type Receipt = {
	id: string;
	accessCode: string;
	facilityName: string;
	location: string;
	address: string;
	unitIndex: number | null;
	seats: number;
	startsAt: Date;
	endsAt: Date;
	priceCents: number;
	displayName: string;
	color: string;
	mascot: string;
};

/** Datos del justificante de una reserva del concello, o null (otro concello, no existe). */
export async function getBookingReceipt(
	db: Db,
	municipalityId: string,
	bookingId: string
): Promise<Receipt | null> {
	const [row] = await db
		.select({
			id: bookings.id,
			accessCode: bookings.accessCode,
			facilityName: facilities.name,
			location: facilities.location,
			address: facilities.address,
			unitIndex: bookings.unitIndex,
			seats: bookings.seats,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			priceCents: bookings.priceCents,
			displayName: users.displayName,
			color: facilityTypes.color,
			mascot: facilityTypes.mascot
		})
		.from(bookings)
		.innerJoin(
			facilities,
			and(eq(facilities.id, bookings.facilityId), eq(facilities.municipalityId, municipalityId))
		)
		.innerJoin(
			facilityTypes,
			and(eq(facilityTypes.id, facilities.typeId), eq(facilityTypes.municipalityId, municipalityId))
		)
		.innerJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.id, bookings.profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(and(eq(bookings.id, bookingId), eq(bookings.municipalityId, municipalityId)));
	return row ?? null;
}

// ── Personal del concello ────────────────────────────────────────────────────

export type StaffMember = {
	roleId: string;
	userId: string;
	displayName: string;
	role: 'admin' | 'conserxe' | 'apertura';
};

type MunicipalRole = StaffMember['role'];

const staffColumns = {
	roleId: staffRoles.id,
	userId: users.id,
	displayName: users.displayName,
	role: staffRoles.role
};

/** Roles `admin` y `conserxe` del concello (nunca el de deputación, que no tiene concello). */
export async function listStaff(db: Db, municipalityId: string): Promise<StaffMember[]> {
	const rows = await db
		.select(staffColumns)
		.from(staffRoles)
		.innerJoin(users, eq(users.id, staffRoles.userId))
		.where(
			and(
				eq(staffRoles.municipalityId, municipalityId),
				inArray(staffRoles.role, ['admin', 'conserxe', 'apertura'])
			)
		)
		.orderBy(asc(staffRoles.role), asc(users.displayName), asc(staffRoles.id));
	return rows as StaffMember[];
}

/**
 * Da un rol del concello. La persona debe tener perfil en este concello (Ruling 14: los
 * usuarios son compartidos entre concellos y no se reparten roles a quien no ha reservado
 * aquí); si no, NOT_FOUND. Repetir el mismo rol no duplica.
 */
export async function addStaff(
	db: Db,
	municipalityId: string,
	input: { userId: string; role: MunicipalRole; actorId?: string }
): Promise<Result<StaffMember, 'NOT_FOUND'>> {
	const [user] = await db
		.select({ id: users.id })
		.from(users)
		.innerJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.userId, users.id),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.where(eq(users.id, input.userId));
	if (!user) return err('NOT_FOUND');

	await db
		.insert(staffRoles)
		.values({ userId: user.id, municipalityId, role: input.role })
		.onConflictDoNothing();
	const [row] = await db
		.select(staffColumns)
		.from(staffRoles)
		.innerJoin(users, eq(users.id, staffRoles.userId))
		.where(
			and(
				eq(staffRoles.userId, user.id),
				eq(staffRoles.municipalityId, municipalityId),
				eq(staffRoles.role, input.role)
			)
		);
	if (input.actorId)
		await writeActivity(db, {
			municipalityId,
			actorId: input.actorId,
			kind: 'staff_added',
			params: { detalle: input.role }
		});
	return ok(row as StaffMember);
}

/**
 * Quita un rol del concello. Quitar el último admin da LAST_ADMIN. Bloquea las filas
 * de admin del concello (FOR UPDATE) para que dos bajas simultáneas no lo dejen sin ninguno.
 */
export async function removeStaff(
	db: Db,
	municipalityId: string,
	roleId: string,
	actorId?: string
): Promise<Result<{ roleId: string }, 'NOT_FOUND' | 'LAST_ADMIN'>> {
	return db.transaction(async (tx) => {
		const admins = await tx
			.select({ id: staffRoles.id })
			.from(staffRoles)
			.where(and(eq(staffRoles.municipalityId, municipalityId), eq(staffRoles.role, 'admin')))
			.for('update');
		const [role] = await tx
			.select({ id: staffRoles.id, role: staffRoles.role })
			.from(staffRoles)
			.where(
				and(
					eq(staffRoles.id, roleId),
					eq(staffRoles.municipalityId, municipalityId),
					inArray(staffRoles.role, ['admin', 'conserxe', 'apertura'])
				)
			);
		if (!role) return err('NOT_FOUND');
		if (role.role === 'admin' && admins.length <= 1) return err('LAST_ADMIN');
		await tx
			.delete(staffRoles)
			.where(and(eq(staffRoles.id, role.id), eq(staffRoles.municipalityId, municipalityId)));
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'staff_removed',
				params: { detalle: role.role }
			});
		return ok({ roleId: role.id });
	});
}

export type StaffCandidate = {
	userId: string;
	displayName: string;
	provider: 'clave' | 'chave365';
};

// Pares de `translate()` para comparar sin tildes en SQL (mismo efecto que `fold`).
const ACCENTED = 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç';
const PLAIN = 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc';

/**
 * Personas con perfil en este concello que entraron con Cl@ve o Chave365 y cuyo nombre contiene
 * `q` (sin mayúsculas ni tildes), máx. 20. Sirve para añadir personal sin pedir DNI (decisión 11).
 * Ruling 14: nunca salen usuarios de otros concellos ni personas locales.
 */
export async function searchStaffCandidates(
	db: Db,
	municipalityId: string,
	q: string
): Promise<StaffCandidate[]> {
	const needle = fold(q.trim()).replace(/[\\%_]/g, (c) => `\\${c}`);
	const rows = await db
		.select({ userId: users.id, displayName: users.displayName, provider: users.provider })
		.from(users)
		.innerJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.userId, users.id),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.where(
			and(
				inArray(users.provider, ['clave', 'chave365']),
				ilike(sql`translate(${users.displayName}, ${ACCENTED}, ${PLAIN})`, `%${needle}%`)
			)
		)
		.orderBy(asc(users.displayName), asc(users.id))
		.limit(MAX_PEOPLE);
	return rows as StaffCandidate[];
}
