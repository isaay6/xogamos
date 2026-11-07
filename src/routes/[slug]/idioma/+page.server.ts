// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { localeCookieOptions, localeFromCookie, LOCALE_COOKIE } from '../../../lib/i18n';
import { safeRedirect } from '../../../lib/server/auth/safe-redirect';
import type { Actions, PageServerLoad } from './$types';

// Esta ruta solo existe para el POST del selector de idioma: un GET vuelve al concello.
export const load: PageServerLoad = ({ params }) => redirect(303, `/${params.slug}`);

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const lingua = localeFromCookie(String(form.get('lingua') ?? ''));
		cookies.set(LOCALE_COOKIE, lingua, localeCookieOptions(url.protocol === 'https:'));
		const target = form.get('redirectTo');
		redirect(303, safeRedirect(typeof target === 'string' ? target : null));
	}
};
