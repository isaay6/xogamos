// SPDX-License-Identifier: EUPL-1.2
// La rejilla pintable no puede destruir horas que no sabe dibujar.
import { describe, expect, it } from 'vitest';
import { paintable, paintCell } from './hours';

const row = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) - 7 * 60) / 30;

describe('paintCell', () => {
	it('pinta e xunta medias horas nun día representable', () => {
		const day = [{ opens: '09:00', closes: '10:00' }];
		expect(paintCell(day, row('10:00'), true)).toEqual([{ opens: '09:00', closes: '10:30' }]);
		expect(paintCell(day, row('09:00'), false)).toEqual([{ opens: '09:30', closes: '10:00' }]);
	});

	it('non toca un día con horas fóra da grella, a cuartos ou a medias', () => {
		for (const day of [
			[{ opens: '06:00', closes: '10:00' }],
			[{ opens: '16:15', closes: '18:00' }],
			[{ opens: '20:00', closes: '23:45' }],
			[{ opens: '10:00', closes: '' }]
		]) {
			expect(paintable(day)).toBe(false);
			expect(paintCell(day, row('12:00'), true)).toBe(day);
		}
	});

	it('non corta en silencio: se o pintado deixa máis de 4 franxas, non cambia nada', () => {
		const day = ['08:00', '10:00', '12:00', '14:00'].map((h) => ({
			opens: h,
			closes: `${h.slice(0, 2)}:30`
		}));
		expect(paintable(day)).toBe(true);
		expect(paintCell(day, row('16:00'), true)).toBe(day);
	});

	it('as parellas baleiras non impiden pintar', () => {
		expect(paintable([{ opens: '', closes: '' }])).toBe(true);
	});
});
