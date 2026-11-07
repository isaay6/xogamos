// SPDX-License-Identifier: EUPL-1.2
// Ayudas de los formularios de instalaciones y tipos (no es una ruta: SvelteKit solo admite
// exports estándar en `+page.server.ts`).
import { fail } from '@sveltejs/kit';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Db } from '../../../../lib/server/db/client';
import { bookings } from '../../../../lib/server/db/schema';
import type {
	AdminError,
	ConfigIssue,
	FacilityInput,
	FacilityTypeInput
} from '../../../../lib/server/services/admin';
import { replaceHours } from '../../../../lib/server/services/admin';
import {
	findBookingsInClosure,
	findBookingsOutsideHours
} from '../../../../lib/server/services/affected';
import type { BookingMode, Hours } from '../../../../lib/server/domain/types';
import { DEFAULT_MASCOT, MASCOTS, type Mascot } from '../../../../lib/mascots';
import { field, intField } from '../form';
import { parseEuros } from './text';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id que no es uuid no puede existir: se responde 404 sin llegar a la base de datos. */
export const isUuid = (id: string) => UUID.test(id);

export const MODES: readonly BookingMode[] = ['slot', 'unit', 'capacity', 'day'];

/** Fallo de servicio → respuesta de página (400 / 404 / 409). */
export function failOf(error: AdminError, extra: { issues?: ConfigIssue[]; count?: number } = {}) {
	if (error === 'NOT_FOUND') return fail(404, { error });
	if (error === 'HAS_FUTURE_BOOKINGS') return fail(409, { error, count: extra.count ?? 0 });
	return fail(400, { error, issues: extra.issues ?? [] });
}

/** Reservas `confirmed` futuras de una instalación (para explicar HAS_FUTURE_BOOKINGS). */
export async function countFutureBookings(
	db: Db,
	municipalityId: string,
	facilityId: string,
	now: Date
): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.facilityId, facilityId),
				eq(bookings.status, 'confirmed'),
				gt(bookings.startsAt, now)
			)
		);
	return row?.n ?? 0;
}

/** Reservas `confirmed` futuras dentro de un cierre `[from, to)` (predicado compartido con los avisos). */
export async function countBookingsInClosure(
	db: Db,
	municipalityId: string,
	facilityId: string,
	closure: { from: Date; to: Date },
	now: Date
): Promise<number> {
	return (await findBookingsInClosure(db, municipalityId, facilityId, closure, now)).length;
}

/** Reservas `confirmed` futuras que quedarían fuera del horario nuevo (predicado compartido). */
export async function countBookingsOutsideHours(
	db: Db,
	municipalityId: string,
	facilityId: string,
	hours: Hours[],
	now: Date
): Promise<number> {
	return (await findBookingsOutsideHours(db, municipalityId, facilityId, hours, now)).length;
}

/** Valores del formulario, para devolverlos si algo falla y no perder lo escrito. */
export function echo(form: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of form) if (typeof v === 'string') out[k] = v;
	return out;
}

type FacilityType = { id: string; bookingMode: BookingMode };

/** Datos de la instalación; las unidades y el aforo solo cuentan en los modos que los usan. */
export function parseFacilityForm(
	form: FormData,
	types: FacilityType[]
): { input: FacilityInput } | { error: 'INVALID' | 'NOT_FOUND' } {
	const type = types.find((t) => t.id === field(form, 'typeId'));
	if (!type) return { error: 'NOT_FOUND' };
	const name = field(form, 'name').trim();
	const location = field(form, 'location').trim();
	const address = field(form, 'address').trim();
	const slotMinutes = intField(form, 'slotMinutes', 1, 100_000);
	const resident = parseEuros(field(form, 'priceResident'));
	const nonResident = parseEuros(field(form, 'priceNonResident'));
	// Tarifa social: vacío = sin precio social; si el campo no viene, no se toca al editar.
	let priceSocialCents: number | null | undefined;
	if (form.has('priceSocial')) {
		const raw = field(form, 'priceSocial').trim();
		priceSocialCents = raw === '' ? null : parseEuros(raw);
		if (priceSocialCents === null && raw !== '') return { error: 'INVALID' };
	}
	const units = type.bookingMode === 'unit' ? intField(form, 'units', 1, 999) : 1;
	const capacity = type.bookingMode === 'capacity' ? intField(form, 'capacity', 1, 9999) : 1;
	if (
		!name ||
		name.length > 120 ||
		location.length > 200 ||
		address.length > 200 ||
		slotMinutes === null ||
		resident === null ||
		nonResident === null ||
		units === null ||
		capacity === null
	) {
		return { error: 'INVALID' };
	}
	return {
		input: {
			typeId: type.id,
			name,
			location,
			address,
			units,
			capacity,
			slotMinutes,
			priceResidentCents: resident,
			priceNonResidentCents: nonResident,
			...(priceSocialCents === undefined ? {} : { priceSocialCents }),
			accessible: field(form, 'accessible') === 'on',
			...(form.has('stepFreeAccess') ? accessibilityInput(form) : {}),
			...(form.has('accessInfo')
				? {
						needsOpening: field(form, 'needsOpening') === 'on',
						accessInfo: field(form, 'accessInfo').trim().slice(0, 2000),
						accessInfoEs: field(form, 'accessInfoEs').trim().slice(0, 2000) || null
					}
				: {}),
			rules: field(form, 'rules').trim().slice(0, 2000)
		}
	};
}

function accessibilityInput(
	form: FormData
): Pick<
	FacilityInput,
	| 'stepFreeAccess'
	| 'adaptedToilet'
	| 'adaptedChangingRoom'
	| 'accessibleParkingNearby'
	| 'hearingLoop'
	| 'supportContact'
	| 'accessibilityNotes'
	| 'accessibilityCheckedAt'
> {
	const step = field(form, 'stepFreeAccess');
	const choice = (name: string): boolean | null => {
		const value = field(form, name);
		return value === 'yes' ? true : value === 'no' ? false : null;
	};
	return {
		stepFreeAccess: step === 'yes' || step === 'no' || step === 'partial' ? step : null,
		adaptedToilet: choice('adaptedToilet'),
		adaptedChangingRoom: choice('adaptedChangingRoom'),
		accessibleParkingNearby: choice('accessibleParkingNearby'),
		hearingLoop: choice('hearingLoop'),
		supportContact: field(form, 'supportContact').trim().slice(0, 120) || null,
		accessibilityNotes: field(form, 'accessibilityNotes').trim().slice(0, 300) || null,
		accessibilityCheckedAt: field(form, 'accessibilityCheckedAt') || null
	};
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Tramos por día que leen los formularios (`h-{día}-{tramo}-…`); la pantalla muestra 2 o más. */
export const MAX_RANGES = 4;

/** Error de un día del horario: hora a medias, fin antes del comienzo, solape, duración, modo día. */
export type HourError = 'formato' | 'orde' | 'solapa' | 'multiplo' | 'un_tramo';

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Horario de los campos `h-{día}-{tramo}-opens|closes`, con el error de cada día que tenga una
 * hora a medias o mal escrita. `get` lee un campo ('' si falta).
 */
export function readHours(get: (name: string) => string): {
	hours: Hours[];
	dayErrors: Record<number, HourError>;
} {
	const hours: Hours[] = [];
	const dayErrors: Record<number, HourError> = {};
	for (let weekday = 0; weekday < 7; weekday++) {
		for (let slot = 0; slot < MAX_RANGES; slot++) {
			const opens = get(`h-${weekday}-${slot}-opens`).trim();
			const closes = get(`h-${weekday}-${slot}-closes`).trim();
			if (!opens && !closes) continue;
			if (!TIME.test(opens) || !TIME.test(closes)) {
				dayErrors[weekday] = 'formato';
				continue;
			}
			hours.push({ weekday, opens, closes });
		}
	}
	return { hours, dayErrors };
}

/**
 * Errores por día de un horario bien escrito. Sin `mode` solo mira el orden y los solapes; con él
 * también que cada tramo encaje con la duración de la reserva (las mismas reglas que
 * `validateHours`, pero por día para señalar la casilla).
 */
export function hourDayErrors(
	hours: Hours[],
	rules?: { mode: BookingMode; slotMinutes: number; actorId?: string }
): Record<number, HourError> {
	const out: Record<number, HourError> = {};
	for (let weekday = 0; weekday < 7; weekday++) {
		const day = hours
			.filter((h) => h.weekday === weekday)
			.map((h) => ({ opens: minutesOf(h.opens), closes: minutesOf(h.closes) }))
			.sort((a, b) => a.opens - b.opens);
		if (day.some((r) => r.closes <= r.opens)) out[weekday] = 'orde';
		else if (day.some((r, i) => i > 0 && r.opens < day[i - 1].closes)) out[weekday] = 'solapa';
		else if (rules?.mode === 'day' && day.length > 1) out[weekday] = 'un_tramo';
		else if (
			rules &&
			rules.mode !== 'day' &&
			day.some((r) => (r.closes - r.opens) % rules.slotMinutes !== 0)
		) {
			out[weekday] = 'multiplo';
		}
	}
	return out;
}

/** Horario de los campos del formulario, o `null` si alguna hora está a medias o mal escrita. */
export function parseHours(form: FormData): Hours[] | null {
	const { hours, dayErrors } = readHours((name) => field(form, name));
	return Object.keys(dayErrors).length ? null : hours;
}

/**
 * Guardar el horario de una instalación (ficha y tabla de Horarios): mismos pasos en las dos.
 * 1. Horas mal escritas o tramos imposibles → 400 con el error de cada día.
 * 2. Sin `confirmar=1`, si deja fuera reservas confirmadas → 409 «hai N reservas» (no cancela).
 * 3. `replaceHours`; con `confirmar=1` avisa en la misma transacción a quien queda fuera.
 */
export async function saveHours(
	db: Db,
	municipalityId: string,
	facilityId: string,
	form: FormData,
	now: Date,
	rules?: { mode: BookingMode; slotMinutes: number; actorId?: string }
) {
	const values = echo(form);
	const read = readHours((name) => field(form, name));
	if (Object.keys(read.dayErrors).length) {
		return fail(400, {
			error: 'INVALID' as const,
			hoursError: true as const,
			dayErrors: read.dayErrors,
			facilityId,
			values
		});
	}
	const dayErrors = hourDayErrors(read.hours, rules);
	if (Object.keys(dayErrors).length) {
		return fail(400, {
			error: 'INVALID_CONFIG' as const,
			hoursError: true as const,
			issues: [] as ConfigIssue[],
			dayErrors,
			facilityId,
			values
		});
	}
	const confirmed = field(form, 'confirmar') === '1';
	if (!confirmed) {
		const affected = await countBookingsOutsideHours(
			db,
			municipalityId,
			facilityId,
			read.hours,
			now
		);
		if (affected > 0) {
			return fail(409, { affected, accion: 'horario' as const, facilityId, values });
		}
	}
	const res = await replaceHours(db, municipalityId, facilityId, read.hours, {
		notifyNow: confirmed ? now : undefined,
		actorId: rules?.actorId
	});
	if (!res.ok) {
		const f = failOf(res.error, { issues: res.issues });
		return fail(f.status, { ...f.data, hoursError: true as const, facilityId, values });
	}
	return { hoursSaved: true as const, facilityId };
}

export function parseTypeForm(form: FormData): FacilityTypeInput | null {
	const nameGl = field(form, 'nameGl').trim();
	const nameEs = field(form, 'nameEs').trim();
	const color = field(form, 'color').trim();
	const rawMascot = field(form, 'mascot').trim();
	const bookingMode = field(form, 'bookingMode') as BookingMode;
	const mascot = rawMascot === '' ? DEFAULT_MASCOT : (rawMascot as Mascot);
	if (
		!nameGl ||
		!nameEs ||
		nameGl.length > 80 ||
		nameEs.length > 80 ||
		!/^#[0-9a-f]{6}$/i.test(color) ||
		!(MASCOTS as readonly string[]).includes(mascot) ||
		!MODES.includes(bookingMode)
	) {
		return null;
	}
	return { nameGl, nameEs, mascot, color, bookingMode };
}
