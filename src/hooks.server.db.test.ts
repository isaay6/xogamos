// SPDX-License-Identifier: EUPL-1.2
import { afterEach, describe, expect, it, vi } from 'vitest';

const createDemoDb = vi.fn(async () => ({ demo: true }));

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/private', () => ({
	PUBLIC_ORIGIN: undefined,
	OIDC_SCOPES: undefined,
	OIDC_SUBJECT_CLAIM: undefined,
	OIDC_CLAVE_ISSUER: undefined,
	OIDC_CLAVE_CLIENT_ID: undefined,
	OIDC_CLAVE_CLIENT_SECRET: undefined,
	OIDC_CHAVE365_ISSUER: undefined,
	OIDC_CHAVE365_CLIENT_ID: undefined,
	OIDC_CHAVE365_CLIENT_SECRET: undefined,
	get DEMO() {
		return undefined;
	},
	get DEMO_DATABASE_IS_DISPOSABLE() {
		return undefined;
	},
	DATABASE_URL: undefined,
	IDENTITY_MODE: undefined,
	AUTH_SECRET: undefined
}));
vi.mock('./lib/server/db/dev-demo', () => ({ createDemoDb }));

// Carga hooks.server.ts de nuevo: guarda la base de datos en una variable del módulo.
async function freshHandle() {
	vi.resetModules();
	return (await import('./hooks.server')).handle;
}

function event() {
	const cookies = { get: () => undefined, delete: () => {}, set: () => {} };
	return {
		cookies,
		locals: {},
		url: new URL('http://localhost/'),
		request: new Request('http://localhost/'),
		getClientAddress: () => '127.0.0.1'
	} as never;
}

afterEach(() => {
	vi.unstubAllEnvs();
	createDemoDb.mockClear();
});

describe('hooks.server: base de datos sin DATABASE_URL', () => {
	it('en producción falla con DATABASE_URL y no carga el respaldo', async () => {
		vi.stubEnv('DEV', false);
		const handle = await freshHandle();
		await expect(
			handle({ event: event(), resolve: async () => new Response() } as never)
		).rejects.toThrow('DATABASE_URL');
		expect(createDemoDb).not.toHaveBeenCalled();
	});

	it('en desarrollo usa el respaldo de demostración', async () => {
		vi.stubEnv('DEV', true);
		const handle = await freshHandle();
		const ev = event() as unknown as { locals: { db?: unknown } };
		await handle({ event: ev, resolve: async () => new Response() } as never);
		expect(createDemoDb).toHaveBeenCalledOnce();
		expect(ev.locals.db).toEqual({ demo: true });
	});
});
