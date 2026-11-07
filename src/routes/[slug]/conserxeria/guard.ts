// SPDX-License-Identifier: EUPL-1.2
// Guarda compartida de las páginas del mostrador: concello por `slug` y rol de conserje.
import { error, type RequestEvent } from '@sveltejs/kit';
import { requirePageStaff } from '../../../lib/server/http/page-guards';
import { getMunicipalityShell } from '../../../lib/server/services/municipalities';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Concello de la ruta y usuario conserje (o admin); 404 si no existe, 303/403 según la guarda. */
export async function staffContext(event: Pick<RequestEvent, 'locals' | 'params' | 'url'>) {
	const municipality = await getMunicipalityShell(event.locals.db, event.params.slug ?? '');
	if (!municipality) error(404);
	const user = await requirePageStaff(event, municipality.id, ['conserxe', 'apertura']);
	return { municipality, user };
}

/** Accións completas do mostrador, excluídas do rol de apertura. */
export async function deskContext(event: Pick<RequestEvent, 'locals' | 'params' | 'url'>) {
	const municipality = await getMunicipalityShell(event.locals.db, event.params.slug ?? '');
	if (!municipality) error(404);
	const user = await requirePageStaff(event, municipality.id, ['conserxe']);
	return { municipality, user };
}
