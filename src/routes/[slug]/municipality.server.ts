// SPDX-License-Identifier: EUPL-1.2
// Concello de la ruta para las páginas de la vecindad: 404 si el slug no existe.
import { error } from '@sveltejs/kit';
import type { Db } from '../../lib/server/db/client';
import { getMunicipalityShell } from '../../lib/server/services/municipalities';

export async function requireMunicipality(db: Db, slug: string) {
	const municipality = await getMunicipalityShell(db, slug);
	if (!municipality) error(404);
	return municipality;
}

/** Texto 'HH:MM' válido o null («calquera hora»). */
export function parseTime(value: string | null): string | null {
	return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

/** Fecha 'YYYY-MM-DD' que existe en el calendario (no 2026-02-31) o null. */
export function parseDate(value: string | null): string | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [y, m, d] = value.split('-').map(Number);
	const real = new Date(Date.UTC(y, m - 1, d));
	return real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === d
		? value
		: null;
}

/** `date` dentro de la ventana [first, last]; fuera, el extremo más cercano. */
export function clampDate(date: string, first: string, last: string): string {
	return date < first ? first : date > last ? last : date;
}
