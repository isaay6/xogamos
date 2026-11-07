// SPDX-License-Identifier: EUPL-1.2
import {
	AUTH_SECRET,
	DATABASE_URL,
	DEMO,
	DEMO_DATABASE_IS_DISPOSABLE,
	IDENTITY_MODE
} from '$app/env/private';

export type IdentityConfig = {
	mode: 'simulated' | 'disabled';
	secret: string | null;
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
		DEMO_DATABASE_IS_DISPOSABLE
	});
}
