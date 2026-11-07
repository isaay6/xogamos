// SPDX-License-Identifier: EUPL-1.2
import { TZDate } from '@date-fns/tz';
import { TZ } from './time';
import type { BookingMode, Slot } from './types';

/** Una instalación con menos ocupación que esto se considera infrautilizada. */
export const UNDERUSED_BELOW = 0.2;

const MIN = 60_000;

export type IndicatorFacility = {
	id: string;
	name: string;
	mode: BookingMode;
	units: number;
	capacity: number;
	/** Franjas ofertadas en el periodo (horario menos cierres). */
	openSlots: Slot[];
};

export type IndicatorBooking = {
	facilityId: string;
	startsAt: Date;
	endsAt: Date;
	seats: number;
	unitIndex: number | null;
	status: 'confirmed' | 'cancelled' | 'no_show' | 'attended';
};

/**
 * Un trozo de franja ofertada que ocupa una reserva de temporada (la ocurrencia recortada a cada
 * franja abierta). Cuenta como ocupado igual que en la agenda del mostrador (`busyMinutes`).
 */
export type IndicatorSeason = {
	facilityId: string;
	startsAt: Date;
	endsAt: Date;
	/** Solo en modo `unit`; null = todas las unidades. */
	unitIndex: number | null;
};

export type FacilityIndicators = {
	facilityId: string;
	name: string;
	occupancy: number;
	/** Reservas que ocupan franja (no canceladas). */
	bookings: number;
	noShows: number;
	noShowRate: number;
	underused: boolean;
	/** Ofertou franxas no período (unha instalación pechada todo o período non conta nas medias). */
	open: boolean;
};

export type PeakHour = { weekday: number; hour: number; bookings: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MIN;

/**
 * Ocupación = minutos reservados ÷ minutos ofertados (3 decimales). Cuentan las reservas
 * `confirmed`, `attended` y `no_show`. En `unit` se ofertan los minutos × `units`; en
 * `capacity` se reservan minutos × plazas y se ofertan minutos × `capacity`.
 * Las temporadas cuentan como ocupado: su unidad (o todas), el aforo entero o la franja. También
 * suman en el mapa de horas (un trozo por franja), pero no son reservas: no entran en el número
 * de reservas ni en las ausencias.
 */
export function computeIndicators(input: {
	facilities: IndicatorFacility[];
	bookings: IndicatorBooking[];
	seasons?: IndicatorSeason[];
}): { byFacility: FacilityIndicators[]; peakHours: PeakHour[] } {
	const seasons = input.seasons ?? [];
	const counted = input.bookings.filter((b) => b.status !== 'cancelled');

	const byFacility = input.facilities.map((f): FacilityIndicators => {
		const mine = counted.filter((b) => b.facilityId === f.id);
		const slotMinutes = f.openSlots.reduce((n, s) => n + minutes(s.startsAt, s.endsAt), 0);
		const offered =
			f.mode === 'unit'
				? slotMinutes * f.units
				: f.mode === 'capacity'
					? slotMinutes * f.capacity
					: slotMinutes;
		const seasonWeight = (s: IndicatorSeason) =>
			f.mode === 'unit'
				? s.unitIndex === null
					? f.units
					: 1
				: f.mode === 'capacity'
					? f.capacity
					: 1;
		const booked =
			mine.reduce(
				(n, b) => n + minutes(b.startsAt, b.endsAt) * (f.mode === 'capacity' ? b.seats : 1),
				0
			) +
			seasons
				.filter((s) => s.facilityId === f.id)
				.reduce((n, s) => n + minutes(s.startsAt, s.endsAt) * seasonWeight(s), 0);
		// Reservas anteriores a un cierre o cambio de horario pueden superar lo ofertado.
		const occupancy = offered > 0 ? Math.min(1, round3(booked / offered)) : 0;
		const noShows = mine.filter((b) => b.status === 'no_show').length;
		return {
			facilityId: f.id,
			name: f.name,
			occupancy,
			bookings: mine.length,
			noShows,
			noShowRate: mine.length > 0 ? round3(noShows / mine.length) : 0,
			underused: offered > 0 && occupancy < UNDERUSED_BELOW,
			open: offered > 0
		};
	});

	const known = new Set(input.facilities.map((f) => f.id));
	const peaks = new Map<string, PeakHour>();
	for (const b of [...counted, ...seasons]) {
		if (!known.has(b.facilityId)) continue;
		const local = new TZDate(b.startsAt.getTime(), TZ);
		const weekday = (local.getDay() + 6) % 7;
		const hour = local.getHours();
		const key = `${weekday}-${hour}`;
		const p = peaks.get(key) ?? { weekday, hour, bookings: 0 };
		p.bookings += 1;
		peaks.set(key, p);
	}
	const peakHours = [...peaks.values()].sort(
		(a, b) => b.bookings - a.bookings || a.weekday - b.weekday || a.hour - b.hour
	);
	return { byFacility, peakHours };
}
