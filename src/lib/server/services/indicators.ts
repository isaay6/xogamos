// SPDX-License-Identifier: EUPL-1.2
import { and, eq, gt, gte, inArray, lt, lte } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	openingHours,
	seasonBookings
} from '../db/schema';
import {
	computeIndicators,
	type FacilityIndicators,
	type IndicatorBooking,
	type IndicatorFacility,
	type IndicatorSeason,
	type PeakHour
} from '../domain/indicators';
import { seasonOccurrence } from '../domain/seasons';
import { generateSlots } from '../domain/slots';
import { addLocalDays } from '../domain/time';
import { localDayBounds } from './bookings';

export type Indicators = { byFacility: FacilityIndicators[]; peakHours: PeakHour[] };

/** Días de calendario entre dos fechas locales, ambas incluidas. */
export function daysInRange(from: string, to: string): string[] {
	const days: string[] = [];
	for (let d = from; d <= to; d = addLocalDays(d, 1)) days.push(d);
	return days;
}

type IndicatorInput = {
	facilities: IndicatorFacility[];
	bookings: IndicatorBooking[];
	seasons: IndicatorSeason[];
};

/**
 * Instalaciones activas del concello con sus franjas ofertadas (horario menos cierres, día a
 * día con `generateSlots`), las reservas que empiezan entre `from` y `to` (ambos incluidos) y lo
 * que ocupan las temporadas en esas franjas (cada ocurrencia recortada a cada franja abierta: un
 * cierre o una hora sin abrir no cuentan).
 */
export async function loadIndicatorInput(
	db: Db,
	municipalityId: string,
	from: string,
	to: string
): Promise<IndicatorInput> {
	const start = localDayBounds(from).dayStart;
	const end = localDayBounds(to).dayEnd;
	const rows = await db
		.select({ facility: facilities, bookingMode: facilityTypes.bookingMode })
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.where(eq(facilities.municipalityId, municipalityId))
		.orderBy(facilities.name);
	if (rows.length === 0) return { facilities: [], bookings: [], seasons: [] };
	const allIds = rows.map((r) => r.facility.id);

	// Decisión 2: lo que pasó, pasó. Una instalación desactivada después cuenta si tuvo
	// reservas en el rango; las desactivadas sin reservas no aparecen.
	const used = new Set(
		(
			await db
				.selectDistinct({ facilityId: bookings.facilityId })
				.from(bookings)
				.where(
					and(
						eq(bookings.municipalityId, municipalityId),
						inArray(bookings.facilityId, allIds),
						gte(bookings.startsAt, start),
						lt(bookings.startsAt, end)
					)
				)
		).map((r) => r.facilityId)
	);
	const kept = rows.filter((r) => r.facility.active || used.has(r.facility.id));
	const ids = kept.map((r) => r.facility.id);
	if (ids.length === 0) return { facilities: [], bookings: [], seasons: [] };

	const [hours, rangeClosures, rangeBookings, rangeSeasons] = await Promise.all([
		db
			.select({
				facilityId: openingHours.facilityId,
				weekday: openingHours.weekday,
				opens: openingHours.opens,
				closes: openingHours.closes
			})
			.from(openingHours)
			.where(inArray(openingHours.facilityId, ids)),
		db
			.select({
				facilityId: closures.facilityId,
				startsAt: closures.startsAt,
				endsAt: closures.endsAt
			})
			.from(closures)
			.where(
				and(
					inArray(closures.facilityId, ids),
					lt(closures.startsAt, end),
					gt(closures.endsAt, start)
				)
			),
		db
			.select({
				facilityId: bookings.facilityId,
				startsAt: bookings.startsAt,
				endsAt: bookings.endsAt,
				seats: bookings.seats,
				unitIndex: bookings.unitIndex,
				status: bookings.status
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, municipalityId),
					inArray(bookings.facilityId, ids),
					gte(bookings.startsAt, start),
					lt(bookings.startsAt, end)
				)
			),
		db
			.select()
			.from(seasonBookings)
			.where(
				and(
					eq(seasonBookings.municipalityId, municipalityId),
					inArray(seasonBookings.facilityId, ids),
					lte(seasonBookings.fromDate, to),
					gte(seasonBookings.toDate, from)
				)
			)
	]);

	const days = daysInRange(from, to);
	const out: IndicatorInput = { facilities: [], bookings: rangeBookings, seasons: [] };
	for (const { facility: f, bookingMode } of kept) {
		const openSlots = days.flatMap((date) =>
			generateSlots({
				date,
				slotMinutes: f.slotMinutes,
				hours: hours.filter((h) => h.facilityId === f.id),
				closures: rangeClosures.filter((c) => c.facilityId === f.id),
				bookingMode
			})
		);
		out.facilities.push({
			id: f.id,
			name: f.name,
			mode: bookingMode,
			units: f.units,
			capacity: f.capacity,
			openSlots
		});
		for (const season of rangeSeasons.filter((s) => s.facilityId === f.id)) {
			for (const date of days) {
				const occ = seasonOccurrence(season, date);
				if (!occ) continue;
				for (const slot of openSlots) {
					const s = Math.max(slot.startsAt.getTime(), occ.startsAt.getTime());
					const e = Math.min(slot.endsAt.getTime(), occ.endsAt.getTime());
					if (s < e) {
						out.seasons.push({
							facilityId: f.id,
							startsAt: new Date(s),
							endsAt: new Date(e),
							unitIndex: bookingMode === 'unit' ? season.unitIndex : null
						});
					}
				}
			}
		}
	}
	return out;
}

export async function municipalityIndicators(
	db: Db,
	municipalityId: string,
	from: string,
	to: string
): Promise<Indicators> {
	return computeIndicators(await loadIndicatorInput(db, municipalityId, from, to));
}

/** Ocupación por instalación y día (de `from` a `to`, ambos incluidos). Sin datos personales. */
export async function occupancyByDay(
	db: Db,
	municipalityId: string,
	from: string,
	to: string
): Promise<{ facilityId: string; name: string; days: { date: string; occupancy: number }[] }[]> {
	const input = await loadIndicatorInput(db, municipalityId, from, to);
	const perDay = daysInRange(from, to).map((date) => {
		const { dayStart, dayEnd } = localDayBounds(date);
		const inDay = (t: Date) => t >= dayStart && t < dayEnd;
		return {
			date,
			result: computeIndicators({
				facilities: input.facilities.map((f) => ({
					...f,
					openSlots: f.openSlots.filter((s) => inDay(s.startsAt))
				})),
				bookings: input.bookings.filter((b) => inDay(b.startsAt)),
				seasons: input.seasons.filter((s) => inDay(s.startsAt))
			})
		};
	});
	return input.facilities.map((f) => ({
		facilityId: f.id,
		name: f.name,
		days: perDay.map((d) => ({
			date: d.date,
			occupancy: d.result.byFacility.find((x) => x.facilityId === f.id)?.occupancy ?? 0
		}))
	}));
}

/** Personaje y color del tipo de cada instalación del concello (para las barras). */
export async function facilityLooks(
	db: Db,
	municipalityId: string
): Promise<Map<string, { mascot: string; color: string }>> {
	const rows = await db
		.select({ id: facilities.id, mascot: facilityTypes.mascot, color: facilityTypes.color })
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.where(eq(facilities.municipalityId, municipalityId));
	return new Map(rows.map((r) => [r.id, { mascot: r.mascot, color: r.color }]));
}

export type Summary = {
	/** Media de la ocupación de las instalaciones (0–1). */
	occupancy: number;
	bookings: number;
	/** Ausencias ÷ reservas (0–1). */
	noShowRate: number;
	/** Franja de dos horas con más reservas (`{ from: 19, to: 21 }`), o null sin reservas. */
	peak: { from: number; to: number } | null;
};

/** Media de la ocupación de las instalaciones con oferta en el periodo (las cerradas no cuentan). */
export function meanOccupancy(byFacility: FacilityIndicators[]): number {
	const open = byFacility.filter((x) => x.open);
	return open.length > 0 ? open.reduce((n, x) => n + x.occupancy, 0) / open.length : 0;
}

/** Las cuatro cifras del resumen a partir de los indicadores. */
export function summarize(ind: Indicators): Summary {
	const f = ind.byFacility;
	const bookingsTotal = f.reduce((n, x) => n + x.bookings, 0);
	const noShows = f.reduce((n, x) => n + x.noShows, 0);
	const perHour = new Map<number, number>();
	for (const p of ind.peakHours) perHour.set(p.hour, (perHour.get(p.hour) ?? 0) + p.bookings);
	let peak: Summary['peak'] = null;
	let best = 0;
	for (const hour of [...perHour.keys()].sort((a, b) => a - b)) {
		const n = (perHour.get(hour) ?? 0) + (perHour.get(hour + 1) ?? 0);
		if (n > best) {
			best = n;
			peak = { from: hour, to: hour + 2 };
		}
	}
	return {
		occupancy: meanOccupancy(f),
		bookings: bookingsTotal,
		noShowRate: bookingsTotal > 0 ? noShows / bookingsTotal : 0,
		peak
	};
}
