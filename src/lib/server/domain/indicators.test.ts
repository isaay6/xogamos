// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { computeIndicators, UNDERUSED_BELOW } from './indicators';
import type { Slot } from './types';

const hour = (h: number): Slot => ({
	startsAt: new Date(Date.UTC(2026, 10, 20, h, 0)),
	endsAt: new Date(Date.UTC(2026, 10, 20, h + 1, 0))
});
const slots = (n: number): Slot[] => Array.from({ length: n }, (_, i) => hour(8 + i));
const booking = (h: number, extra: Record<string, unknown> = {}) => ({
	facilityId: 'f1',
	startsAt: hour(h).startsAt,
	endsAt: hour(h).endsAt,
	seats: 1,
	unitIndex: null,
	status: 'confirmed' as const,
	...extra
});
const facility = (extra: Record<string, unknown> = {}) => ({
	id: 'f1',
	name: 'Pista 1',
	mode: 'slot' as const,
	units: 1,
	capacity: 1,
	openSlots: slots(13),
	...extra
});

describe('computeIndicators', () => {
	it('open: só as instalacións con franxas ofertadas no período', () => {
		const r = computeIndicators({
			facilities: [facility(), facility({ id: 'f2', name: 'Piscina pechada', openSlots: [] })],
			bookings: [booking(9)]
		});
		expect(r.byFacility.map((f) => [f.facilityId, f.open])).toEqual([
			['f1', true],
			['f2', false]
		]);
		expect(r.byFacility[1]).toMatchObject({ occupancy: 0, underused: false });
	});

	it('slot mode: 2 of 13 slots is 0.154 and underused', () => {
		const r = computeIndicators({
			facilities: [facility()],
			bookings: [booking(9), booking(10)]
		});
		expect(UNDERUSED_BELOW).toBe(0.2);
		expect(r.byFacility[0]).toMatchObject({
			facilityId: 'f1',
			name: 'Pista 1',
			occupancy: 0.154,
			bookings: 2,
			noShows: 0,
			noShowRate: 0,
			underused: true
		});
	});

	it('capacity mode: 10 seats of 20 in one slot is 0.5', () => {
		const r = computeIndicators({
			facilities: [facility({ mode: 'capacity', capacity: 20, openSlots: slots(1) })],
			bookings: [booking(8, { seats: 10 })]
		});
		expect(r.byFacility[0].occupancy).toBe(0.5);
		expect(r.byFacility[0].underused).toBe(false);
	});

	it('clamps occupancy to 1 when bookings exceed the offered minutes (closure after booking)', () => {
		const r = computeIndicators({
			facilities: [facility({ openSlots: slots(1) })],
			bookings: [booking(8), booking(8), booking(9)]
		});
		expect(r.byFacility[0].occupancy).toBe(1);
		expect(r.byFacility[0].underused).toBe(false);
	});

	it('unit mode multiplies offered minutes by units', () => {
		const r = computeIndicators({
			facilities: [facility({ mode: 'unit', units: 4, openSlots: slots(2) })],
			bookings: [booking(8, { unitIndex: 0 }), booking(8, { unitIndex: 1 })]
		});
		expect(r.byFacility[0].occupancy).toBe(0.25);
	});

	it('cancelled bookings do not count, no_show do', () => {
		const r = computeIndicators({
			facilities: [facility({ openSlots: slots(4) })],
			bookings: [
				booking(8, { status: 'cancelled' }),
				booking(9, { status: 'no_show' }),
				booking(10, { status: 'attended' }),
				booking(11)
			]
		});
		const f = r.byFacility[0];
		expect(f.occupancy).toBe(0.75);
		expect(f.bookings).toBe(3);
		expect(f.noShows).toBe(1);
		expect(f.noShowRate).toBe(0.333);
		expect(r.peakHours.reduce((n, p) => n + p.bookings, 0)).toBe(3);
	});

	it('facility with no offered slots has occupancy 0 and is not underused', () => {
		const r = computeIndicators({ facilities: [facility({ openSlots: [] })], bookings: [] });
		expect(r.byFacility[0]).toMatchObject({ occupancy: 0, underused: false });
	});

	it('peakHours uses local time in the DST-change week', () => {
		// 25/10/2026 10:00 local (CET, +01:00) = 09:00Z; a Sunday.
		const startsAt = new Date('2026-10-25T10:00:00+01:00');
		const endsAt = new Date('2026-10-25T11:00:00+01:00');
		const r = computeIndicators({
			facilities: [facility()],
			bookings: [booking(0, { startsAt, endsAt })]
		});
		expect(r.peakHours).toEqual([{ weekday: 6, hour: 10, bookings: 1 }]);
		// Summer time: 24/10/2026 10:00 local (+02:00).
		const s2 = new Date('2026-10-24T10:00:00+02:00');
		const r2 = computeIndicators({
			facilities: [facility()],
			bookings: [booking(0, { startsAt: s2, endsAt: new Date('2026-10-24T11:00:00+02:00') })]
		});
		expect(r2.peakHours).toEqual([{ weekday: 5, hour: 10, bookings: 1 }]);
	});

	it('peakHours sorted by bookings desc', () => {
		const r = computeIndicators({
			facilities: [facility()],
			bookings: [booking(9), booking(10), booking(10)]
		});
		expect(r.peakHours.map((p) => p.bookings)).toEqual([2, 1]);
	});
});
