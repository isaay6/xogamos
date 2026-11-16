// SPDX-License-Identifier: EUPL-1.2
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../lib/server/db/client';
import { municipalities, staffRoles, users } from '../lib/server/db/schema';
import { createTestDb } from '../lib/server/db/test-db';
import { makeEvent } from '../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../lib/server/services/fixtures';
import AppHeader from '../lib/ui/AppHeader.svelte';
import BottomNav from '../lib/ui/BottomNav.svelte';
import { load as loadRoot } from './+page.server';
import { load as loadSlug } from './[slug]/+layout.server';
import { actions as idioma, load as loadIdioma } from './[slug]/idioma/+page.server';
import { load as loadEntrar } from './[slug]/entrar/+page.server';

let db: Db;
let fx: Fixture;
let adminId: string;
let plainId: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [admin, plain] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'shell-admin', displayName: 'amalia Carballal' },
			{ provider: 'local', subject: 'shell-plain', displayName: 'Telmo' }
		])
		.returning();
	adminId = admin.id;
	plainId = plain.id;
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		// Rol en OTRO concello: no debe aparecer en ribadavila
		{ userId: plain.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' }
	]);
});

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

describe('raíz /', () => {
	it('sen cookie e con dous concellos: lista ordenada por nome', async () => {
		const out = (await call<Promise<{ municipalities: { slug: string }[] }>>(
			loadRoot,
			makeEvent({ db })
		)) as { municipalities: { slug: string; hasLogo: boolean }[] };
		expect(out.municipalities.map((m) => m.slug)).toEqual(['montemaior-do-rio', 'ribadavila']);
		expect(out.municipalities[0].hasLogo).toBe(false);
	});

	it('con concello=ribadavila redirixe 307 a /ribadavila', async () => {
		const r = await outcome(() =>
			call(loadRoot, makeEvent({ db, cookies: { concello: 'ribadavila' } }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(r.thrown).toMatchObject({ status: 307, location: '/ribadavila' });
	});

	it('con concello=borrado amosa a lista', async () => {
		const out = (await call(loadRoot, makeEvent({ db, cookies: { concello: 'borrado' } }))) as {
			municipalities: unknown[];
		};
		expect(out.municipalities).toHaveLength(2);
	});

	it('cun só concello redirixe 307 a el', async () => {
		const solo = await createTestDb();
		await solo
			.insert(municipalities)
			.values({ slug: 'soa', name: 'Soa', province: 'Lugo', primaryColor: '#047857' });
		const r = await outcome(() => call(loadRoot, makeEvent({ db: solo })));
		expect(r.thrown).toMatchObject({ status: 307, location: '/soa' });
	});
});

describe('[slug]/+layout.server', () => {
	const ev = (slug: string, userId: string | null = null, name = 'X') =>
		makeEvent({
			db,
			params: { slug },
			user: userId ? { id: userId, displayName: name } : null
		});

	it('slug que non existe dá 404', async () => {
		const r = await outcome(() => call(loadSlug, ev('noexiste')));
		expect(isHttpError(r.thrown, 404)).toBe(true);
	});

	it('sen sesión: user null, sen roles, e pon a cookie concello un ano', async () => {
		const event = ev('ribadavila');
		const out = (await call(loadSlug, event)) as Record<string, unknown>;
		expect(out.user).toBeNull();
		expect(out.roles).toEqual([]);
		expect(out.locale).toBe('gl');
		expect(out.municipality).toEqual({
			slug: 'ribadavila',
			name: 'Ribadávila',
			primaryColor: '#1d4ed8',
			hasLogo: false,
			logoVersion: 0
		});
		const set = event.cookies.sets.find((c) => c.name === 'concello');
		expect(set?.value).toBe('ribadavila');
		expect(set?.opts.maxAge).toBe(365 * 24 * 60 * 60);
	});

	it('cun admin: user con inicial maiúscula e roles contén admin', async () => {
		const out = (await call(loadSlug, ev('ribadavila', adminId, 'amalia Carballal'))) as {
			user: {
				id: string;
				initial: string;
				displayName: string;
				avatar: { key: string | null; hasPhoto: boolean };
			};
			roles: string[];
		};
		expect(out.user).toEqual({
			id: adminId,
			initial: 'A',
			displayName: 'amalia Carballal',
			avatar: { key: null, hasPhoto: false }
		});
		expect(out.roles).toContain('admin');
	});

	it('un rol doutro concello non conta aquí', async () => {
		const out = (await call(loadSlug, ev('ribadavila', plainId, 'Telmo'))) as { roles: string[] };
		expect(out.roles).toEqual([]);
	});
});

describe('[slug]/idioma', () => {
	const post = (body: string) =>
		makeEvent({
			db,
			method: 'POST',
			params: { slug: 'ribadavila' },
			url: 'http://localhost/ribadavila/idioma',
			rawBody: body
		});
	const form = (fields: Record<string, string>) => {
		const event = post('');
		const data = new FormData();
		for (const [k, v] of Object.entries(fields)) data.set(k, v);
		event.request.formData = async () => data;
		return event;
	};

	it('lingua=es pon a cookie e volve a redirectTo', async () => {
		const event = form({ lingua: 'es', redirectTo: '/ribadavila/eu' });
		const r = await outcome(() => call(idioma.default, event));
		expect(r.thrown).toMatchObject({ status: 303, location: '/ribadavila/eu' });
		const set = event.cookies.sets.find((c) => c.name === 'lingua');
		expect(set?.value).toBe('es');
		expect(set?.opts.maxAge).toBe(365 * 24 * 60 * 60);
	});

	it('redirectTo=//evil.example redirixe a /', async () => {
		const event = form({ lingua: 'es', redirectTo: '//evil.example' });
		const r = await outcome(() => call(idioma.default, event));
		expect(r.thrown).toMatchObject({ status: 303, location: '/' });
	});

	it('un idioma descoñecido garda galego', async () => {
		const event = form({ lingua: 'fr', redirectTo: '/ribadavila' });
		await outcome(() => call(idioma.default, event));
		expect(event.cookies.sets.find((c) => c.name === 'lingua')?.value).toBe('gl');
	});

	it('GET volve ao concello', async () => {
		const r = await outcome(() =>
			call(loadIdioma, makeEvent({ db, params: { slug: 'ribadavila' } }))
		);
		expect(r.thrown).toMatchObject({ status: 303, location: '/ribadavila' });
	});
});

describe('[slug]/entrar', () => {
	const ev = (qs: string, userId: string | null) =>
		makeEvent({
			db,
			params: { slug: 'ribadavila' },
			url: `http://localhost/ribadavila/entrar${qs}`,
			user: userId ? { id: userId, displayName: 'X' } : null
		});

	it('con sesión redirixe a redirectTo', async () => {
		const r = await outcome(() =>
			call(loadEntrar, ev('?redirectTo=%2Fribadavila%2Freservas', adminId))
		);
		expect(r.thrown).toMatchObject({ status: 303, location: '/ribadavila/reservas' });
	});

	it('con sesión e redirectTo malicioso redirixe a /', async () => {
		const r = await outcome(() => call(loadEntrar, ev('?redirectTo=%2F%2Fevil.example', adminId)));
		expect(r.thrown).toMatchObject({ status: 303, location: '/' });
	});

	it('sen sesión devolve o redirectTo seguro; por defecto o concello', async () => {
		// Fóra do modo OIDC ofrécense os dous provedores.
		const enabledProviders = ['clave', 'chave365'];
		expect(await call(loadEntrar, ev('?redirectTo=%2Fribadavila%2Feu', null))).toEqual({
			redirectTo: '/ribadavila/eu',
			enabledProviders
		});
		expect(await call(loadEntrar, ev('', null))).toEqual({
			redirectTo: '/ribadavila',
			enabledProviders
		});
	});
});

describe('AppHeader e BottomNav', () => {
	const municipality = {
		slug: 'ribadavila',
		name: 'Ribadávila',
		primaryColor: '#1d4ed8',
		hasLogo: true,
		logoVersion: 0
	};

	it('cabeceira sen sesión: escudo do concello e «Entrar» con redirectTo', () => {
		const { body } = render(AppHeader, {
			props: { municipality, user: null, locale: 'gl', current: '/ribadavila/reservas' }
		});
		expect(body).toContain('/api/v1/m/ribadavila/logo?v=0');
		expect(body).toContain('Ribadávila');
		const versioned = render(AppHeader, {
			props: {
				municipality: { ...municipality, logoVersion: 3 },
				user: null,
				locale: 'gl',
				current: '/ribadavila'
			}
		});
		expect(versioned.body).toContain('/api/v1/m/ribadavila/logo?v=3');
		expect(body).toContain('href="/ribadavila/entrar?redirectTo=%2Fribadavila%2Freservas"');
		expect(body).toContain('Entrar');
	});

	it('cabeceira con sesión: inicial enlazando a /eu; sen escudo, escudo xenérico', () => {
		const { body } = render(AppHeader, {
			props: {
				municipality: { ...municipality, hasLogo: false },
				user: { id: 'u-1', initial: 'A', displayName: 'Amalia' },
				locale: 'gl',
				current: '/ribadavila'
			}
		});
		expect(body).not.toContain('/api/v1/m/');
		expect(body).toContain('href="/ribadavila/eu"');
		expect(body).toMatch(/>\s*A\s*</);
		expect(body).not.toContain('/entrar');
	});

	it('barra inferior: catro enlaces en orde e aria-current só no activo', () => {
		const { body } = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila/reservas', locale: 'gl' }
		});
		const hrefs = [...body.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
		expect(hrefs).toEqual([
			'/ribadavila',
			'/ribadavila/reservas',
			'/ribadavila/avisos',
			'/ribadavila/eu'
		]);
		expect(body.match(/aria-current="page"/g)).toHaveLength(1);
		expect(body).toMatch(/href="\/ribadavila\/reservas"[^>]*aria-current="page"/);
		expect(body).toContain('As miñas reservas');
	});

	it('barra inferior: no detalle da reserva está activa «As miñas reservas»; en /xa, non', () => {
		const id = '0d258c54-2a25-4901-a7fa-c18016f1282d';
		const detail = render(BottomNav, {
			props: { slug: 'ribadavila', current: `/ribadavila/reserva/${id}`, locale: 'gl' }
		}).body;
		expect(detail).toMatch(/href="\/ribadavila\/reservas"[^>]*aria-current="page"/);
		const xa = render(BottomNav, {
			props: { slug: 'ribadavila', current: `/ribadavila/reserva/${id}/xa`, locale: 'gl' }
		}).body;
		expect(xa).not.toMatch(/href="\/ribadavila\/reservas"[^>]*aria-current="page"/);
		expect(xa).toMatch(/href="\/ribadavila"[^>]*aria-current="page"/);
	});

	it('barra inferior: en /ribadavila está activo Reservar; en castelán traduce', () => {
		const { body } = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila', locale: 'es' }
		});
		expect(body).toMatch(/href="\/ribadavila"[^>]*aria-current="page"/);
		expect(body).toContain('Mis reservas');
	});

	it('barra inferior: Avisos activo en /avisos e o globo di «3 avisos sen ler»', () => {
		const { body } = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila/avisos', locale: 'gl', unread: 3 }
		});
		expect(body).toMatch(/href="\/ribadavila\/avisos"[^>]*aria-current="page"/);
		expect(body.match(/aria-current="page"/g)).toHaveLength(1);
		expect(body).toContain('3 avisos sen ler');
		expect(body).toContain('Avisos');
	});

	it('barra inferior: sen avisos novos non hai globo; un só, en singular; en castelán', () => {
		const none = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila', locale: 'gl', unread: 0 }
		}).body;
		expect(none).not.toContain('sen ler');
		const one = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila', locale: 'gl', unread: 1 }
		}).body;
		expect(one).toContain('1 aviso sen ler');
		const es = render(BottomNav, {
			props: { slug: 'ribadavila', current: '/ribadavila', locale: 'es', unread: 3 }
		}).body;
		expect(es).toContain('3 avisos sin leer');
	});
});
