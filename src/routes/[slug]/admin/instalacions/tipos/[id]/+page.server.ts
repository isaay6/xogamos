// SPDX-License-Identifier: EUPL-1.2
import { error, fail, redirect } from '@sveltejs/kit';
import {
	createFacilityType,
	listFacilityTypes,
	updateFacilityType
} from '../../../../../../lib/server/services/admin';
import { MASCOTS } from '../../../../../../lib/mascots';
import { requireAdminPage } from '../../../guard';
import { echo, failOf, isUuid, parseTypeForm } from '../../form';
import type { Actions, PageServerLoad } from './$types';

const NEW = 'novo';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const id = event.params.id;
	if (id === NEW) return { type: null, mascots: [...MASCOTS] };
	if (!isUuid(id)) error(404);
	const type = (await listFacilityTypes(event.locals.db, municipality.id)).find((t) => t.id === id);
	if (!type) error(404);
	return { type, mascots: [...MASCOTS] };
};

export const actions: Actions = {
	default: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const values = echo(form);
		const input = parseTypeForm(form);
		if (!input) return fail(400, { error: 'INVALID' as const, values });
		const list = `/${municipality.slug}/admin/instalacions`;
		if (event.params.id === NEW) {
			await createFacilityType(event.locals.db, municipality.id, input);
			redirect(303, list);
		}
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const res = await updateFacilityType(
			event.locals.db,
			municipality.id,
			event.params.id,
			input,
			event.locals.now()
		);
		if (!res.ok) {
			const f = failOf(res.error, { issues: res.issues });
			return fail(f.status, { ...f.data, values });
		}
		return { saved: true as const };
	}
};
