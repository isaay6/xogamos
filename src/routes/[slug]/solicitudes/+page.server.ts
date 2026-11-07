// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { responsibleEntities } from '../../../lib/server/services/entities';
import { listOwnRequests, withdrawRequest } from '../../../lib/server/services/requests';
import { requirePageUser } from '../../../lib/server/http/page-guards';
import { requireMunicipality } from '../municipality.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const [rows, entities] = await Promise.all([
		listOwnRequests(event.locals.db, municipality.id, user.id),
		responsibleEntities(event.locals.db, municipality.id, user.id)
	]);
	return { rows, entities };
};

export const actions: Actions = {
	retirar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const id = String((await event.request.formData()).get('id') ?? '');
		const result = await withdrawRequest(event.locals.db, municipality.id, user.id, id);
		return result.ok ? { withdrawn: true as const } : fail(404, { error: result.error });
	}
};
