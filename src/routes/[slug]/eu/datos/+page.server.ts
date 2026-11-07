// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { ContactInput, getSummary, updateContact } from '../../../../lib/server/services/me';
import { requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const summary = await getSummary(event.locals.db, municipality.id, user.id, event.locals.now());
	return {
		displayName: summary?.displayName ?? user.displayName,
		provider: summary?.provider ?? 'local',
		email: summary?.email ?? '',
		phone: summary?.phone ?? '',
		saved: event.url.searchParams.get('gardado') === '1'
	};
};

const text = (form: FormData, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v : '';
};

export const actions: Actions = {
	default: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const values = { email: text(form, 'email'), phone: text(form, 'phone') };

		// Mismos criterios que `PATCH /me`: los errores se asocian al campo.
		const parsed = ContactInput.safeParse(values);
		if (!parsed.success) {
			const issues: { email?: true; phone?: true } = {};
			for (const issue of parsed.error.issues) {
				if (issue.path[0] === 'email') issues.email = true;
				else if (issue.path[0] === 'phone') issues.phone = true;
			}
			return fail(400, { issues, values });
		}
		const result = await updateContact(event.locals.db, user.id, parsed.data);
		if (!result.ok) return fail(400, { issues: { other: true }, values });
		redirect(303, `/${municipality.slug}/eu/datos?gardado=1`);
	}
};
