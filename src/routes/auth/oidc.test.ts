// SPDX-License-Identifier: EUPL-1.2
// Fluxo completo de acceso por OpenID Connect contra un provedor falso (sen rede).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const ISSUER = 'https://idp.exemplo.gal/realms/xogamos';
const env = vi.hoisted(() => ({ OIDC_CHAVE365_ISSUER: undefined as string | undefined }));
vi.mock('$app/env/private', () => ({
	DEMO: undefined,
	DEMO_DATABASE_IS_DISPOSABLE: undefined,
	IDENTITY_MODE: 'oidc',
	AUTH_SECRET: 'k'.repeat(40),
	// Modo de produción: con base de datos real e sen simulador.
	DATABASE_URL: 'postgres://reservas:x@db:5432/reservas',
	PUBLIC_ORIGIN: 'https://reservas.exemplo.gal',
	OIDC_SCOPES: undefined,
	OIDC_SUBJECT_CLAIM: undefined,
	OIDC_CLAVE_ISSUER: 'https://idp.exemplo.gal/realms/xogamos',
	OIDC_CLAVE_CLIENT_ID: 'xogamos',
	OIDC_CLAVE_CLIENT_SECRET: undefined,
	get OIDC_CHAVE365_ISSUER() {
		return env.OIDC_CHAVE365_ISSUER;
	},
	OIDC_CHAVE365_CLIENT_ID: undefined,
	OIDC_CHAVE365_CLIENT_SECRET: undefined
}));

import { createTestDb } from '../../lib/server/db/test-db';
import type { Db } from '../../lib/server/db/client';
import { users } from '../../lib/server/db/schema';
import { makeEvent } from '../../lib/server/http/test-event';
import { clearOidcDiscoveryCache } from '../../lib/server/auth/oidc';
import { validateSession } from '../../lib/server/services/sessions';
import { GET as start } from './[provider]/start/+server';
import { GET as callback } from './[provider]/callback/+server';

async function run(fn: () => unknown): Promise<unknown> {
	try {
		return await fn();
	} catch (e) {
		return e;
	}
}
const status = (r: unknown) => (r as { status: number }).status;
function location(res: unknown): string {
	const r = res as { location?: string; headers?: Headers };
	return r.location ?? r.headers!.get('location')!;
}

const now = new Date();
let db: Db;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwks: { keys: unknown[] };
/** O que devolverá o punto de tokens: cada proba decide o ID token. */
let tokenResponse: () => Response;
let tokenRequests: URLSearchParams[];

beforeAll(async () => {
	db = await createTestDb();
	const keys = await generateKeyPair('RS256');
	privateKey = keys.privateKey;
	jwks = { keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] };
});

beforeEach(() => {
	clearOidcDiscoveryCache();
	tokenRequests = [];
	tokenResponse = () => new Response('{}', { status: 400 });
	vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === `${ISSUER}/.well-known/openid-configuration`) {
			return Response.json({
				issuer: ISSUER,
				authorization_endpoint: `${ISSUER}/auth`,
				token_endpoint: `${ISSUER}/token`,
				jwks_uri: `${ISSUER}/certs`
			});
		}
		if (url === `${ISSUER}/certs`) return Response.json(jwks);
		if (url === `${ISSUER}/token`) {
			tokenRequests.push(init!.body as URLSearchParams);
			return tokenResponse();
		}
		return new Response('non atopado', { status: 404 });
	});
});
afterEach(() => vi.unstubAllGlobals());

async function idToken(nonce: string, subject = '12345678Z'): Promise<string> {
	return new SignJWT({ nonce, name: 'Persoa Proba' })
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(ISSUER)
		.setAudience('xogamos')
		.setSubject(subject)
		.setIssuedAt()
		.setExpirationTime('5m')
		.sign(privateKey);
}

async function doStart(provider = 'clave', redirectTo = '/viana-do-bolo') {
	const event = makeEvent({
		db,
		now,
		params: { provider },
		url: `https://reservas.exemplo.gal/auth/${provider}/start?redirectTo=${encodeURIComponent(redirectTo)}`
	});
	const res = await run(() => start(event as never));
	const cookie = event.cookies.sets.find((c) => c.name === 'auth_state');
	return { res, cookie };
}

async function doCallback(query: string, cookieValue?: string) {
	const event = makeEvent({
		db,
		now,
		params: { provider: 'clave' },
		url: `https://reservas.exemplo.gal/auth/clave/callback?${query}`,
		cookies: cookieValue ? { auth_state: cookieValue } : {}
	});
	const res = await run(() => callback(event as never));
	return { res, event };
}

describe('acceso por OpenID Connect', () => {
	it('start leva ao provedor con PKCE e garda estado, nonce e verificador nunha cookie httpOnly', async () => {
		const { res, cookie } = await doStart();
		expect(status(res)).toBe(303);
		const url = new URL(location(res));
		expect(url.origin + url.pathname).toBe(`${ISSUER}/auth`);
		expect(url.searchParams.get('redirect_uri')).toBe(
			'https://reservas.exemplo.gal/auth/clave/callback'
		);
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		const saved = JSON.parse(cookie!.value);
		expect(saved.state).toBe(url.searchParams.get('state'));
		expect(saved.nonce).toBe(url.searchParams.get('nonce'));
		expect(saved.redirectTo).toBe('/viana-do-bolo');
		// O verificador nunca viaxa na URL: só o seu resumo.
		expect(url.search).not.toContain(saved.codeVerifier);
		expect(cookie!.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600 });
	});

	it('callback troca o código, valida o ID token e abre sesión', async () => {
		const { cookie } = await doStart();
		const saved = JSON.parse(cookie!.value);
		const token = await idToken(saved.nonce);
		tokenResponse = () => Response.json({ id_token: token });

		const { res, event } = await doCallback(`code=abc&state=${saved.state}`, cookie!.value);
		expect(status(res)).toBe(303);
		expect(location(res)).toBe(`/benvida?redirectTo=${encodeURIComponent('/viana-do-bolo')}`);
		expect(tokenRequests[0].get('code')).toBe('abc');
		expect(tokenRequests[0].get('code_verifier')).toBe(saved.codeVerifier);

		const [user] = await db.select().from(users).where(eq(users.subject, '12345678Z'));
		expect(user).toMatchObject({ provider: 'clave', displayName: 'Persoa Proba' });
		const session = event.cookies.sets.find((c) => c.name === 'sesion')!;
		expect((await validateSession(db, session.value, now))?.user.id).toBe(user.id);
		expect(event.cookies.sets.find((c) => c.name === 'auth_state')!.value).toBe('');
	});

	it('estado distinto, sen cookie ou erro do provedor: 400 e sen pedir o token', async () => {
		const { cookie } = await doStart();
		const saved = JSON.parse(cookie!.value);
		for (const [query, value] of [
			['code=abc&state=outro', cookie!.value],
			[`code=abc&state=${saved.state}`, undefined],
			[`error=access_denied&state=${saved.state}`, cookie!.value],
			[`state=${saved.state}`, cookie!.value]
		] as const) {
			const { res, event } = await doCallback(query, value);
			expect(status(res)).toBe(400);
			expect(event.cookies.sets.find((c) => c.name === 'sesion')).toBeUndefined();
		}
		expect(tokenRequests).toHaveLength(0);
	});

	it('un ID token doutro inicio de sesión (nonce distinto) non abre sesión', async () => {
		const { cookie } = await doStart();
		const saved = JSON.parse(cookie!.value);
		const token = await idToken('nonce-doutra-persoa', '99999999R');
		tokenResponse = () => Response.json({ id_token: token });
		const { res, event } = await doCallback(`code=abc&state=${saved.state}`, cookie!.value);
		expect(status(res)).toBe(400);
		expect(event.cookies.sets.find((c) => c.name === 'sesion')).toBeUndefined();
		expect(await db.select().from(users).where(eq(users.subject, '99999999R'))).toHaveLength(0);
	});

	it('se o provedor rexeita o código, 400', async () => {
		const { cookie } = await doStart();
		const saved = JSON.parse(cookie!.value);
		const { res } = await doCallback(`code=malo&state=${saved.state}`, cookie!.value);
		expect(status(res)).toBe(400);
	});

	it('un provedor sen configurar dá 404, e un descoñecido tamén', async () => {
		expect(status((await doStart('chave365')).res)).toBe(404);
		expect(status((await doStart('outro')).res)).toBe(404);
	});

	it('redirectTo externo remata en /', async () => {
		const { cookie } = await doStart('clave', 'https://malo.example');
		expect(JSON.parse(cookie!.value).redirectTo).toBe('/');
	});
});
