// SPDX-License-Identifier: EUPL-1.2
// Textos del flujo de reserva de la vecindad: días relativos, nombres por modo, precios y duración.
import { t, type Locale, type MessageKey } from '../i18n';
import { TZDate } from '@date-fns/tz';
import { formatDay, formatEuros, longDate as longLocalDate } from './format';

export type BookingMode = 'slot' | 'unit' | 'capacity' | 'day';
/** Lo que se reserva según el modo: pistas, salas, rúas o prazas. */
export type Noun = 'pistas' | 'salas' | 'ruas' | 'prazas';

/**
 * Ruling 8: primero el personaje (`sala` → salas; `natacion`/`piragua` → rúas), luego el modo
 * (`capacity` → prazas) y, si no, pistas.
 */
export function nounFor(mode: BookingMode, mascot: string): Noun {
	if (mascot === 'sala') return 'salas';
	if (mascot === 'natacion' || mascot === 'piragua') return 'ruas';
	if (mode === 'capacity') return 'prazas';
	return 'pistas';
}

/** «1 pista», «3 rúas»… */
export function countText(locale: Locale, noun: Noun, n: number): string {
	return t(locale, `vec.conta.${noun}.${n === 1 ? 'un' : 'varios'}` as MessageKey, { n });
}

/** Día siguiente de una fecha local 'YYYY-MM-DD'. */
function nextDate(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** «Hoxe», «Mañá» o «Xov 26». `today` viene del servidor (Europe/Madrid). */
export function dayLabel(locale: Locale, date: string, today: string): string {
	if (date === today) return t(locale, 'vec.dia.hoxe');
	if (date === nextDate(today)) return t(locale, 'vec.dia.mana');
	const f = formatDay(locale, date);
	return t(locale, 'vec.dia.semana', { semana: f.weekday, dia: f.day });
}

/** Precio según el perfil; sin saberlo (`null`), los dos (o uno si coinciden). */
export function priceText(
	locale: Locale,
	resident: boolean | null,
	residentCents: number,
	nonResidentCents: number,
	/** Precio de la persona ya calculado en el servidor (`priceFor`); si lo hay, es el que vale. */
	personalCents: number | null = null
): string {
	if (personalCents !== null) return formatEuros(personalCents, locale);
	if (resident !== null) return formatEuros(resident ? residentCents : nonResidentCents, locale);
	if (residentCents === nonResidentCents) return formatEuros(residentCents, locale);
	return t(locale, 'vec.opcion.dous_prezos', {
		residente: formatEuros(residentCents, locale),
		non: formatEuros(nonResidentCents, locale)
	});
}

/** «1 hora», «2 horas», «45 min». */
export function durationText(locale: Locale, startsAt: Date, endsAt: Date): string {
	const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
	if (minutes % 60 !== 0) return t(locale, 'vec.duracion.min', { n: minutes });
	const hours = minutes / 60;
	return hours === 1 ? t(locale, 'vec.duracion.un') : t(locale, 'vec.duracion.horas', { n: hours });
}

/** Normas de cancelación en texto llano, con el plazo en horas. */
export function cancellationText(locale: Locale, minutes: number): string {
	if (minutes <= 0) return t(locale, 'vec.confirmar.normas.cero');
	const hours = minutes / 60;
	if (hours === 1) return t(locale, 'vec.confirmar.normas.un');
	const n = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
	return t(locale, 'vec.confirmar.normas.varios', { n });
}

/** Nombre de la instalación con su unidad (índice 0 → «Pista 1», «Rúa 1»… según `noun`). */
export function facilityLabel(
	locale: Locale,
	name: string,
	unitIndex: number | null,
	noun: Noun
): string {
	if (unitIndex === null) return name;
	const unit = t(locale, `vec.unidade.${noun}` as MessageKey, { n: unitIndex + 1 });
	return `${name} · ${unit}`;
}

/** «1 de decembro» / «1 de diciembre» en Europe/Madrid. */
export function longDate(locale: Locale, date: Date): string {
	return longLocalDate(locale, localDateOfInstant(date));
}

/** Fecha local 'YYYY-MM-DD' (Europe/Madrid) de un instante. */
export function localDateOfInstant(d: Date): string {
	const local = new TZDate(d.getTime(), 'Europe/Madrid');
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}
