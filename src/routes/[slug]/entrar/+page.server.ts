// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { safeRedirect } from '../../../lib/server/auth/safe-redirect';
import { readIdentityConfig } from '../../../lib/server/auth/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url, locals }) => {
	const param = url.searchParams.get('redirectTo');
	// Sin destino, de vuelta al concello; con destino, solo rutas locales.
	const redirectTo = param === null ? `/${params.slug}` : safeRedirect(param);
	if (locals.user) redirect(303, redirectTo);
	const identity = readIdentityConfig();
	return {
		redirectTo,
		enabledProviders: identity.mode === 'oidc' ? Object.keys(identity.providers) : ['clave', 'chave365']
	};
};
