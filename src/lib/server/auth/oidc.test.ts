// SPDX-License-Identifier: EUPL-1.2
// Provedor de identidade falso en memoria: descubrimento, claves e punto de tokens.
import { createHash } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { OidcProviderConfig } from './config';
import {
	buildAuthorizationRequest,
	clearOidcDiscoveryCache,
	discover,
	exchangeCode,
	verifyIdToken
} from './oidc';

const ISSUER = 'https://idp.exemplo.gal/realms/xogamos';
const config: OidcProviderConfig = {
	issuer: ISSUER,
	clientId: 'xogamos',
	scopes: 'openid profile email',
	subjectClaim: 'sub',
	redirectUri: 'https://reservas.exemplo.gal/auth/clave/callback'
};

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let keys: Keys;
let otherKeys: Keys;
let jwks: { keys: unknown[] };

beforeAll(async () => {
	keys = await generateKeyPair('RS256');
	otherKeys = await generateKeyPair('RS256');
	jwks = { keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] };
});
beforeEach(() => clearOidcDiscoveryCache());

type Call = { url: string; init?: RequestInit };

function fakeIdp(over: { discovery?: Record<string, unknown>; token?: () => Response } = {}): {
	fetcher: typeof fetch;
	calls: Call[];
} {
	const calls: Call[] = [];
	const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		if (url === `${ISSUER}/.well-known/openid-configuration`) {
			return Response.json({
				issuer: ISSUER,
				authorization_endpoint: `${ISSUER}/auth`,
				token_endpoint: `${ISSUER}/token`,
				jwks_uri: `${ISSUER}/certs`,
				...over.discovery
			});
		}
		if (url === `${ISSUER}/certs`) return Response.json(jwks);
		if (url === `${ISSUER}/token` && over.token) return over.token();
		return new Response('non atopado', { status: 404 });
	}) as typeof fetch;
	return { fetcher, calls };
}

async function idToken(
	claims: Record<string, unknown> = {},
	options: { key?: Keys['privateKey']; expiresIn?: string; audience?: string; issuer?: string } = {}
): Promise<string> {
	return new SignJWT({ nonce: 'n-1', name: 'Persoa Proba', email: 'proba@exemplo.gal', ...claims })
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(options.issuer ?? ISSUER)
		.setAudience(options.audience ?? 'xogamos')
		.setSubject('12345678Z')
		.setIssuedAt()
		.setExpirationTime(options.expiresIn ?? '5m')
		.sign(options.key ?? keys.privateKey);
}

describe('descubrimento', () => {
	it('rexeita un documento cuxo emisor non é o configurado', async () => {
		const { fetcher } = fakeIdp({ discovery: { issuer: 'https://outro.exemplo.gal' } });
		await expect(discover(config, fetcher)).rejects.toThrow('OIDC_DISCOVERY_INVALID');
	});

	it('garda o documento en memoria e non o volve pedir', async () => {
		const { fetcher, calls } = fakeIdp();
		await discover(config, fetcher);
		await discover(config, fetcher);
		expect(calls).toHaveLength(1);
	});
});

describe('petición de autorización', () => {
	it('usa código de autorización con PKCE S256, estado e nonce', async () => {
		const { fetcher } = fakeIdp();
		const request = await buildAuthorizationRequest(config, fetcher);
		const url = new URL(request.url);
		expect(url.origin + url.pathname).toBe(`${ISSUER}/auth`);
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('client_id')).toBe('xogamos');
		expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
		expect(url.searchParams.get('scope')).toBe('openid profile email');
		expect(url.searchParams.get('state')).toBe(request.state);
		expect(url.searchParams.get('nonce')).toBe(request.nonce);
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('code_challenge')).toBe(
			createHash('sha256').update(request.codeVerifier).digest('base64url')
		);
	});

	it('cada petición leva valores novos', async () => {
		const { fetcher } = fakeIdp();
		const a = await buildAuthorizationRequest(config, fetcher);
		const b = await buildAuthorizationRequest(config, fetcher);
		expect(a.state).not.toBe(b.state);
		expect(a.nonce).not.toBe(b.nonce);
		expect(a.codeVerifier).not.toBe(b.codeVerifier);
	});
});

describe('troco do código', () => {
	it('envía o código e o verificador, e devolve o ID token', async () => {
		const { fetcher, calls } = fakeIdp({ token: () => Response.json({ id_token: 'o-token' }) });
		const result = await exchangeCode(config, 'codigo-1', 'verificador-1', fetcher);
		expect(result).toEqual({ ok: true, value: 'o-token' });
		const call = calls.find((c) => c.url === `${ISSUER}/token`)!;
		expect(call.init?.method).toBe('POST');
		const body = call.init?.body as URLSearchParams;
		expect(body.get('grant_type')).toBe('authorization_code');
		expect(body.get('code')).toBe('codigo-1');
		expect(body.get('code_verifier')).toBe('verificador-1');
		expect(body.get('redirect_uri')).toBe(config.redirectUri);
		expect(new Headers(call.init?.headers).has('authorization')).toBe(false);
	});

	it('co segredo de cliente, autentícase con HTTP Basic', async () => {
		const { fetcher, calls } = fakeIdp({ token: () => Response.json({ id_token: 't' }) });
		await exchangeCode({ ...config, clientSecret: 's3cr3t' }, 'c', 'v', fetcher);
		const call = calls.find((c) => c.url === `${ISSUER}/token`)!;
		expect(new Headers(call.init?.headers).get('authorization')).toBe(
			`Basic ${Buffer.from('xogamos:s3cr3t').toString('base64')}`
		);
	});

	it('falla se o provedor rexeita o código ou non devolve ID token', async () => {
		const rejected = fakeIdp({ token: () => new Response('{}', { status: 400 }) });
		expect((await exchangeCode(config, 'c', 'v', rejected.fetcher)).ok).toBe(false);
		clearOidcDiscoveryCache();
		const empty = fakeIdp({ token: () => Response.json({ access_token: 'x' }) });
		expect((await exchangeCode(config, 'c', 'v', empty.fetcher)).ok).toBe(false);
	});
});

describe('validación do ID token', () => {
	it('acepta un token correcto e devolve a identidade', async () => {
		const { fetcher } = fakeIdp();
		const result = await verifyIdToken(config, await idToken(), 'n-1', fetcher);
		expect(result).toEqual({
			ok: true,
			value: { subject: '12345678Z', displayName: 'Persoa Proba', email: 'proba@exemplo.gal' }
		});
	});

	it('rexeita unha sinatura feita con outra clave', async () => {
		const { fetcher } = fakeIdp();
		const token = await idToken({}, { key: otherKeys.privateKey });
		expect(await verifyIdToken(config, token, 'n-1', fetcher)).toEqual({
			ok: false,
			error: 'TOKEN_INVALID'
		});
	});

	it('rexeita outro destinatario, outro emisor e un token caducado', async () => {
		const { fetcher } = fakeIdp();
		for (const token of [
			await idToken({}, { audience: 'outra-aplicacion' }),
			await idToken({}, { issuer: 'https://outro.exemplo.gal' }),
			await idToken({}, { expiresIn: '-10m' })
		]) {
			expect((await verifyIdToken(config, token, 'n-1', fetcher)).ok).toBe(false);
		}
	});

	it('rexeita os algoritmos «none» e HS256', async () => {
		const { fetcher } = fakeIdp();
		const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
		const claims = {
			iss: ISSUER,
			aud: 'xogamos',
			sub: '12345678Z',
			nonce: 'n-1',
			exp: Math.floor(Date.now() / 1000) + 300
		};
		const unsigned = `${part({ alg: 'none' })}.${part(claims)}.`;
		expect((await verifyIdToken(config, unsigned, 'n-1', fetcher)).ok).toBe(false);
		const symmetric = await new SignJWT(claims)
			.setProtectedHeader({ alg: 'HS256' })
			.sign(new TextEncoder().encode('xogamos-xogamos-xogamos-xogamos-'));
		expect((await verifyIdToken(config, symmetric, 'n-1', fetcher)).ok).toBe(false);
	});

	it('rexeita un nonce distinto do gardado', async () => {
		const { fetcher } = fakeIdp();
		expect(await verifyIdToken(config, await idToken(), 'outro-nonce', fetcher)).toEqual({
			ok: false,
			error: 'NONCE_INVALID'
		});
	});

	it('usa o atributo configurado como identificador e esíxeo', async () => {
		const { fetcher } = fakeIdp();
		const withDni = { ...config, subjectClaim: 'dni' };
		const good = await verifyIdToken(
			withDni,
			await idToken({ dni: ' 87654321X ' }),
			'n-1',
			fetcher
		);
		expect(good.ok && good.value.subject).toBe('87654321X');
		const missing = await verifyIdToken(withDni, await idToken(), 'n-1', fetcher);
		expect(missing).toEqual({ ok: false, error: 'SUBJECT_INVALID' });
		const long = await verifyIdToken(
			withDni,
			await idToken({ dni: 'x'.repeat(65) }),
			'n-1',
			fetcher
		);
		expect(long).toEqual({ ok: false, error: 'SUBJECT_INVALID' });
	});

	it('compón o nome se non vén enteiro e nunca o deixa baleiro', async () => {
		const { fetcher } = fakeIdp();
		const parts = await verifyIdToken(
			config,
			await idToken({ name: undefined, given_name: 'Carme', family_name: 'Proba' }),
			'n-1',
			fetcher
		);
		expect(parts.ok && parts.value.displayName).toBe('Carme Proba');
		const none = await verifyIdToken(
			config,
			await idToken({ name: undefined, email: undefined }),
			'n-1',
			fetcher
		);
		expect(none.ok && none.value.displayName.length).toBeGreaterThan(0);
		expect(none.ok && none.value.email).toBeNull();
	});
});
