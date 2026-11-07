// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { localeCookieOptions, localeFromCookie, LOCALE_COOKIE } from '../../../lib/i18n';
import { safeRedirect } from '../../../lib/server/auth/safe-redirect';
import { requirePageDeputacion } from '../../../lib/server/http/page-guards';
import type { Actions, PageServerLoad } from './$types';

// Solo existe para el POST del selector de idioma del panel: un GET vuelve a la comparativa.
export const load: PageServerLoad = async (event) => {
	await requirePageDeputacion(event);
	redirect(303, '/deputacion');
};

export const actions: Actions = {
	default: async (event) => {
		await requirePageDeputacion(event);
		const { request, cookies, url } = event;
		const form = await request.formData();
		const lingua = localeFromCookie(String(form.get('lingua') ?? ''));
		cookies.set(LOCALE_COOKIE, lingua, localeCookieOptions(url.protocol === 'https:'));
		const target = form.get('redirectTo');
		redirect(303, safeRedirect(typeof target === 'string' ? target : '/deputacion'));
	}
};
