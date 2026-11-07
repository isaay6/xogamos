// SPDX-License-Identifier: EUPL-1.2
// Textos llanos de las tablas de instalaciones: cómo se reserva y cuánto cuesta.
import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
import { nounFor, type BookingMode } from '#lib/ui/booking-text.js';
import { formatEuros } from '#lib/ui/format.js';

/** «30 min», «1 h», «1 h 30», «2 h». */
export function durationLabel(locale: Locale, minutes: number): string {
	if (minutes < 60) {
		return t(locale, 'adm.dur.min', { n: minutes });
	}
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? t(locale, 'adm.dur.h', { h }) : t(locale, 'adm.dur.hm', { h, m });
}

/** «Enteira, 1 h», «Por rúas (4)», «Por aforo (25)», «Por días». */
export function howText(
	locale: Locale,
	f: { bookingMode: BookingMode; slotMinutes: number; units: number; capacity: number },
	mascot: string
): string {
	switch (f.bookingMode) {
		case 'slot':
			return t(locale, 'adm.como.slot', { duracion: durationLabel(locale, f.slotMinutes) });
		case 'unit':
			return t(locale, `adm.como.unit.${nounFor('unit', mascot)}` as MessageKey, { n: f.units });
		case 'capacity':
			return t(locale, 'adm.como.capacity', { n: f.capacity });
		default:
			return t(locale, 'adm.como.day');
	}
}

/** «3 € / 6 €»; si coinciden, uno solo («Gratis»). */
export function pricesLabel(locale: Locale, resident: number, nonResident: number): string {
	if (resident === nonResident) return formatEuros(resident, locale);
	return `${formatEuros(resident, locale)} / ${formatEuros(nonResident, locale)}`;
}

// Importes de los formularios: sin código de servidor, los usan también las páginas.
/** Euros escritos por una persona ('3', '3,50', '3.5') → céntimos, o `null` si no son euros. */
export function parseEuros(raw: string): number | null {
	const m = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(raw.trim());
	if (!m) return null;
	return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

/** Céntimos → texto para el campo ('3', '3,5'). */
export function eurosInput(cents: number): string {
	const rest = cents % 100;
	const euros = Math.trunc(cents / 100);
	if (rest === 0) return String(euros);
	return `${euros},${String(rest).padStart(2, '0')}`;
}

type Range = { weekday: number; opens: string; closes: string };

/** '09:00' → '9', '13:30' → '13:30' (sin `Intl`: igual en servidor y navegador). */
export function hourShort(hhmm: string): string {
	const h = String(Number(hhmm.slice(0, 2)));
	const m = hhmm.slice(3, 5);
	return m === '00' ? h : `${h}:${m}`;
}

/** Una franja corta como en la tabla de Horarios: «9–14», «16:30–22:30». */
export const rangeShort = (r: { opens: string; closes: string }) =>
	`${hourShort(r.opens)}–${hourShort(r.closes)}`;

/** Franjas de un día, ordenadas por la hora de apertura. */
export const dayRanges = (hours: Range[], weekday: number) =>
	hours.filter((h) => h.weekday === weekday).sort((a, b) => (a.opens < b.opens ? -1 : 1));

/**
 * Semana en una línea, juntando los días seguidos con las mismas franjas:
 * «Lu–Ve 9–13:30, 16:30–22:30 · Sá–Do 10–14:30». Los días cerrados no salen.
 */
export function weekSummary(locale: Locale, hours: Range[]): string {
	const text = [0, 1, 2, 3, 4, 5, 6].map((d) => dayRanges(hours, d).map(rangeShort).join(', '));
	const day = (d: number) => t(locale, `adm.dia.${d}` as MessageKey);
	const parts: string[] = [];
	for (let d = 0; d < 7;) {
		let end = d;
		while (end + 1 < 7 && text[end + 1] === text[d]) end++;
		if (text[d]) parts.push(`${end > d ? `${day(d)}–${day(end)}` : day(d)} ${text[d]}`);
		d = end + 1;
	}
	return parts.length ? parts.join(' · ') : t(locale, 'adm.fac.sen_horario');
}
