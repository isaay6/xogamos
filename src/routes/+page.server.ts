// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { hasDeputacionRole } from '../lib/server/services/deputacion';
import { listMunicipalityCards } from '../lib/server/services/municipalities';
import type { PageServerLoad } from './$types';

// Un solo concello, o el de la cookie `concello` si sigue existiendo: directo a él.
// En otro caso, lista por nombre para elegir.
export const load: PageServerLoad = async ({ locals, cookies }) => {
	const all = await listMunicipalityCards(locals.db);
	if (all.length === 1) redirect(307, `/${all[0].slug}`);
	const remembered = cookies.get('concello');
	if (remembered && all.some((m) => m.slug === remembered)) redirect(307, `/${remembered}`);
	// Solo con el rol provincial se ofrece el panel de la Deputación.
	const isDeputacion = locals.user ? await hasDeputacionRole(locals.db, locals.user.id) : false;
	return { municipalities: all, isDeputacion };
};
