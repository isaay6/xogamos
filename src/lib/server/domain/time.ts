// SPDX-License-Identifier: EUPL-1.2
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const TZ = 'Europe/Madrid';

/** Fecha local 'YYYY-MM-DD' + 'HH:mm' (Europe/Madrid) → instante UTC. Hora ambigua: primera aparición. */
export function localDateTimeToUtc(date: string, hhmm: string): Date {
	const [y, mo, d] = date.split('-').map(Number);
	const [h, mi] = hhmm.split(':').map(Number);
	const t = new TZDate(y, mo - 1, d, h, mi, 0, 0, TZ);
	let ms = t.getTime();
	// En el otoño la hora repetida: si una hora antes sigue siendo la misma hora local, esa es la primera aparición.
	const earlier = new TZDate(ms - 3600_000, TZ);
	if (earlier.getHours() === h && earlier.getMinutes() === mi && earlier.getDate() === d) {
		ms -= 3600_000;
	}
	return new Date(ms);
}

/** 0 = luns … 6 = domingo, para una fecha local 'YYYY-MM-DD'. */
export function weekdayOf(date: string): number {
	const [y, mo, d] = date.split('-').map(Number);
	return (new TZDate(y, mo - 1, d, 12, 0, 0, 0, TZ).getDay() + 6) % 7;
}

/** Fecha local 'YYYY-MM-DD' (Europe/Madrid) de un instante. */
export function localDateOf(instant: Date): string {
	return format(new TZDate(instant.getTime(), TZ), 'yyyy-MM-dd');
}

/** Suma `days` días de calendario a una fecha local 'YYYY-MM-DD'. */
export function addLocalDays(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	return format(new TZDate(y, m - 1, d + days, 12, 0, 0, 0, TZ), 'yyyy-MM-dd');
}

/** Hora local 'HH:mm' (Europe/Madrid) de un instante. */
export function localTimeOf(instant: Date): string {
	return format(new TZDate(instant.getTime(), TZ), 'HH:mm');
}

/** ¿Es un mes 'YYYY-MM' válido? */
export function isLocalMonth(value: string | null | undefined): value is string {
	const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
	return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** ¿Es una fecha de calendario 'YYYY-MM-DD' que existe (no un 31 de febrero)? */
export function isLocalDate(value: string | null | undefined): value is string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
	const [y, m, d] = value!.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Suma `months` meses a un mes 'YYYY-MM'. */
export function addLocalMonths(month: string, months: number): string {
	const [y, m] = month.split('-').map(Number);
	const total = y * 12 + (m - 1) + months;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Instante UTC en que empieza el mes local 'YYYY-MM' (medianoche de Madrid del día 1). */
export function localMonthStart(month: string): Date {
	return localDateTimeToUtc(`${month}-01`, '00:00');
}
