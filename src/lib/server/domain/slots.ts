// SPDX-License-Identifier: EUPL-1.2
import { localDateTimeToUtc, weekdayOf } from './time';
import type { BookingMode, Hours, Interval, Slot } from './types';

export type { BookingMode, Hours, Interval, Slot } from './types';

const MIN = 60_000;

export function generateSlots(input: {
	date: string;
	slotMinutes: number;
	hours: Hours[];
	closures: Interval[];
	bookingMode: BookingMode;
}): Slot[] {
	// Con 0, negativo o no entero el bucle no avanzaría o generaría franjas absurdas.
	if (!Number.isInteger(input.slotMinutes) || input.slotMinutes <= 0) {
		throw new RangeError(`slotMinutes must be a positive integer, got ${input.slotMinutes}`);
	}
	const weekday = weekdayOf(input.date);
	const slots: Slot[] = [];
	for (const h of input.hours.filter((x) => x.weekday === weekday)) {
		const open = localDateTimeToUtc(input.date, h.opens).getTime();
		const close = localDateTimeToUtc(input.date, h.closes).getTime();
		if (input.bookingMode === 'day') {
			slots.push({ startsAt: new Date(open), endsAt: new Date(close) });
			continue;
		}
		const step = input.slotMinutes * MIN;
		for (let s = open; s + step <= close; s += step) {
			slots.push({ startsAt: new Date(s), endsAt: new Date(s + step) });
		}
	}
	slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
	return slots.filter(
		(s) => !input.closures.some((c) => s.startsAt < c.endsAt && c.startsAt < s.endsAt)
	);
}
