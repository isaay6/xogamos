// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { localDateOfInstant, longDate as longDateOf } from './booking-text';
import {
	longDate,
	monthName,
	monthYear,
	formatCode,
	formatDay,
	formatEuros,
	formatTime,
	greeting,
	textOn,
	formatAmount
} from './format';

describe('format', () => {
	it('formatCode amosa o PIN de 4 cifras tal cal', () => {
		expect(formatCode('0407')).toBe('0407');
		expect(formatCode('04 07')).toBe('0407');
	});

	it('formatCode parte un código antigo de 6 cifras en dous grupos con espazo fino', () => {
		expect(formatCode('482193')).toBe('482 193');
	});

	it('formatTime dá HH:MM na hora de Madrid', () => {
		expect(formatTime(new Date('2026-10-25T10:00:00+01:00'))).toBe('10:00');
		expect(formatTime(new Date('2026-07-01T07:05:00Z'))).toBe('09:05');
	});

	it('formatDay dá o día da semana curto e o número', () => {
		expect(formatDay('gl', '2026-10-22')).toEqual({ weekday: 'Xov', day: 22 });
		expect(formatDay('es', '2026-10-22')).toEqual({ weekday: 'Jue', day: 22 });
		expect(formatDay('gl', '2026-10-25')).toEqual({ weekday: 'Dom', day: 25 });
	});

	it('formatEuros', () => {
		expect(formatEuros(300)).toBe('3 €');
		expect(formatEuros(350)).toBe('3,50 €');
		expect(formatEuros(1205)).toBe('12,05 €');
		expect(formatEuros(0, 'gl')).toBe('De balde');
		expect(formatEuros(0, 'es')).toBe('Gratis');
	});

	it('greeting segundo a hora de Madrid', () => {
		// 13:59 e 14:00 en Madrid (CEST, UTC+2)
		expect(greeting('gl', new Date('2026-07-01T11:59:00Z'))).toBe('Bos días');
		expect(greeting('gl', new Date('2026-07-01T12:00:00Z'))).toBe('Boas tardes');
		expect(greeting('gl', new Date('2026-07-01T18:59:00Z'))).toBe('Boas tardes');
		expect(greeting('gl', new Date('2026-07-01T19:00:00Z'))).toBe('Boas noites');
		expect(greeting('es', new Date('2026-07-01T08:00:00Z'))).toBe('Buenos días');
		expect(greeting('es', new Date('2026-07-01T15:00:00Z'))).toBe('Buenas tardes');
		expect(greeting('es', new Date('2026-07-01T20:30:00Z'))).toBe('Buenas noches');
	});
});

describe('textOn', () => {
	it('elixe a cor de texto que chega a 4.5:1', () => {
		expect(textOn('#17202A')).toBe('#fff');
		expect(textOn('#1d4ed8')).toBe('#fff');
		expect(textOn('#F2762E')).toBe('#17202A');
		expect(textOn('#FFD84D')).toBe('#17202A');
	});

	it('longDate escribe o mes sen Intl, en galego e castelán', () => {
		expect(longDate('gl', '2026-10-28')).toBe('28 de outubro');
		expect(longDate('es', '2026-10-28')).toBe('28 de octubre');
		expect(longDate('gl', '2026-12-01')).toBe('1 de decembro');
		expect(longDate('gl', 'non-é-data')).toBe('');
	});

	it('monthName e monthYear desde YYYY-MM, sen Intl', () => {
		expect(monthName('gl', '2026-09')).toBe('setembro');
		expect(monthName('es', '2026-09')).toBe('septiembre');
		expect(monthYear('gl', '2026-12')).toBe('decembro 2026');
		expect(monthYear('es', '2027-01')).toBe('enero 2027');
		expect(monthYear('gl', '2026-13')).toBe('');
		expect(monthName('gl', 'abc')).toBe('');
	});

	it('o longDate de booking-text usa o día local de Madrid e non depende de Intl', () => {
		const real = Intl.DateTimeFormat;
		// Calquera uso de Intl para o mes (ou o día) fallaría.
		Intl.DateTimeFormat = (() => {
			throw new Error('Intl non debe usarse');
		}) as never;
		try {
			// 31 out 23:30 UTC xa é 1 de novembro en Madrid (CET).
			expect(longDateOf('gl', new Date('2026-10-31T23:30:00Z'))).toBe('1 de novembro');
			expect(localDateOfInstant(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
			expect(localDateOfInstant(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
		} finally {
			Intl.DateTimeFormat = real;
		}
	});
});

describe('formatAmount', () => {
	it('mostra 0 €, cantidades negativas pequenas co signo e céntimos', () => {
		expect(formatAmount(0)).toBe('0 €');
		expect(formatAmount(-50)).toBe('−0,50 €');
		expect(formatAmount(-300)).toBe('−3 €');
		expect(formatAmount(1550)).toBe('15,50 €');
	});
});
