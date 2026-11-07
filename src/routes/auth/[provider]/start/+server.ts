// SPDX-License-Identifier: EUPL-1.2
import { randomBytes } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { RequestHandler } from './$types';
import { isProvider, readIdentityConfig } from '../../../../lib/server/auth/config';
import { safeRedirect } from '../../../../lib/server/auth/safe-redirect';
import { fail } from '../../../../lib/server/http/respond';

const AUTH_STATE_COOKIE = 'auth_state';

export const GET: RequestHandler = ({ params, url, cookies }) => {
	if (!isProvider(params.provider) || readIdentityConfig().mode !== 'simulated') {
		return fail('NOT_FOUND');
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
