// SPDX-License-Identifier: EUPL-1.2
// Modo demo: /demo só existe con DEMO=1, simulador e unha base desbotable; cada perfil entra directo.
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	DEMO: '1' as string | undefined,
	IDENTITY_MODE: 'simulated' as string | undefined,
	DATABASE_URL: undefined as string | undefined,
	DEMO_DATABASE_IS_DISPOSABLE: undefined as string | undefined
}));
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
		return env.DEMO;
	},
	get IDENTITY_MODE() {
		return env.IDENTITY_MODE;
	},
	get AUTH_SECRET() {
		return 'k'.repeat(40);
	},
	get DATABASE_URL() {
		return env.DATABASE_URL;
	},
	get DEMO_DATABASE_IS_DISPOSABLE() {
		return env.DEMO_DATABASE_IS_DISPOSABLE;
	}
}));
const mockPage = vi.hoisted(() => ({ url: new URL('http://localhost/'), state: {} }));
vi.mock('$app/state', () => ({ page: mockPage }));

import type { Db } from '../../lib/server/db/client';
import { createTestDb } from '../../lib/server/db/test-db';
import { users } from '../../lib/server/db/schema';
import { makeEvent } from '../../lib/server/http/test-event';
import { demoEnabled } from '../../lib/server/demo';
import { createSession, validateSession } from '../../lib/server/services/sessions';
import { load as rootLoad } from '../+layout.server';
import RootLayout from '../+layout.svelte';
import { actions, load } from './+page.server';

let db: Db;
beforeAll(async () => {
	db = await createTestDb();
});
beforeEach(() => {
	env.DEMO = '1';
	env.IDENTITY_MODE = 'simulated';
	env.DATABASE_URL = undefined;
	env.DEMO_DATABASE_IS_DISPOSABLE = undefined;
});

const now = new Date('2026-11-24T10:00:00Z');

async function run(fn: () => unknown): Promise<unknown> {
	try {
		return await fn();
	} catch (e) {
		return e;
	}
}

const ev = (method = 'GET', cookies: Record<string, string> = {}) =>
	makeEvent({ db, now, method, url: 'http://localhost/demo', cookies });

type Key = keyof typeof actions;
const act = (key: Key, event: ReturnType<typeof ev>) =>
	run(() => (actions[key] as (e: never) => unknown)(event as never));

describe('demoEnabled', () => {
	it('só con DEMO=1, o simulador e unha base desbotable', () => {
		expect(demoEnabled({ DEMO: '1', IDENTITY_MODE: 'simulated' })).toBe(true);
		expect(
			demoEnabled({
				DEMO: '1',
				IDENTITY_MODE: 'simulated',
				DATABASE_URL: 'postgres://demo'
			})
		).toBe(false);
		expect(
			demoEnabled({
				DEMO: '1',
				IDENTITY_MODE: 'simulated',
				DATABASE_URL: 'postgres://demo',
				DEMO_DATABASE_IS_DISPOSABLE: '1'
			})
		).toBe(true);
		expect(demoEnabled({ DEMO: '1', IDENTITY_MODE: undefined })).toBe(false);
		expect(demoEnabled({ DEMO: 'true', IDENTITY_MODE: 'simulated' })).toBe(false);
		expect(demoEnabled({ DEMO: undefined, IDENTITY_MODE: 'simulated' })).toBe(false);
	});
});

describe('/demo apagado', () => {
	for (const [name, off] of [
		['sen DEMO', { DEMO: undefined, IDENTITY_MODE: 'simulated' }],
		['DEMO=1 sen simulador', { DEMO: '1', IDENTITY_MODE: undefined }]
	] as const) {
		it(`${name}: GET e accións dan 404`, async () => {
			Object.assign(env, off);
			const got = await run(() => (load as (e: never) => unknown)(ev() as never));
			expect(isHttpError(got) && got.status).toBe(404);
			for (const key of Object.keys(actions) as Key[]) {
				const event = ev('POST');
				const res = await act(key, event);
				expect(isHttpError(res) && res.status, key).toBe(404);
				expect(event.cookies.sets.find((c) => c.name === 'sesion')).toBeUndefined();
			}
		});
	}
});

describe('/demo acendido', () => {
	it('a portada lista os catro perfís coas persoas da semente', async () => {
		type Data = { profiles: { key: string; name: string; municipality: string | null }[] };
		const data = await (load as unknown as (e: never) => Promise<Data>)(ev() as never);
		expect(data.profiles.map((p) => [p.key, p.name, p.municipality])).toEqual([
			['vecina', 'Nerea Cabaleiro', 'Viana do Bolo'],
			['conserxe', 'Baltasar Gesto', 'Viana do Bolo'],
			['concello', 'Amalia Carballal', 'Viana do Bolo'],
			['deputacion', 'Celia Rivas', null]
		]);
	});

	const cases: [Key, string, string][] = [
		['vecina', 'Nerea Cabaleiro', '/viana-do-bolo?tour=vecina'],
		['conserxe', 'Baltasar Gesto', '/viana-do-bolo/conserxeria?tour=conserxe'],
		['concello', 'Amalia Carballal', '/viana-do-bolo/admin?tour=concello'],
		['deputacion', 'Celia Rivas', '/deputacion?tour=deputacion']
	];
	for (const [key, name, to] of cases) {
		it(`${key}: abre a sesión de ${name} e vai a ${to}`, async () => {
			const event = ev('POST');
			const res = await act(key, event);
			expect(isRedirect(res)).toBe(true);
			expect(res).toMatchObject({ status: 303, location: to });
			const cookie = event.cookies.sets.find((c) => c.name === 'sesion')!;
			const session = await validateSession(db, cookie.value, now);
			expect(session?.user.displayName).toBe(name);
		});
	}

	it('as opcións pequenas entran coas persoas variadas correctas', async () => {
		for (const [key, name] of [
			['celestino', 'Celestino Arias Fervenza'],
			['telmo', 'Telmo Quiroga Busto'],
			['rebeca', 'Rebeca Viñas Toimil']
		] as const) {
			const event = ev('POST');
			const res = await act(key, event);
			expect(isRedirect(res)).toBe(true);
			const cookie = event.cookies.sets.find((c) => c.name === 'sesion')!;
			const session = await validateSession(db, cookie.value, now);
			expect(session?.user.displayName).toBe(name);
		}
	});

	it('cambiar de perfil pecha a sesión anterior', async () => {
		const first = ev('POST');
		await act('vecina', first);
		const old = first.cookies.sets.find((c) => c.name === 'sesion')!.value;
		const before = await validateSession(db, old, now);
		expect(before?.user.displayName).toBe('Nerea Cabaleiro');

		const second = ev('POST', { sesion: old });
		second.locals.user = before!.user;
		second.locals.sessionId = before!.sessionId;
		await act('concello', second);
		expect(await validateSession(db, old, now)).toBeNull();
		const fresh = second.cookies.sets.find((c) => c.name === 'sesion')!.value;
		expect((await validateSession(db, fresh, now))?.user.displayName).toBe('Amalia Carballal');
	});

	it('entrar dúas veces co mesmo perfil non duplica a persoa', async () => {
		await act('conserxe', ev('POST'));
		await act('conserxe', ev('POST'));
		const rows = await db.select().from(users);
		expect(rows.filter((u) => u.displayName === 'Baltasar Gesto')).toHaveLength(1);
	});

	it('unha sesión aberta por outra vía tamén se substitúe', async () => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'demo-outra', displayName: 'Outra' })
			.returning();
		const { token } = await createSession(db, u.id, now);
		const s = await validateSession(db, token, now);
		const event = ev('POST', { sesion: token });
		event.locals.user = s!.user;
		event.locals.sessionId = s!.sessionId;
		await act('deputacion', event);
		expect(await validateSession(db, token, now)).toBeNull();
	});
});

describe('faixa e percorrido só en modo demo', () => {
	const kids = createRawSnippet(() => ({ render: () => '<main><h1>Páxina</h1></main>' }));
	const html = (demo: boolean) =>
		render(RootLayout as never, {
			props: { data: { locale: 'gl', demo }, children: kids, params: {} } as never
		}).body;

	it('o layout raíz leva a marca `demo` do contorno', async () => {
		const root = (e: unknown) =>
			(rootLoad as unknown as (e: never) => { demo: boolean })(e as never);
		expect(root(ev()).demo).toBe(true);
		env.DEMO = undefined;
		expect(root(ev()).demo).toBe(false);
	});

	it('con demo: faixa «Datos de demostración» que leva a /demo', () => {
		mockPage.url = new URL('http://localhost/viana-do-bolo');
		const out = html(true);
		expect(out).toContain('Datos de demostración');
		expect(out).toContain('href="/demo"');
		expect(out).toContain('Percorrido guiado');
	});

	it('sen demo: nin faixa nin percorrido', () => {
		const out = html(false);
		expect(out).not.toContain('Datos de demostración');
		expect(out).not.toContain('faixa');
		expect(out).not.toContain('Percorrido guiado');
		expect(out).toContain('Páxina');
	});
});
