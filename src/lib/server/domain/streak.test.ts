// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';
import type { BookingStatus } from './types';

// Mércores 25/11/2026 ás 12:00 locais: a semana actual comeza o luns 23/11.
const NOW = new Date('2026-11-25T12:00:00+01:00');

const item = (localStart: string, status: BookingStatus) => {
	const startsAt = new Date(`${localStart}+01:00`);
	return { startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), status };
};

const three = [
	item('2026-11-18T18:00:00', 'attended'),
	item('2026-11-11T18:00:00', 'attended'),
	item('2026-11-04T18:00:00', 'attended')
];

describe('computeStreak', () => {
	it('tres semanas seguidas con attended e nada esta semana → 3', () => {
		expect(computeStreak(three, NOW)).toBe(3);
	});

	it('un no_show na semana do 11/11 rompe aínda que tamén conte → 1', () => {
		expect(computeStreak([...three, item('2026-11-12T18:00:00', 'no_show')], NOW)).toBe(1);
	});

	it('a semana do 11/11 só con cancelled é neutra → 2', () => {
		const items = [
			item('2026-11-18T18:00:00', 'attended'),
			item('2026-11-11T18:00:00', 'cancelled'),
			item('2026-11-04T18:00:00', 'attended')
		];
		expect(computeStreak(items, NOW)).toBe(2);
	});

	it('un oco baleiro na semana do 11/11 rompe → 1', () => {
		const items = [
			item('2026-11-18T18:00:00', 'attended'),
			item('2026-11-04T18:00:00', 'attended')
		];
		expect(computeStreak(items, NOW)).toBe(1);
	});

	it('unha confirmed do 23/11 xa rematada conta → 4', () => {
		expect(computeStreak([...three, item('2026-11-23T18:00:00', 'confirmed')], NOW)).toBe(4);
	});

	it('unha confirmed desta semana aínda sen rematar non conta nin rompe', () => {
		expect(computeStreak([...three, item('2026-11-27T18:00:00', 'confirmed')], NOW)).toBe(3);
	});

	it('un no_show esta semana deixa a racha en 0', () => {
		expect(computeStreak([...three, item('2026-11-24T18:00:00', 'no_show')], NOW)).toBe(0);
	});

	it('sen reservas → 0', () => {
		expect(computeStreak([], NOW)).toBe(0);
	});

	it('frontera en hora local: domingo 22/11 ás 23:30 é da semana do 16/11', () => {
		const items = [
			item('2026-11-22T23:30:00', 'attended'),
			item('2026-11-11T18:00:00', 'attended')
		];
		expect(computeStreak(items, NOW)).toBe(2);
	});

	it('frontera en hora local: luns 23/11 ás 00:30 (domingo en UTC) é da semana actual', () => {
		const items = [
			item('2026-11-23T00:30:00', 'attended'),
			item('2026-11-18T18:00:00', 'attended')
		];
		expect(computeStreak(items, NOW)).toBe(2);
	});
});
