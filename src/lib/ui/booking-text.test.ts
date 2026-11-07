// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { facilityLabel, nounFor } from './booking-text';

describe('nounFor (ruling 8)', () => {
	it.each([
		['slot', 'sala', 'salas'],
		['capacity', 'sala', 'salas'],
		['unit', 'natacion', 'ruas'],
		['capacity', 'natacion', 'ruas'],
		['unit', 'piragua', 'ruas'],
		['capacity', 'ximnasio', 'prazas'],
		['unit', 'padel', 'pistas'],
		['slot', 'futbol', 'pistas'],
		['day', 'atletismo', 'pistas']
	] as const)('modo %s + personaxe %s → %s', (mode, mascot, noun) => {
		expect(nounFor(mode, mascot)).toBe(noun);
	});
});

describe('facilityLabel', () => {
	it('sen unidade, só o nome', () => {
		expect(facilityLabel('gl', 'Pista 1', null, 'pistas')).toBe('Pista 1');
	});

	it.each([
		['pistas', 'gl', 'Pistas de pádel · Pista 2'],
		['ruas', 'gl', 'Pistas de pádel · Rúa 2'],
		['ruas', 'es', 'Pistas de pádel · Calle 2'],
		['salas', 'gl', 'Pistas de pádel · Sala 2'],
		['prazas', 'es', 'Pistas de pádel · Plaza 2']
	] as const)('unidade co nome %s (%s)', (noun, locale, label) => {
		expect(facilityLabel(locale, 'Pistas de pádel', 1, noun)).toBe(label);
	});
});
