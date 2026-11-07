// SPDX-License-Identifier: EUPL-1.2
// Portada en capas (tarefa 7): lo libre de hoy, la siguiente hora libre de cada deporte y el
// consejo de las horas tranquilas. Consultas acotadas: solo hoy (y mañana para los deportes sin
// hueco hoy) y, para el consejo, 8 semanas agregadas por instalación y hora.
import { and, eq, gt, gte, inArray, lt, lte, ne, sql } from 'drizzle-orm';
import type { Mascot } from '../../mascots';
import type { Db } from '../db/client';
import { bookings, closures, facilities, holidays } from '../db/schema';
import { addLocalDays, localDateOf, localTimeOf, weekdayOf } from '../domain/time';
import { localDayBounds } from './bookings';
import { freeOptions, listSports, type ClosedInfo, type FreeOption, type Sport } from './search';
import { closuresToday } from './closure-status';

/** Una tarjeta de «Libre agora mesmo»: la primera hora libre de hoy de un deporte. */
export type FreeNow = {
	typeId: string;
	nameGl: string;
	nameEs: string;
	mascot: Mascot;
	color: string;
	facilityName: string;
	location: string;
	startsAt: Date;
	/** 'HH:MM' local. */
	time: string;
};

/** Un deporte de la rejilla con su siguiente hora libre (hoy o mañana) o el peche que lo tapa. */
export type SportNext = {
	sport: Sport;
	next: { date: string; time: string } | null;
	closed: ClosedInfo | null;
};

/** «As horas tranquilas»: la hora de hoy que suele estar más vacía, con su porcentaje real. */
export type QuietTip = {
	typeId: string;
	nameGl: string;
	nameEs: string;
	mascot: Mascot;
	color: string;
	facilityName: string;
	/** 'HH:MM' local de hoy. */
	hour: string;
	/** Ocupación media de esa hora ese día de la semana en las últimas 8 semanas (0–100). */
	pct: number;
	/** Día de la semana de hoy, 0 = domingo (como las claves `semana.N`). */
	weekday: number;
};

export type HomeBoard = { sports: SportNext[] };

/** Semanas de historia que mira el consejo. */
const WEEKS = 8;
/** Por encima de esta ocupación media la hora no es «tranquila» y no hay consejo. */
const QUIET_MAX_PCT = 50;

type Today = { sport: Sport; options: FreeOption[] }[];

/** Las franjas reservables de hoy de cada deporte, desde `now` (las mismas reglas que reservar). */
async function loadToday(db: Db, municipalityId: string, now: Date): Promise<Today> {
	const sports = await listSports(db, municipalityId);
	const date = localDateOf(now);
	return Promise.all(
		sports.map(async (sport) => ({
			sport,
			options: await freeOptions(db, municipalityId, sport.typeId, date, null, now)
		}))
	);
}

function freeNowFrom(today: Today, limit: number): FreeNow[] {
	const cards: FreeNow[] = [];
	for (const { sport, options } of today) {
		const first = options[0];
		if (!first) continue;
		cards.push({
			typeId: sport.typeId,
			nameGl: sport.nameGl,
			nameEs: sport.nameEs,
			mascot: sport.mascot,
			color: sport.color,
			facilityName: first.facilityName,
			location: first.location,
			startsAt: first.startsAt,
			time: localTimeOf(first.startsAt)
		});
	}
	return cards
		.sort(
			(a, b) =>
				a.startsAt.getTime() - b.startsAt.getTime() || a.nameGl.localeCompare(b.nameGl, 'gl')
		)
		.slice(0, limit);
}

/** Peche vigente ahora que tapa todas las instalaciones activas del tipo; si no, null. */
async function closedNow(
	db: Db,
	municipalityId: string,
	typeIds: string[],
	now: Date
): Promise<Map<string, ClosedInfo>> {
	const out = new Map<string, ClosedInfo>();
	if (typeIds.length === 0) return out;
	const date = localDateOf(now);
	const [holiday] = await db
		.select({ name: holidays.name, mode: holidays.mode })
		.from(holidays)
		.where(and(eq(holidays.municipalityId, municipalityId), eq(holidays.date, date)));
	if (holiday?.mode === 'closed') {
		for (const typeId of typeIds)
			out.set(typeId, { reason: holiday.name, startsOn: date, endsOn: date, holiday: true });
		return out;
	}
	const rows = await db
		.select({ facilityId: facilities.id, typeId: facilities.typeId, reason: closures.reason })
		.from(facilities)
		.leftJoin(
			closures,
			and(
				eq(closures.facilityId, facilities.id),
				eq(closures.kind, 'peche'),
				lte(closures.startsAt, now),
				gt(closures.endsAt, now)
			)
		)
		.where(
			and(
				eq(facilities.municipalityId, municipalityId),
				eq(facilities.active, true),
				inArray(facilities.typeId, typeIds)
			)
		);
	const byFacility = await closuresToday(
		db,
		rows.map((r) => r.facilityId),
		date
	);
	for (const typeId of typeIds) {
		const own = rows.filter((r) => r.typeId === typeId);
		const open = own.some((r) => r.reason === null);
		if (own.length > 0 && !open) {
			const closure = byFacility.get(own[0].facilityId);
			if (closure) out.set(typeId, { reason: own[0].reason ?? '', ...closure });
		}
	}
	return out;
}

async function nextFrom(
	db: Db,
	municipalityId: string,
	now: Date,
	today: Today
): Promise<SportNext[]> {
	const date = localDateOf(now);
	const tomorrow = addLocalDays(date, 1);
	const out: SportNext[] = await Promise.all(
		today.map(async ({ sport, options }) => {
			const first =
				options[0] ?? (await freeOptions(db, municipalityId, sport.typeId, tomorrow, null, now))[0];
			return {
				sport,
				next: first
					? { date: localDateOf(first.startsAt), time: localTimeOf(first.startsAt) }
					: null,
				closed: null
			};
		})
	);
	const empty = out.filter((s) => s.next === null).map((s) => s.sport.typeId);
	const shut = await closedNow(db, municipalityId, empty, now);
	for (const s of out) s.closed = shut.get(s.sport.typeId) ?? null;
	return out;
}

async function quietFrom(
	db: Db,
	municipalityId: string,
	now: Date,
	today: Today
): Promise<QuietTip | null> {
	// Candidatas: instalación + hora reservable hoy (en modo día la hora no tiene sentido).
	const candidates = new Map<string, { sport: Sport; option: FreeOption; time: string }>();
	for (const { sport, options } of today) {
		if (sport.bookingMode === 'day') continue;
		for (const option of options) {
			const time = localTimeOf(option.startsAt);
			const key = `${option.facilityId} ${time}`;
			if (!candidates.has(key)) candidates.set(key, { sport, option, time });
		}
	}
	if (candidates.size === 0) return null;

	const ids = [...new Set([...candidates.values()].map((c) => c.option.facilityId))];
	const date = localDateOf(now);
	const from = localDayBounds(addLocalDays(date, -7 * WEEKS)).dayStart;
	const to = localDayBounds(date).dayStart;
	const local = sql`(${bookings.startsAt} at time zone 'Europe/Madrid')`;
	const hhmm = sql<string>`to_char(${local}, 'HH24:MI')`;
	const [usage, sizes] = await Promise.all([
		// Agregado por instalación y hora, solo el mismo día de la semana: lo resuelve el índice
		// (facility_id, starts_at) con el rango de 8 semanas.
		db
			.select({
				facilityId: bookings.facilityId,
				hhmm,
				count: sql<number>`count(*)::int`,
				seats: sql<number>`sum(${bookings.seats})::int`
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, municipalityId),
					inArray(bookings.facilityId, ids),
					gte(bookings.startsAt, from),
					lt(bookings.startsAt, to),
					ne(bookings.status, 'cancelled'),
					sql`extract(isodow from ${local}) = ${weekdayOf(date) + 1}`
				)
			)
			.groupBy(bookings.facilityId, hhmm),
		db
			.select({ id: facilities.id, units: facilities.units, capacity: facilities.capacity })
			.from(facilities)
			.where(and(eq(facilities.municipalityId, municipalityId), inArray(facilities.id, ids)))
	]);
	const used = new Map(usage.map((u) => [`${u.facilityId} ${u.hhmm}`, u]));
	const size = new Map(sizes.map((s) => [s.id, s]));

	let best: { pct: number; c: { sport: Sport; option: FreeOption; time: string } } | null = null;
	for (const [key, c] of candidates) {
		const u = used.get(key);
		const f = size.get(c.option.facilityId);
		const mode = c.sport.bookingMode;
		const per = mode === 'unit' ? (f?.units ?? 1) : mode === 'capacity' ? (f?.capacity ?? 1) : 1;
		const taken = u ? (mode === 'capacity' ? u.seats : u.count) : 0;
		const pct = Math.min(100, Math.round((100 * taken) / (WEEKS * Math.max(1, per))));
		if (
			!best ||
			pct < best.pct ||
			(pct === best.pct &&
				(c.time < best.c.time ||
					(c.time === best.c.time &&
						c.option.facilityName.localeCompare(best.c.option.facilityName, 'gl') < 0)))
		) {
			best = { pct, c };
		}
	}
	if (!best || best.pct > QUIET_MAX_PCT) return null;
	const { sport, option, time } = best.c;
	const [y, m, d] = date.split('-').map(Number);
	return {
		typeId: sport.typeId,
		nameGl: sport.nameGl,
		nameEs: sport.nameEs,
		mascot: sport.mascot,
		color: sport.color,
		facilityName: option.facilityName,
		hour: time,
		pct: best.pct,
		weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay()
	};
}

// ── API ──────────────────────────────────────────────────────────────────────

/** Las siguientes franjas libres desde ahora hasta el final de hoy, una por deporte. */
export async function freeNow(
	db: Db,
	municipalityId: string,
	now: Date,
	limit = 4
): Promise<FreeNow[]> {
	return freeNowFrom(await loadToday(db, municipalityId, now), limit);
}

/** Cada deporte con su siguiente hora libre (hoy o mañana) o el peche vigente que lo tapa. */
export async function nextFreeBySport(
	db: Db,
	municipalityId: string,
	now: Date
): Promise<SportNext[]> {
	return nextFrom(db, municipalityId, now, await loadToday(db, municipalityId, now));
}

/**
 * La hora que queda hoy con la menor ocupación media en las 8 semanas anteriores, el mismo día
 * de la semana, o null si no hay ninguna «tranquila». Sin IA: cuenta reservas.
 */
export async function quietHourTip(
	db: Db,
	municipalityId: string,
	now: Date
): Promise<QuietTip | null> {
	return quietFrom(db, municipalityId, now, await loadToday(db, municipalityId, now));
}

/** Todo lo de la portada con una sola carga de hoy. */
export async function homeBoard(db: Db, municipalityId: string, now: Date): Promise<HomeBoard> {
	const today = await loadToday(db, municipalityId, now);
	return { sports: await nextFrom(db, municipalityId, now, today) };
}
