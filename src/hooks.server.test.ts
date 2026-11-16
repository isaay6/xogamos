// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it, vi } from 'vitest';

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
	DATABASE_URL: 'postgres://x',
	IDENTITY_MODE: undefined,
	AUTH_SECRET: undefined
}));

import { createTestDb } from './lib/server/db/test-db';
import type { Db } from './lib/server/db/client';
import { users } from './lib/server/db/schema';
import { makeEvent } from './lib/server/http/test-event';
import { createSession } from './lib/server/services/sessions';

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('./lib/server/db/client', () => ({ createDb: () => testDb.current }));

import { handle } from './hooks.server';

let db: Db;
beforeAll(async () => {
	db = await createTestDb();
	testDb.current = db;
});

const run = async (cookies: Record<string, string>) => {
	const event = makeEvent({ db, cookies });
	await handle({
		event: event as never,
		resolve: async () => new Response('ok')
	});
	return event;
};

describe('hooks: sesión', () => {
	it('cookie válida rellena user y sessionId', async () => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'clave', subject: 'H-1', displayName: 'Hook' })
			.returning();
		const { token } = await createSession(db, u.id, new Date());
		const ev = await run({ sesion: token });
		expect(ev.locals.user).toEqual({ id: u.id, displayName: 'Hook' });
		expect(ev.locals.sessionId).toMatch(/^[0-9a-f]{64}$/);
		expect(ev.cookies.sets).toHaveLength(0);
	});

	it('cookie inválida se borra', async () => {
		const ev = await run({ sesion: 'basura' });
		expect(ev.locals.user).toBeNull();
		expect(ev.cookies.sets).toMatchObject([{ name: 'sesion', value: '' }]);
	});

	it('sin cookie no hace nada', async () => {
		const ev = await run({});
		expect(ev.locals.user).toBeNull();
		expect(ev.cookies.sets).toHaveLength(0);
	});

	it('renueva la cookie cuando quedan menos de 15 días', async () => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'clave', subject: 'H-2', displayName: 'Hook2' })
			.returning();
		const { token } = await createSession(db, u.id, new Date(Date.now() - 20 * 86_400_000));
		const ev = await run({ sesion: token });
		expect(ev.locals.user?.id).toBe(u.id);
		expect(ev.cookies.sets[0]).toMatchObject({ name: 'sesion', value: token });
		expect(ev.cookies.sets[0].opts).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
			path: '/'
		});
	});
});

describe('hooks: idioma', () => {
	type ResolveOpts = { transformPageChunk?: (i: { html: string; done: boolean }) => string };
	const runLang = async (cookies: Record<string, string>) => {
		const event = makeEvent({ db, cookies });
		let opts: ResolveOpts | undefined;
		await handle({
			event: event as never,
			resolve: (async (_e: unknown, o?: ResolveOpts) => {
				opts = o;
				return new Response('ok');
			}) as never
		});
		const html = opts?.transformPageChunk?.({ html: '<html lang="%lang%">', done: true });
		return { locale: event.locals.locale, html };
	};

	it('sen cookie é galego e pon lang="gl"', async () => {
		expect(await runLang({})).toEqual({
			locale: 'gl',
			html: '<html data-texto="normal" data-contraste="normal" data-movemento="sistema" lang="gl">'
		});
	});

	it('lingua=es dá castelán', async () => {
		expect(await runLang({ lingua: 'es' })).toEqual({
			locale: 'es',
			html: '<html data-texto="normal" data-contraste="normal" data-movemento="sistema" lang="es">'
		});
	});

	it('calquera outro valor cae en galego', async () => {
		expect((await runLang({ lingua: 'fr' })).locale).toBe('gl');
	});
});
