// SPDX-License-Identifier: EUPL-1.2
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { TZ } from '../domain/time';

export type CsvCell = string | number | boolean | null | Date;

// Un texto que empieza por estos caracteres se interpreta como fórmula en una hoja de cálculo.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
	if (value === null) return '';
	if (value instanceof Date) {
		return format(new TZDate(value.getTime(), TZ), "yyyy-MM-dd'T'HH:mm:ssXXX");
	}
	if (typeof value !== 'string') return String(value);
	const safe = FORMULA_START.test(value) ? `'${value}` : value;
	return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV para Excel (`;` y `\r\n`) con BOM UTF-8 y neutralización de fórmulas. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
	const lines = [headers, ...rows].map((r) => r.map(cell).join(';'));
	return '\ufeff' + lines.join('\r\n') + '\r\n';
}
