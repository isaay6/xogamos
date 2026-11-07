// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { generateSlots } from './slots';
import { localDateTimeToUtc } from './time';

const base = { slotMinutes: 60, closures: [], bookingMode: 'slot' as const };

describe('generateSlots', () => {
	it('normal day', () => {
		const s = generateSlots({
			...base,
			date: '2026-10-22',
			hours: [{ weekday: 3, opens: '17:00', closes: '21:00' }]
		});
		expect(s).toHaveLength(4);
		expect(s[0].startsAt.toISOString()).toBe('2026-10-22T15:00:00.000Z');
	});

	it('dst end', () => {
		const s = generateSlots({
			...base,
			date: '2026-10-25',
			hours: [{ weekday: 6, opens: '00:00', closes: '06:00' }]
		});
		expect(s).toHaveLength(7);
		const starts = s.map((x) => x.startsAt.getTime());
		expect(new Set(starts).size).toBe(7);
		expect([...starts].sort((a, b) => a - b)).toEqual(starts);
		expect(s[0].startsAt.toISOString()).toBe('2026-10-24T22:00:00.000Z');
		expect(s[6].endsAt.toISOString()).toBe('2026-10-25T05:00:00.000Z');
	});

	it('dst start', () => {
		// 29/03/2026: a las 02:00 pasa a ser 03:00; de 00:00 a 06:00 hay 5 horas reales.
		const s = generateSlots({
			...base,
			date: '2026-03-29',
			hours: [{ weekday: 6, opens: '00:00', closes: '06:00' }]
		});
		expect(s).toHaveLength(5);
		expect(s[0].startsAt.toISOString()).toBe('2026-03-28T23:00:00.000Z');
		expect(s[4].endsAt.toISOString()).toBe('2026-03-29T04:00:00.000Z');
		const starts = s.map((x) => x.startsAt.getTime());
		expect(starts.every((t, i) => i === 0 || t > starts[i - 1])).toBe(true);
	});

	it('closure', () => {
		const s = generateSlots({
			...base,
			date: '2026-10-22',
			hours: [{ weekday: 3, opens: '17:00', closes: '21:00' }],
			closures: [
				{
					startsAt: localDateTimeToUtc('2026-10-22', '18:00'),
					endsAt: localDateTimeToUtc('2026-10-22', '19:00')
				}
			]
		});
		expect(s).toHaveLength(3);
		expect(s.map((x) => x.startsAt.toISOString())).not.toContain('2026-10-22T16:00:00.000Z');
	});

	it('partial last slot', () => {
		const s = generateSlots({
			...base,
			date: '2026-10-22',
			hours: [{ weekday: 3, opens: '17:00', closes: '20:30' }]
		});
		expect(s).toHaveLength(3);
	});

	it('day mode', () => {
		const s = generateSlots({
			...base,
			bookingMode: 'day',
			date: '2026-10-22',
			hours: [{ weekday: 3, opens: '09:00', closes: '14:00' }]
		});
		expect(s).toHaveLength(1);
		expect(s[0].endsAt.getTime() - s[0].startsAt.getTime()).toBe(5 * 3600_000);
	});

	it('closed weekday', () => {
		expect(
			generateSlots({
				...base,
				date: '2026-10-22',
				hours: [{ weekday: 4, opens: '09:00', closes: '14:00' }]
			})
		).toEqual([]);
	});

	it('rejects non-positive or non-integer slotMinutes', () => {
		const hours = [{ weekday: 3, opens: '17:00', closes: '21:00' }];
		for (const slotMinutes of [0, -60, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => generateSlots({ ...base, slotMinutes, date: '2026-10-22', hours })).toThrow(
				RangeError
			);
		}
	});

	it('split shifts sorted', () => {
		const s = generateSlots({
			...base,
			date: '2026-10-22',
			hours: [
				{ weekday: 3, opens: '17:00', closes: '19:00' },
				{ weekday: 3, opens: '09:00', closes: '11:00' }
			]
		});
		expect(s).toHaveLength(4);
		expect(s[0].startsAt.toISOString()).toBe('2026-10-22T07:00:00.000Z');
	});
});

describe('localDateTimeToUtc', () => {
	it('ambiguous time takes first occurrence (CEST)', () => {
		expect(localDateTimeToUtc('2026-10-25', '02:30').toISOString()).toBe(
			'2026-10-25T00:30:00.000Z'
		);
	});
	it('winter and summer offsets', () => {
		expect(localDateTimeToUtc('2026-01-15', '10:00').toISOString()).toBe(
			'2026-01-15T09:00:00.000Z'
		);
		expect(localDateTimeToUtc('2026-07-15', '10:00').toISOString()).toBe(
			'2026-07-15T08:00:00.000Z'
		);
	});
});
