// SPDX-License-Identifier: EUPL-1.2
// Formato de fechas, horas, euros y códigos para la interfaz (Europe/Madrid, céntimos).
import { TZDate } from '@date-fns/tz';
import { t, type Locale, type MessageKey } from '../i18n';

const TZ = 'Europe/Madrid';
const THIN_SPACE = ' ';

/**
 * PIN de 4 cifras: se muestra tal cual («0407»). Un código antiguo de 6 cifras se parte en
 * dos grupos con espacio fino U+2009 («482 193»); otros largos se devuelven tal cual.
 */
export function formatCode(code: string): string {
	const digits = code.replace(/\s/g, '');
	if (digits.length === 4) return digits;
	return digits.length === 6 ? `${digits.slice(0, 3)}${THIN_SPACE}${digits.slice(3)}` : code;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:MM' local (Europe/Madrid) de un instante. */
export function formatTime(date: Date): string {
	const local = new TZDate(date.getTime(), TZ);
	return `${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

const MONTHS: Record<Locale, string[]> = {
	gl: [
		'xaneiro',
		'febreiro',
		'marzo',
		'abril',
		'maio',
		'xuño',
		'xullo',
		'agosto',
		'setembro',
		'outubro',
		'novembro',
		'decembro'
	],
	es: [
		'enero',
		'febrero',
		'marzo',
		'abril',
		'mayo',
		'junio',
		'julio',
		'agosto',
		'septiembre',
		'octubre',
		'noviembre',
		'diciembre'
	]
};

/**
 * Fecha local 'YYYY-MM-DD' → «28 de outubro» / «28 de octubre»; '' si no es una fecha. Los meses
 * van en tablas propias: `Intl` depende de los datos del gallego que traiga cada navegador y
 * caía al castellano, así que el servidor y el cliente escribirían cosas distintas.
 */
export function longDate(locale: Locale, isoDate: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
	const month = m ? MONTHS[locale][Number(m[2]) - 1] : undefined;
	return m && month ? `${Number(m[3])} de ${month}` : '';
}

/** Mes 'YYYY-MM' → «setembro» / «septiembre»; '' si no es un mes. Sin `Intl` (ver `longDate`). */
export function monthName(locale: Locale, month: string): string {
	const m = /^(\d{4})-(\d{2})$/.exec(month);
	return (m && MONTHS[locale][Number(m[2]) - 1]) || '';
}

/** Mes 'YYYY-MM' → «decembro 2026» / «diciembre 2026»; '' si no es un mes. */
export function monthYear(locale: Locale, month: string): string {
	const name = monthName(locale, month);
	return name ? `${name} ${month.slice(0, 4)}` : '';
}

/** Fecha local 'YYYY-MM-DD' → día de la semana corto y número del mes. */
export function formatDay(locale: Locale, date: string): { weekday: string; day: number } {
	const [y, m, d] = date.split('-').map(Number);
	// El día de la semana de una fecha de calendario no depende de la zona: se calcula en UTC.
	const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return { weekday: t(locale, `semana.${weekday}` as MessageKey), day: d };
}

/** Céntimos → '3 €', '3,50 €'; 0 → «De balde» / «Gratis». */
export function formatEuros(cents: number, locale: Locale = 'gl'): string {
	if (cents === 0) return t(locale, 'prezo.balde');
	return formatAmount(cents);
}

/** Unha cantidade de diñeiro tal cal, tamén 0 € (totais, saldos): non é un prezo «de balde». */
export function formatAmount(cents: number): string {
	// O signo vai á parte: con −0,50 € `Math.trunc` daría 0 e perderíase.
	const sign = cents < 0 ? '−' : '';
	const abs = Math.abs(cents);
	const euros = Math.trunc(abs / 100);
	const rest = abs % 100;
	return rest === 0 ? `${sign}${euros} €` : `${sign}${euros},${pad(rest)} €`;
}

/** Saludo según la hora de Madrid: antes de las 14:00, antes de las 21:00, después. */
export function greeting(locale: Locale, now: Date): string {
	const hour = new TZDate(now.getTime(), TZ).getHours();
	if (hour < 14) return t(locale, 'saudo.mana');
	if (hour < 21) return t(locale, 'saudo.tarde');
	return t(locale, 'saudo.noite');
}

/** Luminancia relativa (WCAG) de un color '#RRGGBB' o '#RGB'; `null` si no se entiende. */
function luminance(color: string): number | null {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
	if (!m) return null;
	const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
	const [r, g, b] = [0, 2, 4].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto blanco o `--txt` sobre `color`, el que llegue a 4.5:1 (blanco si los dos llegan). */
export function textOn(color: string): '#fff' | '#17202A' {
	const l = luminance(color);
	if (l === null) return '#fff';
	return 1.05 / (l + 0.05) >= 4.5 ? '#fff' : '#17202A';
}

/** Contraste WCAG entre dos colores '#RRGGBB' / '#RGB' (1–21); `null` si alguno no se entiende. */
export function contrastRatio(a: string, b: string): number | null {
	const la = luminance(a);
	const lb = luminance(b);
	if (la === null || lb === null) return null;
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
