// SPDX-License-Identifier: EUPL-1.2
import {
	AUTH_SECRET,
	DATABASE_URL,
	DEMO,
	DEMO_DATABASE_IS_DISPOSABLE,
	IDENTITY_MODE,
	OIDC_CHAVE365_CLIENT_ID,
	OIDC_CHAVE365_CLIENT_SECRET,
	OIDC_CHAVE365_ISSUER,
	OIDC_CLAVE_CLIENT_ID,
	OIDC_CLAVE_CLIENT_SECRET,
	OIDC_CLAVE_ISSUER,
	OIDC_SCOPES,
	OIDC_SUBJECT_CLAIM,
	PUBLIC_ORIGIN
} from '$app/env/private';

export type IdentityConfig = {
	mode: 'simulated' | 'disabled';
	secret: string | null;
} | {
	mode: 'oidc';
	providers: Partial<Record<Provider, OidcProviderConfig>>;
};

export type OidcProviderConfig = {
	issuer: string;
	clientId: string;
	clientSecret?: string;
	scopes: string;
	subjectClaim: string;
	redirectUri: string;
};

export const PROVIDERS = ['clave', 'chave365'] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string | undefined): value is Provider {
	return PROVIDERS.includes(value as Provider);
}

export type IdentityEnvironment = {
	IDENTITY_MODE?: string | undefined;
	AUTH_SECRET?: string | undefined;
	DATABASE_URL?: string | undefined;
	DEMO?: string | undefined;
	DEMO_DATABASE_IS_DISPOSABLE?: string | undefined;
	PUBLIC_ORIGIN?: string | undefined;
	OIDC_SCOPES?: string | undefined;
	OIDC_SUBJECT_CLAIM?: string | undefined;
	OIDC_CLAVE_ISSUER?: string | undefined;
	OIDC_CLAVE_CLIENT_ID?: string | undefined;
	OIDC_CLAVE_CLIENT_SECRET?: string | undefined;
	OIDC_CHAVE365_ISSUER?: string | undefined;
	OIDC_CHAVE365_CLIENT_ID?: string | undefined;
	OIDC_CHAVE365_CLIENT_SECRET?: string | undefined;
};

/** Sen URL úsase PGlite en desenvolvemento; cunha URL cómpre a confirmación explícita. */
export function isDisposableDemoDatabase(env: IdentityEnvironment): boolean {
	return !env.DATABASE_URL || env.DEMO_DATABASE_IS_DISPOSABLE === '1';
}

/** Pura: recibe un objeto plano para poder probarla sin entorno. */
export function identityConfig(env: IdentityEnvironment): IdentityConfig {
	if (env.DEMO === '1' && !isDisposableDemoDatabase(env)) {
		throw new Error(
			'DEMO=1 requiere una base de datos desechable: quite DATABASE_URL o fije DEMO_DATABASE_IS_DISPOSABLE=1'
		);
	}
	if (env.IDENTITY_MODE === 'oidc') {
		const origin = env.PUBLIC_ORIGIN?.trim().replace(/\/+$/, '');
		if (!origin) throw new Error('PUBLIC_ORIGIN es obligatorio cuando IDENTITY_MODE=oidc');
		let publicOrigin: URL;
		try {
			publicOrigin = new URL(origin);
		} catch {
			throw new Error('PUBLIC_ORIGIN debe ser una URL válida');
		}
		const scopes = env.OIDC_SCOPES?.trim() || 'openid profile email';
		const subjectClaim = env.OIDC_SUBJECT_CLAIM?.trim() || 'sub';
		const providers: Partial<Record<Provider, OidcProviderConfig>> = {};
		for (const [provider, issuer, clientId, clientSecret] of [
			['clave', env.OIDC_CLAVE_ISSUER, env.OIDC_CLAVE_CLIENT_ID, env.OIDC_CLAVE_CLIENT_SECRET],
			['chave365', env.OIDC_CHAVE365_ISSUER, env.OIDC_CHAVE365_CLIENT_ID, env.OIDC_CHAVE365_CLIENT_SECRET]
		] as const) {
			if (!issuer || !clientId) continue;
			let parsed: URL;
			try {
				parsed = new URL(issuer);
			} catch {
				throw new Error(`OIDC_${provider.toUpperCase()}_ISSUER debe ser una URL válida`);
			}
			const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
			if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
				throw new Error(`OIDC_${provider.toUpperCase()}_ISSUER debe usar https`);
			}
			providers[provider] = {
				issuer: issuer.replace(/\/+$/, ''), clientId, clientSecret: clientSecret || undefined, scopes,
				subjectClaim, redirectUri: `${publicOrigin.origin}/auth/${provider}/callback`
			};
		}
		if (!Object.keys(providers).length) throw new Error('IDENTITY_MODE=oidc requiere al menos un proveedor OIDC');
		return { mode: 'oidc', providers };
	}
	if (env.IDENTITY_MODE !== 'simulated') return { mode: 'disabled', secret: null };
	if (!isDisposableDemoDatabase(env)) {
		throw new Error(
			'IDENTITY_MODE=simulated requiere una base de datos desechable: quite DATABASE_URL o fije DEMO_DATABASE_IS_DISPOSABLE=1'
		);
	}
	const secret = env.AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error('AUTH_SECRET debe tener al menos 32 caracteres cuando IDENTITY_MODE=simulated');
	}
	return { mode: 'simulated', secret };
}

/** Lee la configuración del entorno de la aplicación en cada llamada. */
export function readIdentityConfig(): IdentityConfig {
	return identityConfig({
		IDENTITY_MODE,
		AUTH_SECRET,
		DATABASE_URL,
		DEMO,
		DEMO_DATABASE_IS_DISPOSABLE,
		PUBLIC_ORIGIN, OIDC_SCOPES, OIDC_SUBJECT_CLAIM,
		OIDC_CLAVE_ISSUER, OIDC_CLAVE_CLIENT_ID, OIDC_CLAVE_CLIENT_SECRET,
		OIDC_CHAVE365_ISSUER, OIDC_CHAVE365_CLIENT_ID, OIDC_CHAVE365_CLIENT_SECRET
	});
}
