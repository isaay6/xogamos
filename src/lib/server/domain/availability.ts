// SPDX-License-Identifier: EUPL-1.2
import type { BookingMode, Interval, Slot } from './types';

/** Reserva confirmada; el filtro por estado lo hace quien llama. */
export type ActiveBooking = Interval & { unitIndex: number | null; seats: number };

export type SlotAvailability = Slot & {
	free: boolean;
	freeUnits: number[];
	remainingSeats: number;
};

type Input = {
	slots: Slot[];
	bookings: ActiveBooking[];
	bookingMode: BookingMode;
	units: number;
	capacity: number;
};

// Solape estricto: los intervalos contiguos no solapan.
const overlaps = (a: Interval, b: Interval) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

export function computeAvailability(input: Input): SlotAvailability[] {
	const { slots, bookings, bookingMode, units, capacity } = input;

	return slots.map((slot) => {
		const hits = bookings.filter((b) => overlaps(slot, b));
		const base = { startsAt: slot.startsAt, endsAt: slot.endsAt };

		if (bookingMode === 'unit') {
			// unitIndex nulo o fuera de rango no ocupa ninguna calle concreta.
			const taken = new Set(hits.map((b) => b.unitIndex));
			const freeUnits = Array.from({ length: units }, (_, i) => i).filter((i) => !taken.has(i));
			return { ...base, free: freeUnits.length > 0, freeUnits, remainingSeats: freeUnits.length };
		}

		if (bookingMode === 'capacity') {
			const used = hits.reduce((sum, b) => sum + b.seats, 0);
			const remainingSeats = Math.max(0, capacity - used);
			return { ...base, free: remainingSeats > 0, freeUnits: [], remainingSeats };
		}

		// slot y day
		const free = hits.length === 0;
		return { ...base, free, freeUnits: [], remainingSeats: free ? 1 : 0 };
	});
}
