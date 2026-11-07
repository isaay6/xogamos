// SPDX-License-Identifier: EUPL-1.2
// Reservas de temporada (puro, sin base de datos): en qué días locales caen y qué ocupan.
import type { ActiveBooking } from './availability';
import { addLocalDays, localDateOf, localDateTimeToUtc, weekdayOf } from './time';
import type { BookingMode, Interval } from './types';

/** Lo que define una temporada: día de la semana, tramo local y vigencia (fechas incluidas). */
export type SeasonRule = {
	weekday: number;
	startsTime: string;
	endsTime: string;
	fromDate: string;
	toDate: string;
	unitIndex: number | null;
};

/** Ocurrencia de la temporada en la fecha local 'YYYY-MM-DD', o null si ese día no toca. */
export function seasonOccurrence(rule: SeasonRule, date: string): Interval | null {
	if (date < rule.fromDate || date > rule.toDate) return null;
	if (weekdayOf(date) !== rule.weekday) return null;
	return {
		startsAt: localDateTimeToUtc(date, rule.startsTime),
		endsAt: localDateTimeToUtc(date, rule.endsTime)
	};
}

/**
 * La ocurrencia como reservas que ocupan: en modo `unit`, su unidad o todas si no tiene; en
 * `capacity`, todo el aforo; en `slot` y `day`, la franja.
 */
export function seasonAsBookings(
	occurrence: Interval,
	rule: Pick<SeasonRule, 'unitIndex'>,
	facility: { bookingMode: BookingMode; units: number; capacity: number }
): ActiveBooking[] {
	if (facility.bookingMode === 'unit') {
		const units =
			rule.unitIndex === null
				? Array.from({ length: facility.units }, (_, i) => i)
				: [rule.unitIndex];
		return units.map((unitIndex) => ({ ...occurrence, unitIndex, seats: 1 }));
	}
	const seats = facility.bookingMode === 'capacity' ? facility.capacity : 1;
	return [{ ...occurrence, unitIndex: null, seats }];
}

/** ¿La reserva choca con la temporada? Mismo solape estricto que la disponibilidad. */
export function bookingHitsSeason(
	booking: Interval & { unitIndex: number | null },
	rule: SeasonRule,
	bookingMode: BookingMode
): boolean {
	if (
		bookingMode === 'unit' &&
		rule.unitIndex !== null &&
		booking.unitIndex !== null &&
		booking.unitIndex !== rule.unitIndex
	) {
		return false;
	}
	// Una reserva puede cruzar la medianoche: se miran los días locales de su inicio y su fin.
	// Supuestos: una reserva dura menos de 24 h (toca como mucho dos días locales) y una ocurrencia
	// nunca cruza la medianoche (`ends_time > starts_time` en el mismo día), así que basta con esos
	// dos días. Una reserva más larga tendría días intermedios que esto no mira.
	const days = new Set([
		localDateOf(booking.startsAt),
		localDateOf(new Date(booking.endsAt.getTime() - 1))
	]);
	for (const date of days) {
		const occ = seasonOccurrence(rule, date);
		if (occ && booking.startsAt < occ.endsAt && occ.startsAt < booking.endsAt) return true;
	}
	return false;
}

/**
 * ¿Dos temporadas de la misma instalación ocupan a la vez algún día? Mismo día de la semana,
 * tramos que se pisan (solape estricto), alguna ocurrencia común en las dos vigencias y unidad
 * compatible (sin unidad = todas).
 */
export function seasonsOverlap(a: SeasonRule, b: SeasonRule): boolean {
	if (a.weekday !== b.weekday) return false;
	if (!(a.startsTime < b.endsTime && b.startsTime < a.endsTime)) return false;
	if (a.unitIndex !== null && b.unitIndex !== null && a.unitIndex !== b.unitIndex) return false;
	const from = a.fromDate > b.fromDate ? a.fromDate : b.fromDate;
	const to = a.toDate < b.toDate ? a.toDate : b.toDate;
	// Una semana completa siempre contiene el día; si el cruce es más corto, se mira día a día.
	for (let d = from, n = 0; d <= to && n < 7; d = addLocalDays(d, 1), n++) {
		if (weekdayOf(d) === a.weekday) return true;
	}
	return false;
}
