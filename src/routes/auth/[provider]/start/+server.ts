// SPDX-License-Identifier: EUPL-1.2
import { randomBytes } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { RequestHandler } from './$types';
import { isProvider, readIdentityConfig } from '../../../../lib/server/auth/config';
import { buildAuthorizationRequest } from '../../../../lib/server/auth/oidc';
import { safeRedirect } from '../../../../lib/server/auth/safe-redirect';
import { fail } from '../../../../lib/server/http/respond';

const AUTH_STATE_COOKIE = 'auth_state';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
	const config = readIdentityConfig();
	if (!isProvider(params.provider) || config.mode === 'disabled') {
		return fail('NOT_FOUND');
	}
	if (config.mode === 'oidc') {
		const provider = config.providers[params.provider];
		if (!provider) return fail('NOT_FOUND');
		let request: Awaited<ReturnType<typeof buildAuthorizationRequest>>;
		try {
			request = await buildAuthorizationRequest(provider);
		} catch {
			return fail('VALIDATION_FAILED');
		}
		cookies.set(AUTH_STATE_COOKIE, JSON.stringify({ state: request.state, nonce: request.nonce, codeVerifier: request.codeVerifier, redirectTo: safeRedirect(url.searchParams.get('redirectTo')) }), {
			httpOnly: true, sameSite: 'lax', path: '/', secure: !dev, maxAge: 600
		});
		redirect(303, request.url);
	}
	const state = randomBytes(24).toString('base64url');
	cookies.set(
		AUTH_STATE_COOKIE,
		JSON.stringify({
			state,
			redirectTo: safeRedirect(url.searchParams.get('redirectTo'))
		}),
		{
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: !dev,
			maxAge: 600
		}
	);
	redirect(303, `/simulador/${params.provider}?state=${encodeURIComponent(state)}`);
};
