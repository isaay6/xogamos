// SPDX-License-Identifier: EUPL-1.2
// Lógica del asistente de nueva instalación (no es una ruta: SvelteKit solo admite exports
// estándar en `+page.server.ts`). El estado viaja en campos ocultos: `values` son esos campos.
import { MASCOTS, type Mascot } from '../../../../../lib/mascots';
import { MAX_PRICE_CENTS } from '../../../../../lib/server/domain/config-validation';
import type { BookingMode, Hours } from '../../../../../lib/server/domain/types';
import type { FacilityInput } from '../../../../../lib/server/services/admin';
import {
	FACILITY_TEMPLATES,
	templateByKey
} from '../../../../../lib/server/services/facility-templates';
import { hourDayErrors, MODES, readHours } from '../form';
import { eurosInput, parseEuros } from '../text';

export type Values = Record<string, string>;
/** Campo → código de error (`adm.asis.erro.<código>`). Los días del horario van como `h-<día>`. */
export type Errors = Record<string, string>;
export type Building = { location: string; address: string };

/** Pasos 0–6: modelo, deporte e nome, onde, pistas e aforo, horario, prezos, revisar. */
export const LAST_STEP = 6;
export const ZERO = 'cero';

/** Campos de control: no son estado del asistente. */
const CONTROL = new Set(['paso', 'ir', 'confirmar']);
const isHour = (k: string) => /^h-\d-\d-(opens|closes)$/.test(k);

export function clampStep(raw: string | null | undefined): number {
	const n = Number(raw);
	return Number.isInteger(n) ? Math.min(LAST_STEP, Math.max(0, n)) : 0;
}

/** El estado del asistente que trae el formulario (sin los campos de control). */
export function valuesOf(form: FormData): Values {
	const out: Values = {};
	for (const [k, v] of form) if (typeof v === 'string' && !CONTROL.has(k)) out[k] = v;
	return out;
}

const get = (v: Values, k: string) => (v[k] ?? '').trim();

/**
 * Valores del modelo elegido: deporte, modo, pistas, aforo, duración, horario y precios. Lo que no
 * depende del modelo (nombre, lugar, accesible) se mantiene. «Desde cero» lo deja por cubrir.
 */
export function applyTemplate(values: Values): Values {
	const key = get(values, 'modelo');
	const kept: Values = {};
	for (const [k, v] of Object.entries(values)) if (!isHour(k)) kept[k] = v;
	const t = templateByKey(key);
	if (!t) {
		return {
			...kept,
			aplicado: ZERO,
			mascota: '',
			modo: 'slot',
			unidades: '2',
			aforo: '10',
			minutos: '60',
			prezoRes: '',
			prezoNon: '',
			prezoSocial: ''
		};
	}
	const hours: Values = {};
	for (const h of t.hours) {
		const n = t.hours.filter((x) => x.weekday === h.weekday).indexOf(h);
		hours[`h-${h.weekday}-${n}-opens`] = h.opens;
		hours[`h-${h.weekday}-${n}-closes`] = h.closes;
	}
	return {
		...kept,
		aplicado: t.key,
		mascota: t.mascot,
		modo: t.bookingMode,
		unidades: String(t.units),
		aforo: String(t.capacity),
		minutos: String(t.slotMinutes),
		prezoRes: eurosInput(t.priceResidentCents),
		prezoNon: eurosInput(t.priceNonResidentCents),
		prezoSocial: t.priceSocialCents === null ? '' : eurosInput(t.priceSocialCents),
		...hours
	};
}

/** Paso 2: un edificio que ya existe (`edificio` = su posición) pone su lugar y su enderezo. */
export function applyBuilding(values: Values, buildings: Building[]): Values {
	const pick = get(values, 'edificio');
	if (!/^\d+$/.test(pick)) return values;
	const b = buildings[Number(pick)];
	return b ? { ...values, lugar: b.location, enderezo: b.address } : values;
}

const intIn = (raw: string, min: number, max: number) => {
	if (!/^\d+$/.test(raw)) return null;
	const n = Number(raw);
	return n >= min && n <= max ? n : null;
};

const price = (raw: string) => {
	const c = parseEuros(raw);
	return c !== null && c <= MAX_PRICE_CENTS ? c : null;
};

const validMinutes = (raw: string) => {
	const n = intIn(raw, 15, 1440);
	return n !== null && n % 15 === 0 ? n : null;
};

/** Errores de un paso (vacío = se puede seguir). */
export function validateStep(step: number, v: Values): Errors {
	const e: Errors = {};
	switch (step) {
		case 0:
			if (get(v, 'modelo') !== ZERO && !templateByKey(get(v, 'modelo'))) e.modelo = 'modelo';
			break;
		case 1: {
			if (!(MASCOTS as readonly string[]).includes(get(v, 'mascota'))) e.mascota = 'deporte';
			const nome = get(v, 'nome');
			if (!nome) e.nome = 'nome';
			else if (nome.length > 120) e.nome = 'longo';
			break;
		}
		case 2: {
			const lugar = get(v, 'lugar');
			if (!lugar) e.lugar = 'lugar';
			else if (lugar.length > 200) e.lugar = 'longo';
			if (get(v, 'enderezo').length > 200) e.enderezo = 'longo';
			break;
		}
		case 3: {
			const mode = get(v, 'modo') as BookingMode;
			if (!MODES.includes(mode)) e.modo = 'modo';
			if (validMinutes(get(v, 'minutos')) === null) e.minutos = 'minutos';
			if (mode === 'unit' && intIn(get(v, 'unidades'), 2, 999) === null) e.unidades = 'unidades';
			if (mode === 'capacity' && intIn(get(v, 'aforo'), 2, 9999) === null) e.aforo = 'aforo';
			break;
		}
		case 4: {
			const { hours, dayErrors } = readHours((k) => get(v, k));
			const mode = get(v, 'modo') as BookingMode;
			const minutes = validMinutes(get(v, 'minutos'));
			const rules = MODES.includes(mode) && minutes ? { mode, slotMinutes: minutes } : undefined;
			const all = { ...hourDayErrors(hours, rules), ...dayErrors };
			for (const [d, code] of Object.entries(all)) e[`h-${d}`] = code;
			if (hours.length === 0 && Object.keys(dayErrors).length === 0) e.horario = 'sen_horario';
			break;
		}
		case 5:
			if (price(get(v, 'prezoRes')) === null) e.prezoRes = 'prezo';
			if (price(get(v, 'prezoNon')) === null) e.prezoNon = 'prezo';
			if (get(v, 'prezoSocial') && price(get(v, 'prezoSocial')) === null) {
				e.prezoSocial = 'prezo';
			}
			break;
	}
	return e;
}

/** Primer paso con errores de `[from, to)`, o `null` si todos valen. */
export function firstInvalid(
	v: Values,
	from: number,
	to: number
): { step: number; errors: Errors } | null {
	for (let s = from; s < to; s++) {
		const errors = validateStep(s, v);
		if (Object.keys(errors).length) return { step: s, errors };
	}
	return null;
}

/** Datos para crear, de unos valores ya validados (pasos 0–5). */
export function buildInput(v: Values): {
	mascot: Mascot;
	mode: BookingMode;
	facility: Omit<FacilityInput, 'typeId'>;
	hours: Hours[];
} {
	const mode = get(v, 'modo') as BookingMode;
	const social = get(v, 'prezoSocial');
	return {
		mascot: get(v, 'mascota') as Mascot,
		mode,
		facility: {
			name: get(v, 'nome'),
			location: get(v, 'lugar'),
			address: get(v, 'enderezo'),
			units: mode === 'unit' ? Number(get(v, 'unidades')) : 1,
			capacity: mode === 'capacity' ? Number(get(v, 'aforo')) : 1,
			slotMinutes: Number(get(v, 'minutos')),
			priceResidentCents: price(get(v, 'prezoRes')) ?? 0,
			priceNonResidentCents: price(get(v, 'prezoNon')) ?? 0,
			priceSocialCents: social ? price(social) : null,
			accessible: get(v, 'accesible') === 'on',
			rules: ''
		},
		hours: readHours((k) => get(v, k)).hours
	};
}

/** Lo que la página necesita de cada modelo (las tarjetas del paso 0). */
export const templateCards = () =>
	FACILITY_TEMPLATES.map((t) => ({
		key: t.key,
		mascot: t.mascot,
		bookingMode: t.bookingMode,
		slotMinutes: t.slotMinutes,
		units: t.units,
		capacity: t.capacity
	}));
