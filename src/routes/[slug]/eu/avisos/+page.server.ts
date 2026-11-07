// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { readProfileUser, saveNoticePrefs } from '../../../../lib/server/http/profile-forms';
import { requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

// Preferencias de avisos: só na app ou tamén por correo, con consentimento explícito.

export const load: PageServerLoad = async (event) => {
	await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const me = await readProfileUser(event.locals.db, user.id);
	return {
		email: me.email,
		notifyEmail: me.notifyEmail,
		saved: event.url.searchParams.get('gardado') === '1'
	};
};

export const actions: Actions = {
	default: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const failed = await saveNoticePrefs(event.locals.db, user.id, form, event.locals.now());
		if (failed) return failed;
		redirect(303, `/${municipality.slug}/eu/avisos?gardado=1`);
	}
};
