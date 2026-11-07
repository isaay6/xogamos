// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

const body = (csv: string) => csv.slice(1);

describe('toCsv', () => {
	it('empieza con BOM UTF-8 y usa \\r\\n', () => {
		const csv = toCsv(['a', 'b'], [['x', 1]]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(body(csv)).toBe('a;b\r\nx;1\r\n');
	});

	it('neutraliza la inyección de fórmulas', () => {
		for (const v of ['=SUM(A1)', '+1', '-1', '@x', '\tx']) {
			expect(body(toCsv(['n'], [[v]]))).toBe(`n\r\n'${v}\r\n`);
		}
		expect(body(toCsv(['n'], [['\rx']]))).toBe('n\r\n"\'\rx"\r\n');
		expect(body(toCsv(['n'], [['=SUM(A1)']]))).toBe("n\r\n'=SUM(A1)\r\n");
	});

	it('no toca los números negativos', () => {
		expect(body(toCsv(['n'], [[-5]]))).toBe('n\r\n-5\r\n');
	});

	it('escapa punto y coma y comillas', () => {
		expect(body(toCsv(['n'], [['Pérez; "Tito"']]))).toBe('n\r\n"Pérez; ""Tito"""\r\n');
	});

	it('entrecomilla los saltos de línea', () => {
		expect(body(toCsv(['n'], [['a\nb']]))).toBe('n\r\n"a\nb"\r\n');
	});

	it('null vacío, booleanos y fechas con desfase de Madrid', () => {
		const row = [null, true, new Date('2026-11-24T17:00:00Z'), new Date('2026-07-01T10:00:00Z')];
		expect(body(toCsv(['a', 'b', 'c', 'd'], [row]))).toBe(
			'a;b;c;d\r\n;true;2026-11-24T18:00:00+01:00;2026-07-01T12:00:00+02:00\r\n'
		);
	});
});
