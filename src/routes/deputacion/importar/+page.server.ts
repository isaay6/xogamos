// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { requirePageDeputacion } from '../../../lib/server/http/page-guards';
import { importMunicipalityConfig } from '../../../lib/server/services/municipality-import';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requirePageDeputacion(event);
};
export const actions: Actions = {
	default: async (event) => {
		await requirePageDeputacion(event);
		const form = await event.request.formData();
		const slug = form.get('slug');
		const name = form.get('name');
		const file = form.get('file');
		if (
			typeof slug !== 'string' ||
			!/^[a-z0-9-]{1,80}$/.test(slug) ||
			typeof name !== 'string' ||
			!name.trim() ||
			!(file instanceof File)
		)
			return fail(400, { error: 'Revisa o nome, o slug e o ficheiro JSON.' });
		let contents: unknown;
		try {
			contents = JSON.parse(await file.text());
		} catch {
			return fail(400, { error: 'O ficheiro non é JSON válido.' });
		}
		try {
			await importMunicipalityConfig(event.locals.db, contents, {
				slug,
				name: name.trim(),
				now: event.locals.now()
			});
		} catch {
			return fail(400, {
				error: 'O ficheiro non é unha exportación de configuración válida ou o slug xa existe.'
			});
		}
		redirect(303, `/deputacion?novo=${slug}`);
	}
};
