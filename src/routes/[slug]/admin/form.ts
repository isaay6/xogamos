// SPDX-License-Identifier: EUPL-1.2
// Ayudas de los formularios de ajustes de la zona admin (no es una ruta: SvelteKit solo admite
// exports estándar en `+page.server.ts`).
import type { Db } from '../../../lib/server/db/client';
import { getSettings, updateSettings, type Settings } from '../../../lib/server/services/admin';

/** Texto de un campo del formulario ('' si falta o es un archivo). */
export function field(form: FormData, name: string): string {
	const v = form.get(name);
	return typeof v === 'string' ? v : '';
}

/** Entero de un campo, o `null` si no es un entero válido dentro del rango. */
export function intField(form: FormData, name: string, min: number, max: number): number | null {
	const raw = field(form, name).trim();
	if (!/^\d+$/.test(raw)) return null;
	const n = Number(raw);
	return n >= min && n <= max ? n : null;
}

/** Ajustes completos: lee los actuales y aplica los cambios (el PUT reemplaza todo). */
export async function mergeSettings(
	db: Db,
	municipalityId: string,
	changes: Partial<Settings>
): Promise<Settings | null> {
	const current = await getSettings(db, municipalityId);
	const res = await updateSettings(db, municipalityId, { ...current, ...changes });
	return res.ok ? res.value : null;
}
