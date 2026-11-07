// SPDX-License-Identifier: EUPL-1.2
import type { BookingMode, Hours } from './types';

const minutesOf = (hhmm: string): number => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

/** Problemas del horario semanal (vacío = válido). */
export function validateHours(hours: Hours[], mode: BookingMode, slotMinutes: number): string[] {
	const issues: string[] = [];
	const byDay = new Map<number, { opens: number; closes: number }[]>();
	for (const h of hours) {
		const opens = minutesOf(h.opens);
		const closes = minutesOf(h.closes);
		if (closes <= opens) {
			issues.push(`Weekday ${h.weekday}: closing time must be after opening time`);
			continue;
		}
		if (mode !== 'day' && (closes - opens) % slotMinutes !== 0) {
			issues.push(
				`Weekday ${h.weekday}: ${h.opens}-${h.closes} is not a multiple of ${slotMinutes} minutes`
			);
		}
		byDay.set(h.weekday, [...(byDay.get(h.weekday) ?? []), { opens, closes }]);
	}
	for (const [weekday, ranges] of byDay) {
		if (mode === 'day' && ranges.length > 1) {
			issues.push(`Weekday ${weekday}: day mode allows a single range per day`);
		}
		const sorted = [...ranges].sort((a, b) => a.opens - b.opens);
		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i].opens < sorted[i - 1].closes) {
				issues.push(`Weekday ${weekday}: overlapping ranges`);
				break;
			}
		}
	}
	return issues;
}

export const MAX_PRICE_CENTS = 100_000;

/** Problemas de la configuración de una instalación (vacío = válida). */
export function validateFacility(input: {
	slotMinutes: number;
	units: number;
	capacity: number;
	prices: number[];
	mode: BookingMode;
}): string[] {
	const issues: string[] = [];
	const { slotMinutes, units, capacity, mode } = input;
	if (
		!Number.isInteger(slotMinutes) ||
		slotMinutes < 15 ||
		slotMinutes > 1440 ||
		slotMinutes % 15
	) {
		issues.push('slotMinutes must be an integer between 15 and 1440, multiple of 15');
	}
	if (mode === 'unit') {
		if (!Number.isInteger(units) || units < 2) issues.push('Unit mode requires units >= 2');
	} else if (mode !== 'capacity' && units !== 1) {
		issues.push('units must be 1 in slot and day modes');
	}
	if (mode === 'capacity') {
		if (!Number.isInteger(capacity) || capacity < 2) {
			issues.push('Capacity mode requires capacity >= 2');
		}
	} else if (mode !== 'unit' && capacity !== 1) {
		issues.push('capacity must be 1 in slot and day modes');
	}
	for (const p of input.prices) {
		if (!Number.isInteger(p) || p < 0 || p > MAX_PRICE_CENTS) {
			issues.push(`Prices must be integer cents between 0 and ${MAX_PRICE_CENTS}`);
			break;
		}
	}
	return issues;
}
