// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { computeAvailability, type ActiveBooking } from './availability';
import type { Slot } from './types';

const at = (h: number) => new Date(Date.UTC(2026, 10, 20, h, 0));
const slot = (h: number): Slot => ({ startsAt: at(h), endsAt: at(h + 1) });
const booking = (h: number, extra: Partial<ActiveBooking> = {}): ActiveBooking => ({
	startsAt: at(h),
	endsAt: at(h + 1),
	unitIndex: null,
	seats: 1,
	...extra
});
const base = { units: 1, capacity: 1 };

describe('computeAvailability', () => {
	it('slot occupied', () => {
		const r = computeAvailability({
			...base,
			slots: [slot(18), slot(19)],
			bookings: [booking(18)],
			bookingMode: 'slot'
		});
		expect(r.map((s) => s.free)).toEqual([false, true]);
		expect(r[0].remainingSeats).toBe(0);
		expect(r[1].remainingSeats).toBe(1);
		expect(r[1].freeUnits).toEqual([]);
	});

	it('adjacent not overlap', () => {
		const r = computeAvailability({
			...base,
			slots: [slot(18)],
			bookings: [booking(17)],
			bookingMode: 'slot'
		});
		expect(r[0].free).toBe(true);
	});

	it('day mode behaves like slot', () => {
		const r = computeAvailability({
			...base,
			slots: [slot(9)],
			bookings: [booking(9)],
			bookingMode: 'day'
		});
		expect(r[0].free).toBe(false);
	});

	it('unit lanes', () => {
		const r = computeAvailability({
			slots: [slot(9)],
			bookings: [booking(9, { unitIndex: 0 }), booking(9, { unitIndex: 2 })],
			bookingMode: 'unit',
			units: 4,
			capacity: 1
		});
		expect(r[0].freeUnits).toEqual([1, 3]);
		expect(r[0].free).toBe(true);
		expect(r[0].remainingSeats).toBe(2);
	});

	it('unit ignores null or out-of-range unitIndex', () => {
		const r = computeAvailability({
			slots: [slot(9)],
			bookings: [booking(9, { unitIndex: null }), booking(9, { unitIndex: 7 })],
			bookingMode: 'unit',
			units: 2,
			capacity: 1
		});
		expect(r[0].freeUnits).toEqual([0, 1]);
	});

	it('capacity', () => {
		const r = computeAvailability({
			slots: [slot(9)],
			bookings: [booking(9, { seats: 5 }), booking(9, { seats: 12 })],
			bookingMode: 'capacity',
			units: 1,
			capacity: 20
		});
		expect(r[0].remainingSeats).toBe(3);
		expect(r[0].free).toBe(true);
	});

	it('90-min booking 18:00–19:30 overlaps both 60-min slots', () => {
		const long = (extra: Partial<ActiveBooking> = {}): ActiveBooking => ({
			startsAt: at(18),
			endsAt: new Date(Date.UTC(2026, 10, 20, 19, 30)),
			unitIndex: null,
			seats: 1,
			...extra
		});
		const slots = [slot(18), slot(19)];

		const bySlot = computeAvailability({ ...base, slots, bookings: [long()], bookingMode: 'slot' });
		expect(bySlot.map((s) => s.free)).toEqual([false, false]);

		const byUnit = computeAvailability({
			slots,
			bookings: [long({ unitIndex: 1 })],
			bookingMode: 'unit',
			units: 3,
			capacity: 1
		});
		expect(byUnit.map((s) => s.freeUnits)).toEqual([
			[0, 2],
			[0, 2]
		]);

		const byCapacity = computeAvailability({
			slots,
			bookings: [long({ seats: 4 })],
			bookingMode: 'capacity',
			units: 1,
			capacity: 10
		});
		expect(byCapacity.map((s) => s.remainingSeats)).toEqual([6, 6]);
	});

	it('capacity full', () => {
		const r = computeAvailability({
			slots: [slot(9)],
			bookings: [booking(9, { seats: 20 })],
			bookingMode: 'capacity',
			units: 1,
			capacity: 20
		});
		expect(r[0].free).toBe(false);
		expect(r[0].remainingSeats).toBe(0);
	});
});
