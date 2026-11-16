// SPDX-License-Identifier: EUPL-1.2
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { verifyAssertion } from '../../../../lib/server/auth/assertion';
import { isProvider, readIdentityConfig } from '../../../../lib/server/auth/config';
import { startSession } from '../../../../lib/server/auth/login';
import { redirectAfterLogin } from '../../../../lib/server/auth/login-complete';
import { exchangeCode, verifyIdToken } from '../../../../lib/server/auth/oidc';
import { fail } from '../../../../lib/server/http/respond';

const stateCookie = z.object({
	state: z.string().min(1),
	redirectTo: z.string()
});

function sameString(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
	const config = readIdentityConfig();
	if (!isProvider(params.provider) || config.mode === 'disabled') return fail('NOT_FOUND');
	if (config.mode === 'oidc') {
		const provider = config.providers[params.provider];
		if (!provider) return fail('NOT_FOUND');
		const raw = cookies.get('auth_state');
		if (url.searchParams.has('error') || !raw) return fail('VALIDATION_FAILED');
		let saved: z.infer<typeof stateCookie> & { nonce?: string; codeVerifier?: string };
		try { saved = z.object({ state: z.string().min(1), nonce: z.string().min(1), codeVerifier: z.string().min(1), redirectTo: z.string() }).parse(JSON.parse(raw)); } catch { return fail('VALIDATION_FAILED'); }
		const state = url.searchParams.get('state');
		const code = url.searchParams.get('code');
		if (!state || !code || !sameString(state, saved.state)) return fail('VALIDATION_FAILED');
		const exchanged = await exchangeCode(provider, code, saved.codeVerifier!);
		if (!exchanged.ok) return fail('VALIDATION_FAILED');
		const identity = await verifyIdToken(provider, exchanged.value, saved.nonce!);
		if (!identity.ok) return fail('VALIDATION_FAILED');
		const user = await startSession({ locals, cookies }, { provider: params.provider, ...identity.value });
		cookies.delete('auth_state', { path: '/' });
		return redirectAfterLogin(locals, user, saved.redirectTo);
	}

	const assertion = url.searchParams.get('assertion');
	const raw = cookies.get('auth_state');
	if (!assertion || !raw) return fail('VALIDATION_FAILED');
	let saved: z.infer<typeof stateCookie>;
	try {
		saved = stateCookie.parse(JSON.parse(raw));
	} catch {
		return fail('VALIDATION_FAILED');
	}

	const now = locals.now();
	const verified = verifyAssertion(assertion, config.secret!, now);
	if (!verified.ok) return fail('VALIDATION_FAILED');
	const payload = verified.value;
	if (payload.provider !== params.provider || !sameString(payload.state, saved.state)) {
		return fail('VALIDATION_FAILED');
	}

	// Nunca se reutiliza la sesión previa: `startSession` la invalida antes de abrir la nueva.
	const user = await startSession(
		{ locals, cookies },
		{
			provider: payload.provider,
			subject: payload.subject,
			displayName: payload.displayName,
			email: payload.email
		}
	);
	cookies.delete('auth_state', { path: '/' });
	return redirectAfterLogin(locals, user, saved.redirectTo);
};
