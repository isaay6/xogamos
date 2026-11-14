// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const env = vi.hoisted(() => ({
	IDENTITY_MODE: 'simulated' as string | undefined,
	AUTH_SECRET: 'k'.repeat(40) as string | undefined
}));
vi.mock('$app/env/private', () => ({
	get DEMO() {
		return undefined;
	},
	get DEMO_DATABASE_IS_DISPOSABLE() {
		return undefined;
	},
	get IDENTITY_MODE() {
		return env.IDENTITY_MODE;
	},
	get AUTH_SECRET() {
		return env.AUTH_SECRET;
	},
	get DATABASE_URL() {
		return undefined;
	}
}));

import { createTestDb } from '../../lib/server/db/test-db';
import type { Db } from '../../lib/server/db/client';
import { municipalities, sessions, staffRoles, users } from '../../lib/server/db/schema';
import { makeEvent } from '../../lib/server/http/test-event';
import { signAssertion } from '../../lib/server/auth/assertion';
import { createSession, validateSession } from '../../lib/server/services/sessions';
import { GET as start } from './[provider]/start/+server';
import { GET as callback } from './[provider]/callback/+server';
import { POST as logout } from './logout/+server';
import { load as simLoad, actions as simActions } from '../simulador/[provider]/+page.server';

// Los manejadores pueden devolver una Response o lanzar una redirección/error de Kit.
async function run(fn: () => unknown): Promise<unknown> {
	try {
		return await fn();
	} catch (e) {
		return e;
	}
}

let db: Db;
beforeAll(async () => {
	db = await createTestDb();
});
beforeEach(() => {
	env.IDENTITY_MODE = 'simulated';
	env.AUTH_SECRET = 'k'.repeat(40);
});

const now = new Date('2026-11-24T10:00:00Z');
const exp = Math.floor(now.getTime() / 1000) + 120;
const secret = () => env.AUTH_SECRET!;

function assertionFor(state: string, over: Partial<Parameters<typeof signAssertion>[0]> = {}) {
	return signAssertion(
		{
			provider: 'clave',
			subject: 'DEMO-9',
			displayName: 'Persoa Proba',
			email: null,
			state,
			exp,
			...over
		},
		secret()
	);
}

async function doStart(provider: string, redirectTo?: string) {
	const q = redirectTo === undefined ? '' : `?redirectTo=${encodeURIComponent(redirectTo)}`;
	const event = makeEvent({
		db,
		now,
		params: { provider },
		url: `http://localhost/auth/${provider}/start${q}`
	});
	const res = await run(() => start(event as never));
	const authState = event.cookies.sets.find((c) => c.name === 'auth_state');
	return { res, authState, event };
}

function location(res: unknown): string {
	const r = res as { status: number; location?: string; headers?: Headers };
	return r.location ?? r.headers!.get('location')!;
}

async function doCallback(provider: string, assertion: string, cookieValue?: string) {
	const event = makeEvent({
		db,
		now,
		params: { provider },
		url: `http://localhost/auth/${provider}/callback?assertion=${encodeURIComponent(assertion)}`,
		cookies: cookieValue ? { auth_state: cookieValue } : {}
	});
	const res = await run(() => callback(event as never));
	return { res, event };
}

const status = (r: unknown) => (r as { status: number }).status;

describe('flujo de acceso simulado', () => {
	it('start -> simulador -> callback crea sesión y redirige a redirectTo', async () => {
		const { res, authState } = await doStart('clave', '/m/ribadavila');
		expect(status(res)).toBe(303);
		expect(authState!.opts).toMatchObject({
			httpOnly: true,
			maxAge: 600,
			path: '/'
		});
		const loc = new URL(location(res), 'http://localhost');
		expect(loc.pathname).toBe('/simulador/clave');
		const state = loc.searchParams.get('state')!;
		expect(state.length).toBeGreaterThanOrEqual(16);
		expect(JSON.parse(authState!.value)).toEqual({
			state,
			redirectTo: '/m/ribadavila'
		});

		const { res: cb, event } = await doCallback('clave', assertionFor(state), authState!.value);
		expect(status(cb)).toBe(303);
		// Persoa nova (sen benvida feita): primeiro a benvida, que despois volve a redirectTo.
		expect(location(cb)).toBe(`/benvida?redirectTo=${encodeURIComponent('/m/ribadavila')}`);
		const ses = event.cookies.sets.find((c) => c.name === 'sesion')!;
		expect(ses.opts).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
			path: '/'
		});
		expect(ses.opts.expires).toBeInstanceOf(Date);
		expect(event.cookies.sets.find((c) => c.name === 'auth_state')!.value).toBe('');
		const [u] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
		expect(u.provider).toBe('clave');
		expect((await validateSession(db, ses.value, now))?.user.id).toBe(u.id);
	});

	it('el login invalida la sesión previa de la petición', async () => {
		const [u] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
		const { token: old } = await createSession(db, u.id, now);
		const oldV = await validateSession(db, old, now);
		const { authState } = await doStart('clave');
		const state = JSON.parse(authState!.value).state as string;
		const event = makeEvent({
			db,
			now,
			params: { provider: 'clave' },
			url: `http://localhost/auth/clave/callback?assertion=${encodeURIComponent(assertionFor(state))}`,
			cookies: { auth_state: authState!.value, sesion: old }
		});
		event.locals.sessionId = oldV!.sessionId;
		event.locals.user = oldV!.user;
		expect(status(await run(() => callback(event as never)))).toBe(303);
		expect(await validateSession(db, old, now)).toBeNull();
		const fresh = event.cookies.sets.find((c) => c.name === 'sesion')!;
		expect(await validateSession(db, fresh.value, now)).not.toBeNull();
	});

	it('quen xa fixo a benvida vai directo a redirectTo', async () => {
		await db.update(users).set({ onboardedAt: now }).where(eq(users.subject, 'DEMO-9'));
		const { res, authState } = await doStart('clave', '/m/ribadavila');
		const state = new URL(location(res), 'http://localhost').searchParams.get('state')!;
		const { res: cb } = await doCallback('clave', assertionFor(state), authState!.value);
		expect(location(cb)).toBe('/m/ribadavila');
	});

	it('o persoal (conserxe ou deputación) nunca pasa pola benvida, aínda sen onboarded_at', async () => {
		const [m] = await db
			.insert(municipalities)
			.values({
				slug: 'auth-staff',
				name: 'Concello Proba',
				province: 'Ourense',
				primaryColor: '#1d4ed8'
			})
			.returning();
		const [conserxe, deputacion] = await db
			.insert(users)
			.values([
				{ provider: 'clave', subject: 'STAFF-C', displayName: 'Conserxe Novo' },
				{ provider: 'clave', subject: 'STAFF-D', displayName: 'Deputación Nova' }
			])
			.returning();
		await db.insert(staffRoles).values([
			{ userId: conserxe.id, municipalityId: m.id, role: 'conserxe' },
			{ userId: deputacion.id, municipalityId: null, role: 'deputacion' }
		]);
		for (const [subject, target] of [
			['STAFF-C', '/auth-staff/conserxeria'],
			['STAFF-D', '/deputacion']
		]) {
			const { res, authState } = await doStart('clave', target);
			const state = new URL(location(res), 'http://localhost').searchParams.get('state')!;
			const { res: cb } = await doCallback(
				'clave',
				assertionFor(state, { subject }),
				authState!.value
			);
			expect(location(cb)).toBe(target);
			const [u] = await db.select().from(users).where(eq(users.subject, subject));
			expect(u.onboardedAt).toBeNull();
		}
	});

	it('unha identidade sen correo non borra o que a persoa escribiu', async () => {
		await db.update(users).set({ email: 'proba@exemplo.gal' }).where(eq(users.subject, 'DEMO-9'));
		const { res, authState } = await doStart('clave', '/m/ribadavila');
		const state = new URL(location(res), 'http://localhost').searchParams.get('state')!;
		await doCallback('clave', assertionFor(state, { email: null }), authState!.value);
		const [u] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
		expect(u.email).toBe('proba@exemplo.gal');
		const { res: res2, authState: st2 } = await doStart('clave', '/m/ribadavila');
		const state2 = new URL(location(res2), 'http://localhost').searchParams.get('state')!;
		await doCallback('clave', assertionFor(state2, { email: 'novo@exemplo.gal' }), st2!.value);
		const [u2] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
		expect(u2.email).toBe('novo@exemplo.gal');
	});

	it('redirectTo abierto termina en /', async () => {
		for (const bad of ['//evil.example', 'https://evil.example']) {
			const { res, authState } = await doStart('chave365', bad);
			const state = new URL(location(res), 'http://localhost').searchParams.get('state')!;
			const { res: cb } = await doCallback(
				'chave365',
				assertionFor(state, { provider: 'chave365' }),
				authState!.value
			);
			// Esta identidade aínda non fixo a benvida: vai a ela, que despois volve a `/`.
			expect(location(cb)).toBe('/benvida?redirectTo=%2F');
		}
	});

	it('state distinto -> 400 y sin sesión', async () => {
		const before = (await db.select().from(sessions)).length;
		const { authState } = await doStart('clave');
		const { res, event } = await doCallback('clave', assertionFor('otro-state'), authState!.value);
		expect(status(res)).toBe(400);
		expect(await (res as Response).json()).toMatchObject({
			error: 'VALIDATION_FAILED'
		});
		expect(event.cookies.sets.find((c) => c.name === 'sesion')).toBeUndefined();
		expect((await db.select().from(sessions)).length).toBe(before);
	});

	it('sin cookie auth_state o con cookie rota -> 400', async () => {
		const { authState } = await doStart('clave');
		const state = JSON.parse(authState!.value).state as string;
		expect(status((await doCallback('clave', assertionFor(state))).res)).toBe(400);
		expect(status((await doCallback('clave', assertionFor(state), 'no-json')).res)).toBe(400);
	});

	it('proveedor de la ruta distinto del de la aserción -> 400', async () => {
		const { authState } = await doStart('chave365');
		const state = JSON.parse(authState!.value).state as string;
		const { res } = await doCallback('chave365', assertionFor(state), authState!.value);
		expect(status(res)).toBe(400);
	});

	it('aserción manipulada, caducada o ausente -> 400 sin sesión', async () => {
		const before = (await db.select().from(sessions)).length;
		const { authState } = await doStart('clave');
		const state = JSON.parse(authState!.value).state as string;
		const good = assertionFor(state);
		const [p, s] = good.split('.');
		const forged = `${Buffer.from(JSON.stringify({ provider: 'clave', subject: 'ADMIN', displayName: 'x', email: null, state, exp })).toString('base64url')}.${s}`;
		const expired = assertionFor(state, { exp: exp - 1000 });
		for (const a of [forged, expired, 'abc', '', p]) {
			expect(status((await doCallback('clave', a, authState!.value)).res)).toBe(400);
		}
		expect((await db.select().from(sessions)).length).toBe(before);
	});

	it('proveedor desconocido -> 404', async () => {
		expect(status((await doStart('google')).res)).toBe(404);
		expect(status((await doCallback('google', 'x', 'y')).res)).toBe(404);
	});

	it('sin IDENTITY_MODE todo da 404', async () => {
		env.IDENTITY_MODE = undefined;
		expect(status((await doStart('clave')).res)).toBe(404);
		expect(status((await doCallback('clave', 'x', 'y')).res)).toBe(404);
		const ev = makeEvent({
			db,
			params: { provider: 'clave' },
			url: 'http://localhost/simulador/clave?state=x'
		});
		expect(await run(() => simLoad(ev as never))).toMatchObject({
			status: 404
		});
	});

	it('el simulador carga con modo simulado y lista identidades', async () => {
		const ev = makeEvent({
			db,
			params: { provider: 'clave' },
			url: 'http://localhost/simulador/clave?state=abc'
		});
		const data = (await run(() => simLoad(ev as never))) as {
			provider: string;
			state: string;
			featured: { displayName: string; provider: string }[];
			others: { displayName: string; provider: string }[];
		};
		expect(data.provider).toBe('clave');
		expect(data.state).toBe('abc');
		// Destacadas primeiro (Nerea, a administradora de Viana, a Deputación); o resto, aparte.
		// Cibrán Ventosela, o perfil mestre de probas, vai primeiro; despois Nerea.
		expect(data.featured[0].displayName).toBe('Cibrán Ventosela');
		expect(data.featured[1].displayName).toBe('Nerea Cabaleiro');
		const names = data.featured.map((i) => i.displayName);
		expect(names).toContain('Amalia Carballal');
		expect(names).toContain('Celia Rivas');
		expect(names).not.toContain('Baltasar Gesto'); // entra con Chave365
		expect(data.others.length).toBeGreaterThan(100);
		for (const i of [...data.featured, ...data.others]) expect(i.provider).toBe('clave');
		const bad = makeEvent({
			db,
			params: { provider: 'clave' },
			url: 'http://localhost/simulador/clave'
		});
		expect(await run(() => simLoad(bad as never))).toMatchObject({
			status: 400
		});
	});

	it('la acción del simulador firma la aserción y redirige al callback', async () => {
		const fd = new FormData();
		fd.set('state', 'st-1');
		fd.set('mode', 'custom');
		fd.set('displayName', 'Persoa Libre');
		fd.set('subject', '00000000T');
		const event = makeEvent({
			db,
			now,
			params: { provider: 'clave' },
			url: 'http://localhost/simulador/clave?state=st-1'
		});
		(event as { request: Request }).request = new Request(event.url, {
			method: 'POST',
			body: fd
		});
		const res = await run(() => simActions.default(event as never));
		expect(status(res)).toBe(303);
		const loc = new URL(location(res), 'http://localhost');
		expect(loc.pathname).toBe('/auth/clave/callback');
		const { verifyAssertion } = await import('../../lib/server/auth/assertion');
		const v = verifyAssertion(loc.searchParams.get('assertion')!, secret(), now);
		expect(v).toMatchObject({
			ok: true,
			value: { provider: 'clave', subject: '00000000T', state: 'st-1' }
		});
	});

	it('logout -> 204 y sesión borrada', async () => {
		const [u] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
		const { token } = await createSession(db, u.id, now);
		const v = await validateSession(db, token, now);
		const event = makeEvent({
			db,
			now,
			method: 'POST',
			url: 'http://localhost/auth/logout',
			cookies: { sesion: token }
		});
		event.locals.sessionId = v!.sessionId;
		event.locals.user = v!.user;
		const res = await logout(event as never);
		expect(res.status).toBe(204);
		expect(await validateSession(db, token, now)).toBeNull();
		expect(event.cookies.sets.find((c) => c.name === 'sesion')?.opts.maxAge).toBe(0);
	});

	it('logout sin sesión también da 204', async () => {
		const res = await logout(
			makeEvent({
				db,
				method: 'POST',
				url: 'http://localhost/auth/logout'
			}) as never
		);
		expect(res.status).toBe(204);
	});

	describe('logout desde formulario', () => {
		const run = async (init: { contentType?: string; rawBody?: string }) => {
			const [u] = await db.select().from(users).where(eq(users.subject, 'DEMO-9'));
			const { token } = await createSession(db, u.id, now);
			const v = await validateSession(db, token, now);
			const event = makeEvent({
				db,
				now,
				method: 'POST',
				url: 'http://localhost/auth/logout',
				cookies: { sesion: token }
			});
			// makeEvent fija JSON para rawBody: se reemplaza la petición con el tipo pedido.
			if (init.contentType)
				(event as { request: Request }).request = new Request(event.url, {
					method: 'POST',
					headers: { 'content-type': init.contentType },
					body: init.rawBody
				});
			event.locals.sessionId = v!.sessionId;
			event.locals.user = v!.user;
			const res = await logout(event as never);
			expect(event.cookies.sets.find((c) => c.name === 'sesion')?.opts.maxAge).toBe(0);
			expect(await validateSession(db, token, now)).toBeNull();
			return res;
		};
		const form = (to: string) => ({
			contentType: 'application/x-www-form-urlencoded',
			rawBody: new URLSearchParams({ to }).toString()
		});

		it('to válido: 303 a esa ruta', async () => {
			const res = await run(form('/ribadavila'));
			expect(res.status).toBe(303);
			expect(res.headers.get('location')).toBe('/ribadavila');
		});

		it.each(['//evil.example', 'https://evil.example', '/\\evil.example', '/a\\b', '/a\nb'])(
			'to no válido %j: 303 a /',
			async (to) => {
				const res = await run(form(to));
				expect(res.status).toBe(303);
				expect(res.headers.get('location')).toBe('/');
			}
		);

		it('formulario sin to: 303 a /', async () => {
			const res = await run({ contentType: 'application/x-www-form-urlencoded', rawBody: '' });
			expect(res.status).toBe(303);
			expect(res.headers.get('location')).toBe('/');
		});

		it('JSON o vacío: 204', async () => {
			expect((await run({ contentType: 'application/json', rawBody: '{}' })).status).toBe(204);
			expect((await run({})).status).toBe(204);
		});
	});
});
