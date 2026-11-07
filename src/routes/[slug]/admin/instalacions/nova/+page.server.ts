// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { createFacility, listFacilityTypes } from '../../../../../lib/server/services/admin';
import { requireAdminPage } from '../../guard';
import { echo, failOf, parseFacilityForm } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	return { types: await listFacilityTypes(event.locals.db, municipality.id) };
};

export const actions: Actions = {
	default: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const values = echo(form);
		const types = await listFacilityTypes(event.locals.db, municipality.id);
		const parsed = parseFacilityForm(form, types);
		if ('error' in parsed) {
			return parsed.error === 'NOT_FOUND'
				? fail(404, { error: 'NOT_FOUND' as const, values })
				: fail(400, { error: 'INVALID' as const, values });
		}
		const res = await createFacility(event.locals.db, municipality.id, parsed.input, [], user.id);
		if (!res.ok) {
			const f = failOf(res.error, { issues: res.issues });
			return fail(f.status, { ...f.data, values });
		}
		redirect(303, `/${municipality.slug}/admin/instalacions/${res.value.id}`);
	}
};
