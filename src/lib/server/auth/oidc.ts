// SPDX-License-Identifier: EUPL-1.2
// Cliente OIDC pequeno: a rede é inxectable para probas e ten límite de dez segundos.
import { createHash, randomBytes } from 'node:crypto';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { err, ok, type Result } from '../services/result';
import type { OidcProviderConfig } from './config';

type Fetcher = typeof fetch;
type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
type Cached = { expires: number; document: Discovery };
const discoveries = new Map<string, Cached>();
const timeout = () => AbortSignal.timeout(10_000);

async function json(fetcher: Fetcher, url: string, init?: RequestInit): Promise<Response> {
	return fetcher(url, { ...init, signal: timeout() });
}

export async function discover(config: OidcProviderConfig, fetcher: Fetcher = fetch): Promise<Discovery> {
	const cached = discoveries.get(config.issuer);
	if (cached && cached.expires > Date.now()) return cached.document;
	const response = await json(fetcher, `${config.issuer}/.well-known/openid-configuration`);
	if (!response.ok) throw new Error('OIDC_DISCOVERY_FAILED');
	const document = await response.json() as Discovery;
	if (document.issuer !== config.issuer || !document.authorization_endpoint || !document.token_endpoint || !document.jwks_uri) {
		throw new Error('OIDC_DISCOVERY_INVALID');
	}
	discoveries.set(config.issuer, { document, expires: Date.now() + 3_600_000 });
	return document;
}

export async function buildAuthorizationRequest(config: OidcProviderConfig, fetcher: Fetcher = fetch) {
	const discovery = await discover(config, fetcher);
	const state = randomBytes(24).toString('base64url');
	const nonce = randomBytes(24).toString('base64url');
	const codeVerifier = randomBytes(48).toString('base64url');
	const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
	const url = new URL(discovery.authorization_endpoint);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', config.clientId);
	url.searchParams.set('redirect_uri', config.redirectUri);
	url.searchParams.set('scope', config.scopes);
	url.searchParams.set('state', state);
	url.searchParams.set('nonce', nonce);
	url.searchParams.set('code_challenge', challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	return { url: url.toString(), state, nonce, codeVerifier };
}

export async function exchangeCode(
	config: OidcProviderConfig, code: string, codeVerifier: string, fetcher: Fetcher = fetch
): Promise<Result<string, 'TOKEN_EXCHANGE_FAILED'>> {
	try {
		const discovery = await discover(config, fetcher);
		const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, client_id: config.clientId, code_verifier: codeVerifier });
		const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
		if (config.clientSecret) headers.set('authorization', `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`);
		const response = await json(fetcher, discovery.token_endpoint, { method: 'POST', headers, body });
		if (!response.ok) return err('TOKEN_EXCHANGE_FAILED');
		const payload = await response.json() as { id_token?: unknown };
		return typeof payload.id_token === 'string' ? ok(payload.id_token) : err('TOKEN_EXCHANGE_FAILED');
	} catch {
		return err('TOKEN_EXCHANGE_FAILED');
	}
}

export type OidcIdentityError = 'TOKEN_INVALID' | 'NONCE_INVALID' | 'SUBJECT_INVALID';

export async function verifyIdToken(
	config: OidcProviderConfig, idToken: string, nonce: string, fetcher: Fetcher = fetch
): Promise<Result<{ subject: string; displayName: string; email: string | null }, OidcIdentityError>> {
	try {
		const discovery = await discover(config, fetcher);
		const jwksResponse = await json(fetcher, discovery.jwks_uri);
		if (!jwksResponse.ok) return err('TOKEN_INVALID');
		const jwks = await jwksResponse.json();
		const { payload } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
			issuer: config.issuer, audience: config.clientId, algorithms: ['RS256', 'ES256', 'PS256'], clockTolerance: 30
		});
		if (payload.nonce !== nonce) return err('NONCE_INVALID');
		const subject = payload[config.subjectClaim];
		if (typeof subject !== 'string' || !subject.trim() || subject.trim().length > 64) return err('SUBJECT_INVALID');
		const name = typeof payload.name === 'string' ? payload.name : [payload.given_name, payload.family_name].filter((part): part is string => typeof part === 'string').join(' ') || (typeof payload.preferred_username === 'string' ? payload.preferred_username : '');
		return ok({ subject: subject.trim(), displayName: name, email: typeof payload.email === 'string' ? payload.email : null });
	} catch {
		return err('TOKEN_INVALID');
	}
}

/** Só para illar probas que precisan reiniciar a caché de descubrimento. */
export function clearOidcDiscoveryCache(): void { discoveries.clear(); }
