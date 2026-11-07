// SPDX-License-Identifier: EUPL-1.2
// Búsqueda por deporte: tira de días, horas del día, lo libre y alternativas.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { MASCOT_FAMILY, MASCOTS, type Mascot } from '../../mascots';
import type { Db } from '../db/client';
import {
	closures,
	facilities,
	facilityTypes,
	holidays,
	municipalities,
	openingHours,
	type FacilityRow
} from '../db/schema';
import type { SlotAvailability } from '../domain/availability';
import { generateSlots } from '../domain/slots';
import { addLocalDays, localDateOf as localDateOfInstant, TZ } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { loadDayAvailability, localDateOf, localDayBounds } from './bookings';

export type Sport = {
	typeId: string;
	nameGl: string;
	nameEs: string;
	mascot: Mascot;
	color: string;
	bookingMode: BookingMode;
};

/** Peche do concello que tapa o día ou a hora; `reason` é o texto que escribiu o concello. */
export type ClosedInfo = { reason: string; startsOn: string; endsOn: string; holiday?: true };

/** `closed`: o día non ten ningunha franxa aberta por un peche (non porque estea cheo). */
export type DayStatus = { date: string; full: boolean; closed?: ClosedInfo };

/** `closed`: ningunha instalación do tipo abre a esa hora por un peche. */
export type HourStatus = {
	time: string;
	free: boolean;
	remainingSeats: number | null;
	closed?: ClosedInfo;
	/** A hora de hoxe xa rematou. */
	past?: boolean;
};

export type FreeOption = {
	facilityId: string;
	facilityName: string;
	location: string;
	address: string;
	accessInfo: string;
	accessInfoEs: string | null;
	unitIndex: number | null;
	remainingSeats: number | null;
	startsAt: Date;
	endsAt: Date;
	priceResidentCents: number;
	priceNonResidentCents: number;
	priceSocialCents: number | null;
};

/** Ficha de accesibilidade, cargada só nas pantallas que a amosan. */
export type AccessibilitySheet = {
	stepFreeAccess: 'yes' | 'no' | 'partial' | null;
	adaptedToilet: boolean | null;
	adaptedChangingRoom: boolean | null;
	accessibleParkingNearby: boolean | null;
	hearingLoop: boolean | null;
	supportContact: string | null;
	accessibilityNotes: string | null;
	accessibilityCheckedAt: string | null;
};

export type Alternative = {
	kind: 'same_day' | 'other_day' | 'similar_sport';
	typeId: string;
	date: string;
	time: string | null;
	count: number;
};

const MASCOT_ORDER = new Map<string, number>(MASCOTS.map((m, i) => [m, i]));

/** 'HH:MM' local (Europe/Madrid) de un instante. */
const localTimeOf = (d: Date) => format(new TZDate(d.getTime(), TZ), 'HH:mm');

const minutesOf = (hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

// ── Deportes ─────────────────────────────────────────────────────────────────

/** Tipos con al menos una instalación activa, en orden del catálogo y luego por `nameGl`. */
export async function listSports(db: Db, municipalityId: string): Promise<Sport[]> {
	const rows = await db
		.selectDistinct({
			typeId: facilityTypes.id,
			nameGl: facilityTypes.nameGl,
			nameEs: facilityTypes.nameEs,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			bookingMode: facilityTypes.bookingMode
		})
		.from(facilityTypes)
		.innerJoin(
			facilities,
			and(
				eq(facilities.typeId, facilityTypes.id),
				eq(facilities.municipalityId, facilityTypes.municipalityId)
			)
		)
		.where(and(eq(facilityTypes.municipalityId, municipalityId), eq(facilities.active, true)));
	return rows.sort(
		(a, b) =>
			(MASCOT_ORDER.get(a.mascot) ?? MASCOTS.length) -
				(MASCOT_ORDER.get(b.mascot) ?? MASCOTS.length) || a.nameGl.localeCompare(b.nameGl, 'gl')
	);
}

// ── Carga del tipo y del día ─────────────────────────────────────────────────

type TypeContext = {
	typeId: string;
	bookingMode: BookingMode;
	mascot: Mascot;
	maxDaysAhead: number;
	facilities: FacilityRow[];
};

/**
 * Una sola consulta: instalaciones activas del tipo, con el modo de reserva y la
 * ventana del concello. `null` si el tipo no es del concello o no tiene instalaciones activas.
 */
async function loadType(
	db: Db,
	municipalityId: string,
	typeId: string
): Promise<TypeContext | null> {
	const rows = await db
		.select({
			facility: facilities,
			bookingMode: facilityTypes.bookingMode,
			mascot: facilityTypes.mascot,
			maxDaysAhead: municipalities.maxDaysAhead
		})
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
		.where(
			and(
				eq(facilities.municipalityId, municipalityId),
				eq(facilities.typeId, typeId),
				eq(facilities.active, true)
			)
		);
	if (rows.length === 0) return null;
	return {
		typeId,
		bookingMode: rows[0].bookingMode,
		mascot: rows[0].mascot,
		maxDaysAhead: rows[0].maxDaysAhead,
		facilities: rows.map((r) => r.facility)
	};
}

type DaySlot = { facility: FacilityRow; slot: SlotAvailability; time: string; bookable: boolean };

/**
 * Franjas del día de todas las instalaciones del tipo. `bookable`: libre, aún no
 * empezada y dentro de la ventana de reserva (las mismas reglas que `createBooking`).
 */
async function loadDay(db: Db, ctx: TypeContext, date: string, now: Date): Promise<DaySlot[]> {
	// Mismo criterio que `withinBookingWindow`: ya empezada o más allá de hoy + maxDaysAhead.
	const lastDate = addLocalDays(localDateOf(now), ctx.maxDaysAhead);
	const perFacility = await Promise.all(
		ctx.facilities.map(async (facility) => {
			const slots = await loadDayAvailability(db, facility, ctx.bookingMode, date);
			return slots.map((slot) => ({
				facility,
				slot,
				time: localTimeOf(slot.startsAt),
				bookable:
					slot.free &&
					slot.startsAt.getTime() > now.getTime() &&
					localDateOf(slot.startsAt) <= lastDate
			}));
		})
	);
	return perFacility.flat();
}

/** Días locales de la ventana: hoy … hoy + maxDaysAhead, ambos incluidos. */
function windowDates(ctx: TypeContext, now: Date): string[] {
	const today = localDateOf(now);
	return Array.from({ length: ctx.maxDaysAhead + 1 }, (_, i) => addLocalDays(today, i));
}

type ClosureRow = {
	facilityId: string;
	startsAt: Date;
	endsAt: Date;
	reason: string;
	kind: 'peche' | 'evento';
	title: string | null;
};

type HolidayRow = { date: string; name: string; mode: 'closed' | 'sunday_hours' };

async function loadHolidays(
	db: Db,
	municipalityId: string,
	dates: string[]
): Promise<HolidayRow[]> {
	if (dates.length === 0) return [];
	return db
		.select({ date: holidays.date, name: holidays.name, mode: holidays.mode })
		.from(holidays)
		.where(and(eq(holidays.municipalityId, municipalityId), inArray(holidays.date, dates)));
}

/** Peches das instalacións do tipo que tocan [from, to); unha consulta, polo índice da instalación. */
async function loadClosures(db: Db, ctx: TypeContext, from: Date, to: Date): Promise<ClosureRow[]> {
	return db
		.select({
			facilityId: closures.facilityId,
			startsAt: closures.startsAt,
			endsAt: closures.endsAt,
			reason: closures.reason,
			kind: closures.kind,
			title: closures.title
		})
		.from(closures)
		.where(
			and(
				inArray(
					closures.facilityId,
					ctx.facilities.map((f) => f.id)
				),
				lt(closures.startsAt, to),
				gt(closures.endsAt, from)
			)
		)
		.orderBy(closures.startsAt);
}

const touches = (c: { startsAt: Date; endsAt: Date }, from: Date, to: Date) =>
	c.startsAt < to && from < c.endsAt;

/** Datas locais inclusivas que se amosan para un peche que toca este día. */
function closureDates(closure: ClosureRow, date: string) {
	return {
		startsOn: date,
		endsOn: localDateOfInstant(new Date(closure.endsAt.getTime() - 1))
	};
}

/**
 * Horas do día que taparía un peche: as franxas do horario (sen peches) que se solapan cun
 * peche da súa instalación, co motivo do primeiro. Só mira as instalacións con peches ese día.
 */
async function closedTimes(
	db: Db,
	ctx: TypeContext,
	date: string,
	dayClosures: ClosureRow[]
): Promise<Map<string, ClosedInfo>> {
	const out = new Map<string, ClosedInfo>();
	const ids = [...new Set(dayClosures.map((c) => c.facilityId))];
	if (ids.length === 0) return out;
	const hours = await db
		.select({
			facilityId: openingHours.facilityId,
			weekday: openingHours.weekday,
			opens: openingHours.opens,
			closes: openingHours.closes
		})
		.from(openingHours)
		.where(inArray(openingHours.facilityId, ids));
	for (const facility of ctx.facilities.filter((f) => ids.includes(f.id))) {
		const own = dayClosures.filter((c) => c.facilityId === facility.id);
		const slots = generateSlots({
			date,
			slotMinutes: facility.slotMinutes,
			hours: hours.filter((h) => h.facilityId === facility.id),
			closures: [],
			bookingMode: ctx.bookingMode
		});
		for (const slot of slots) {
			const hit = own.find((c) => touches(c, slot.startsAt, slot.endsAt));
			const time = localTimeOf(slot.startsAt);
			if (hit && !out.has(time))
				out.set(time, {
					reason: hit.kind === 'evento' ? `Evento: ${hit.title ?? ''}` : hit.reason,
					...closureDates(hit, date)
				});
		}
	}
	return out;
}

function optionsOf(ctx: TypeContext, day: DaySlot[], time: string | null): FreeOption[] {
	// En modo `day` la franja es el día entero: la hora no filtra.
	const matchTime = ctx.bookingMode === 'day' ? null : time;
	const options: FreeOption[] = [];
	for (const { facility, slot, time: t, bookable } of day) {
		if (!bookable || (matchTime !== null && t !== matchTime)) continue;
		const base = {
			facilityId: facility.id,
			facilityName: facility.name,
			location: facility.location,
			address: facility.address,
			accessInfo: facility.accessInfo,
			accessInfoEs: facility.accessInfoEs,
			startsAt: slot.startsAt,
			endsAt: slot.endsAt,
			priceResidentCents: facility.priceResidentCents,
			priceNonResidentCents: facility.priceNonResidentCents,
			priceSocialCents: facility.priceSocialCents
		};
		if (ctx.bookingMode === 'unit') {
			for (const unitIndex of slot.freeUnits) {
				options.push({ ...base, unitIndex, remainingSeats: null });
			}
		} else if (ctx.bookingMode === 'capacity') {
			options.push({ ...base, unitIndex: null, remainingSeats: slot.remainingSeats });
		} else {
			options.push({ ...base, unitIndex: null, remainingSeats: null });
		}
	}
	return options.sort(
		(a, b) =>
			a.startsAt.getTime() - b.startsAt.getTime() ||
			a.location.localeCompare(b.location, 'gl') ||
			a.facilityName.localeCompare(b.facilityName, 'gl') ||
			(a.unitIndex ?? 0) - (b.unitIndex ?? 0)
	);
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Una entrada por día de la ventana; `full` si ninguna instalación tiene franja reservable.
 * `closed` si ese día no queda ninguna franja abierta y un peche lo toca: la piscina «Pechada
 * ata o verán» no sale como «completo».
 */
export async function dayStrip(
	db: Db,
	municipalityId: string,
	typeId: string,
	now: Date
): Promise<DayStatus[]> {
	const ctx = await loadType(db, municipalityId, typeId);
	if (!ctx) return [];
	const dates = windowDates(ctx, now);
	const from = localDayBounds(dates[0]).dayStart;
	const to = localDayBounds(dates[dates.length - 1]).dayEnd;
	const [shut, holidayRows] = await Promise.all([
		loadClosures(db, ctx, from, to),
		loadHolidays(db, municipalityId, dates)
	]);
	const holidayByDate = new Map(holidayRows.map((holiday) => [holiday.date, holiday]));
	return Promise.all(
		dates.map(async (date) => {
			const day = await loadDay(db, ctx, date, now);
			const status: DayStatus = { date, full: !day.some((s) => s.bookable) };
			// Un peche da instalación explica máis ca o festivo: gaña o seu motivo.
			if (day.length === 0) {
				const { dayStart, dayEnd } = localDayBounds(date);
				const hit = shut.find((c) => touches(c, dayStart, dayEnd));
				if (hit)
					status.closed = {
						reason: hit.kind === 'evento' ? `Evento: ${hit.title ?? ''}` : hit.reason,
						...closureDates(hit, date)
					};
			}
			const holiday = holidayByDate.get(date);
			if (holiday?.mode === 'closed' && !status.closed) {
				status.closed = { reason: holiday.name, startsOn: date, endsOn: date, holiday: true };
			}
			return status;
		})
	);
}

/** Unión de las horas de inicio locales del tipo. En modo `day`, `[]`. */
export async function hoursForDay(
	db: Db,
	municipalityId: string,
	typeId: string,
	date: string,
	now: Date
): Promise<HourStatus[]> {
	const ctx = await loadType(db, municipalityId, typeId);
	if (!ctx || ctx.bookingMode === 'day') return [];
	const capacity = ctx.bookingMode === 'capacity';
	const { dayStart, dayEnd } = localDayBounds(date);
	const [day, shut] = await Promise.all([
		loadDay(db, ctx, date, now),
		loadClosures(db, ctx, dayStart, dayEnd)
	]);
	const [holiday] = await loadHolidays(db, municipalityId, [date]);
	if (holiday?.mode === 'closed') return [];
	const byTime = new Map<string, HourStatus>();
	for (const { slot, time, bookable } of day) {
		const h = byTime.get(time) ?? { time, free: false, remainingSeats: capacity ? 0 : null };
		if (!bookable && slot.startsAt.getTime() <= now.getTime()) h.past = true;
		if (bookable) {
			h.free = true;
			if (capacity) h.remainingSeats = (h.remainingSeats ?? 0) + slot.remainingSeats;
		}
		byTime.set(time, h);
	}
	// Una hora que ninguna instalación abre por un peche sale «pechada», con su motivo.
	for (const [time, closed] of await closedTimes(db, ctx, date, shut)) {
		const current = byTime.get(time);
		if (!current) {
			byTime.set(time, { time, free: false, remainingSeats: capacity ? 0 : null, closed });
		} else if (!current.free) {
			current.closed = closed;
		}
	}
	return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** Opciones reservables del día; `time = null` es «calquera hora». */
export async function freeOptions(
	db: Db,
	municipalityId: string,
	typeId: string,
	date: string,
	time: string | null,
	now: Date
): Promise<FreeOption[]> {
	const ctx = await loadType(db, municipalityId, typeId);
	if (!ctx) return [];
	return optionsOf(ctx, await loadDay(db, ctx, date, now), time);
}

/** Fichas de accesibilidade das instalacións dunha lista de opcións. */
export async function accessibilitySheets(
	db: Db,
	municipalityId: string,
	facilityIds: string[]
): Promise<Map<string, AccessibilitySheet>> {
	if (facilityIds.length === 0) return new Map();
	const rows = await db
		.select({
			facilityId: facilities.id,
			stepFreeAccess: facilities.stepFreeAccess,
			adaptedToilet: facilities.adaptedToilet,
			adaptedChangingRoom: facilities.adaptedChangingRoom,
			accessibleParkingNearby: facilities.accessibleParkingNearby,
			hearingLoop: facilities.hearingLoop,
			supportContact: facilities.supportContact,
			accessibilityNotes: facilities.accessibilityNotes,
			accessibilityCheckedAt: facilities.accessibilityCheckedAt
		})
		.from(facilities)
		.where(and(eq(facilities.municipalityId, municipalityId), inArray(facilities.id, facilityIds)));
	return new Map(rows.map(({ facilityId, ...sheet }) => [facilityId, sheet]));
}

/**
 * Hasta 3 alternativas, una de cada clase y en este orden: misma día a la hora
 * libre más cercana (empate: la anterior), siguiente día de la ventana y deporte
 * parecido (misma familia, nunca `outro`) ese día a esa hora.
 */
export async function alternatives(
	db: Db,
	municipalityId: string,
	typeId: string,
	date: string,
	time: string | null,
	now: Date
): Promise<Alternative[]> {
	const ctx = await loadType(db, municipalityId, typeId);
	if (!ctx) return [];
	const result: Alternative[] = [];

	// 1. Mismo día.
	const sameDay = optionsOf(ctx, await loadDay(db, ctx, date, now), null);
	const counts = new Map<string, number>();
	for (const o of sameDay) {
		const t = localTimeOf(o.startsAt);
		counts.set(t, (counts.get(t) ?? 0) + 1);
	}
	const freeTimes = [...counts.keys()].sort();
	const candidates = time === null ? freeTimes : freeTimes.filter((t) => t !== time);
	const target = time === null ? null : minutesOf(time);
	const best =
		target === null
			? candidates[0]
			: candidates.reduce<string | undefined>((acc, t) => {
					if (acc === undefined) return t;
					// Orden ascendente: con empate se queda la anterior.
					return Math.abs(minutesOf(t) - target) < Math.abs(minutesOf(acc) - target) ? t : acc;
				}, undefined);
	if (best !== undefined) {
		result.push({ kind: 'same_day', typeId, date, time: best, count: counts.get(best) ?? 0 });
	}

	// 2. Siguiente día de la ventana con la misma hora (o cualquiera) libre.
	for (const d of windowDates(ctx, now).filter((x) => x > date)) {
		const options = optionsOf(ctx, await loadDay(db, ctx, d, now), time);
		if (options.length > 0) {
			result.push({ kind: 'other_day', typeId, date: d, time, count: options.length });
			break;
		}
	}

	// 3. Deporte parecido.
	const family = MASCOT_FAMILY[ctx.mascot];
	if (family !== 'outro') {
		const similar = (await listSports(db, municipalityId)).filter(
			(s) => s.typeId !== typeId && MASCOT_FAMILY[s.mascot] === family
		);
		for (const s of similar) {
			const options = await freeOptions(db, municipalityId, s.typeId, date, time, now);
			if (options.length > 0) {
				result.push({ kind: 'similar_sport', typeId: s.typeId, date, time, count: options.length });
				break;
			}
		}
	}
	return result;
}
