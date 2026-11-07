// SPDX-License-Identifier: EUPL-1.2
// Guarda común de la zona: solo `admin` del concello. El layout y las páginas la llaman las dos
// (SvelteKit carga layout y página en paralelo, así que cada una debe comprobar).
import { error, type RequestEvent } from '@sveltejs/kit';
import { requirePageStaff } from '../../../lib/server/http/page-guards';
import { getMunicipalityBySlug } from '../../../lib/server/services/municipalities';

export async function requireAdminPage(event: Pick<RequestEvent, 'locals' | 'params' | 'url'>) {
	const municipality = await getMunicipalityBySlug(event.locals.db, event.params.slug ?? '');
	if (!municipality) error(404);
	const user = await requirePageStaff(event, municipality.id, ['admin']);
	return { municipality, user };
}
