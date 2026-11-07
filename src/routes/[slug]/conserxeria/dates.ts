// SPDX-License-Identifier: EUPL-1.2
// Etiquetas de fecha del mostrador («martes 24 de novembro»), siempre en Europe/Madrid.
import { TZDate } from '@date-fns/tz';
import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';

/** 'YYYY-MM-DD' o instante ISO → «martes 24 de novembro». */
export function dayLabel(locale: Locale, when: string): string {
	let y: number, m: number, d: number;
	if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
		[y, m, d] = when.split('-').map(Number);
	} else {
		const local = new TZDate(new Date(when).getTime(), 'Europe/Madrid');
		[y, m, d] = [local.getFullYear(), local.getMonth() + 1, local.getDate()];
	}
	const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return t(locale, 'cons.data', {
		dia: t(locale, `cons.dia.${weekday}` as MessageKey),
		n: d,
		mes: t(locale, `cons.mes.${m - 1}` as MessageKey)
	});
}

/**
 * `?dia=` do mostrador: unha data de calendario que existe, entre os anos 2000 e 2100; se non,
 * `today`. Fóra dese rango as contas de días saen de PostgreSQL (o ano 10000 non se entende).
 */
export function dayParam(value: string | null | undefined, today: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
	if (!m) return today;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (y < 2000 || y > 2100) return today;
	const date = new Date(Date.UTC(y, mo - 1, d));
	const exists =
		date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
	return exists ? value! : today;
}
