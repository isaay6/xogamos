// SPDX-License-Identifier: EUPL-1.2
// Benvida en tres pasos (v1, tarefa 8): concellos, avatar e avisos con empadroamento declarado.
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { municipalityProfiles, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture } from '../../lib/server/services/fixtures';
import { load, actions } from './+page.server';
import BenvidaPage from './+page.svelte';

const NOW = new Date('2026-11-25T10:00:00+01:00');
const call = <T = Promise<unknown>>(fn: unknown, event: unknown) =>
	(fn as (e: never) => T)(event as never);

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

async function fresh() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	// Persoa nova: sen perfís nin benvida feita.
	const [row] = await db
		.insert(users)
		.values({ provider: 'clave', subject: 'NOVA-1', displayName: 'Antía Nova' })
		.returning();
	return { db, f, u: { id: row.id, displayName: row.displayName } as SessionUser };
}

const get = (db: Db, u: SessionUser | null, query = '') =>
	makeEvent({ db, now: NOW, user: u, url: `http://localhost/benvida${query}` });

function post(db: Db, u: SessionUser, fields: Record<string, string | string[]>, query = '') {
	const event = makeEvent({
		db,
		now: NOW,
		user: u,
		method: 'POST',
		url: `http://localhost/benvida${query}`
	});
	const body = new FormData();
	for (const [k, v] of Object.entries(fields))
		for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
	(event as { request: Request }).request = new Request(event.url, { method: 'POST', body });
	return event;
}

const html = (data: object, form?: object) =>
	render(BenvidaPage as never, { props: { data: { locale: 'gl', ...data }, form } as never }).body;

const location = (r: { thrown?: unknown }) => (r.thrown as { location: string }).location;

// Cada proba crea a súa base de datos; coa batería enteira en paralelo pode pasar dos 30 s.
describe('benvida', { timeout: 90_000 }, () => {
	it('sen sesión vai á raíz', async () => {
		const { db } = await fresh();
		const r = await outcome(() => call(load, get(db, null)));
		expect(isRedirect(r.thrown)).toBe(true);
		expect(location(r)).toBe('/');
	});

	it('paso 1: o concello de entrada vai primeiro e marcado; o resto despois', async () => {
		const { db, u } = await fresh();
		const data = await call<
			Promise<{ paso: number; municipalities: { slug: string; checked: boolean }[] }>
		>(load, get(db, u, `?redirectTo=${encodeURIComponent('/montemaior-do-rio/reservas')}`));
		expect(data.paso).toBe(1);
		expect(data.municipalities.map((m) => m.slug)).toEqual(['montemaior-do-rio', 'ribadavila']);
		expect(data.municipalities.map((m) => m.checked)).toEqual([true, false]);
		const out = html(data);
		expect(out).toContain('type="checkbox"');
		expect(out).toContain('Cal é o teu concello?');
		expect(out).toContain('Ola, Antía');
	});

	it('paso 1 sen ningún concello dá fail(400) e non crea perfís', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() => call(actions.concellos, post(db, u, {}, '?paso=1')));
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(400);
		const rows = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.userId, u.id));
		expect(rows).toEqual([]);
		const data = await call<Promise<object>>(load, get(db, u));
		expect(html(data, (r.value as { data: object }).data)).toContain(
			'Escolle polo menos un concello.'
		);
	});

	it('paso 1 con dous concellos crea os perfís e pasa ao 2 conservando redirectTo', async () => {
		const { db, f, u } = await fresh();
		const r = await outcome(() =>
			call(
				actions.concellos,
				post(db, u, {
					concello: [f.municipalityId, f.otherMunicipalityId],
					redirectTo: '/ribadavila/reservas'
				})
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(location(r)).toBe(
			`/benvida?paso=2&redirectTo=${encodeURIComponent('/ribadavila/reservas')}`
		);
		const rows = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.userId, u.id));
		expect(rows).toHaveLength(2);
		expect(rows.every((p) => p.followed && !p.isResident)).toBe(true);
	});

	it('paso 1 cun id descoñecido dá fail(400)', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() =>
			call(actions.concellos, post(db, u, { concello: '00000000-0000-4000-8000-000000000000' }))
		);
		expect(isActionFailure(r.value)).toBe(true);
	});

	it('pasos 2 e 3 sen concellos volven ao 1', async () => {
		const { db, u } = await fresh();
		for (const q of ['?paso=2', '?paso=3']) {
			const r = await outcome(() => call(load, get(db, u, q)));
			expect(isRedirect(r.thrown)).toBe(true);
			expect(location(r)).toBe('/benvida?paso=1');
		}
	});

	it('paso 2: grella con Persoas, Deportes e Foto; gardar o avatar pasa ao 3', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const data = await call<Promise<{ paso: number; tab: string }>>(load, get(db, u, '?paso=2'));
		expect(data.paso).toBe(2);
		expect(data.tab).toBe('persoas');
		const out = html(data);
		for (const label of ['Persoas', 'Deportes', 'Foto', 'Muller con lentes', 'Saltar'])
			expect(out).toContain(label);
		expect(out).toContain('href="/benvida?paso=2&amp;tab=deportes"');
		// Os nenos tamén están entre as persoas.
		expect(out).toContain('value="nena-coletas"');

		const r = await outcome(() =>
			call(actions.avatar, post(db, u, { avatar: 'muller-lentes', redirectTo: '' }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(location(r)).toBe('/benvida?paso=3');
		const [row] = await db.select().from(users).where(eq(users.id, u.id));
		expect(row.avatarKey).toBe('muller-lentes');

		const bad = await outcome(() => call(actions.avatar, post(db, u, { avatar: 'dragon' })));
		expect(isActionFailure(bad.value)).toBe(true);
	});

	it('paso 2, foto: un SVG dá UNSUPPORTED_IMAGE e unha PNG gárdase', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', {
			type: 'image/svg+xml'
		});
		const event = post(db, u, {});
		const body = new FormData();
		body.set('foto', svg);
		(event as { request: Request }).request = new Request(event.url, { method: 'POST', body });
		const r = await outcome(() => call(actions.foto, event));
		expect(isActionFailure(r.value)).toBe(true);
		const failure = r.value as { status: number; data: { foto: string } };
		expect(failure.data.foto).toBe('UNSUPPORTED_IMAGE');
		const data = await call<Promise<object>>(load, get(db, u, '?paso=2&tab=foto'));
		expect(html(data, failure.data)).toContain('PNG, JPEG ou WebP');

		const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'a.png');
		const ok = post(db, u, {});
		const okBody = new FormData();
		okBody.set('foto', png);
		(ok as { request: Request }).request = new Request(ok.url, { method: 'POST', body: okBody });
		const r2 = await outcome(() => call(actions.foto, ok));
		expect(isRedirect(r2.thrown)).toBe(true);
		const [row] = await db.select().from(users).where(eq(users.id, u.id));
		expect(row.avatarMime).toBe('image/png');
	});

	it('paso 3 con correo e sen consentimento dá fail(400) e non garda nada', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(actions.rematar, post(db, u, { avisos: 'correo', email: 'antia@exemplo.gal' }))
		);
		expect(isActionFailure(r.value)).toBe(true);
		const failure = r.value as { status: number; data: { issues: Record<string, boolean> } };
		expect(failure.status).toBe(400);
		expect(failure.data.issues.consentimento).toBe(true);
		const [row] = await db.select().from(users).where(eq(users.id, u.id));
		expect(row.onboardedAt).toBeNull();
		expect(row.notifyEmail).toBe(false);
		const data = await call<Promise<object>>(load, get(db, u, '?paso=3'));
		expect(html(data, failure.data)).toContain('Marca a caixa');
	});

	it('rematar garda os avisos, declara o empadroamento, marca onboarded_at e vai a redirectTo', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(
				actions.rematar,
				post(db, u, {
					avisos: 'correo',
					email: 'antia@exemplo.gal',
					consentimento: 'si',
					empadroado: f.municipalityId,
					redirectTo: '/ribadavila/reservas'
				})
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(location(r)).toBe('/ribadavila/reservas');
		const [row] = await db.select().from(users).where(eq(users.id, u.id));
		expect(row.onboardedAt?.getTime()).toBe(NOW.getTime());
		expect(row.notifyEmail).toBe(true);
		expect(row.notifyConsentAt?.getTime()).toBe(NOW.getTime());
		expect(row.email).toBe('antia@exemplo.gal');
		const [profile] = await db
			.select()
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.userId, u.id),
					eq(municipalityProfiles.municipalityId, f.municipalityId)
				)
			);
		// Declaración: queda pendente; o prezo segue sendo o de non empadroado.
		expect(profile.residencyDeclaredAt?.getTime()).toBe(NOW.getTime());
		expect(profile.isResident).toBe(false);
	});

	it('rematar sen redirectTo vai ao primeiro concello; un redirectTo externo vai a /', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() => call(actions.rematar, post(db, u, { avisos: 'app' })));
		expect(location(r)).toBe('/ribadavila');

		const other = await fresh();
		await call(
			actions.concellos,
			post(other.db, other.u, { concello: other.f.municipalityId })
		).catch(() => {});
		const ext = await outcome(() =>
			call(
				actions.rematar,
				post(other.db, other.u, { avisos: 'app', redirectTo: 'https://evil.example/x' })
			)
		);
		expect(location(ext)).toBe('/');
		const [row] = await other.db.select().from(users).where(eq(users.id, other.u.id));
		expect(row.onboardedAt).not.toBeNull();
		expect(row.notifyEmail).toBe(false);
	});

	it('empadroamento nun concello que non segue dá fail(400)', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(actions.rematar, post(db, u, { avisos: 'app', empadroado: f.otherMunicipalityId }))
		);
		expect(isActionFailure(r.value)).toBe(true);
	});

	it('paso 3 ofrece só os concellos escollidos e di «pendente de comprobar»', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const data = await call<Promise<object>>(load, get(db, u, '?paso=3'));
		const out = html(data);
		expect(out).toContain('Estou empadroado/a en Ribadávila');
		expect(out).not.toContain('Montemaior do Río');
		expect(out).toContain('pendente de comprobar');
		expect(out).toContain('Só na app');
		expect(out).toContain('name="consentimento"');
	});

	it('cada formulario leva o paso e redirectTo na URL da acción (o erro queda no mesmo paso)', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const q = `redirectTo=${encodeURIComponent('/ribadavila/reservas')}`;
		const one = html(await call<Promise<object>>(load, get(db, u, `?paso=1&${q}`)));
		expect(one).toContain(`action="?/concellos&amp;paso=1&amp;${q}"`);
		const two = html(await call<Promise<object>>(load, get(db, u, `?paso=2&tab=foto&${q}`)));
		expect(two).toContain(`action="?/foto&amp;paso=2&amp;tab=foto&amp;${q}"`);
		const three = html(await call<Promise<object>>(load, get(db, u, `?paso=3&${q}`)));
		expect(three).toContain(`action="?/rematar&amp;paso=3&amp;${q}"`);
	});

	it('rematar sen ningún concello seguido volve ao paso 1 e non marca a benvida', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() =>
			call(actions.rematar, post(db, u, { avisos: 'app', redirectTo: '/ribadavila' }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(location(r)).toBe(`/benvida?paso=1&redirectTo=${encodeURIComponent('/ribadavila')}`);
		const [row] = await db.select().from(users).where(eq(users.id, u.id));
		expect(row.onboardedAt).toBeNull();
	});

	it('rematar con redirectTo «/» vai ao primeiro concello seguido', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(actions.rematar, post(db, u, { avisos: 'app', redirectTo: '/' }))
		);
		expect(location(r)).toBe('/ribadavila');
	});

	it('tras un erro, o correo e a caixa de consentimento volven co enviado', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(actions.rematar, post(db, u, { avisos: 'correo', email: 'mal', consentimento: 'si' }))
		);
		const failure = r.value as { data: object };
		const out = html(await call<Promise<object>>(load, get(db, u, '?paso=3')), failure.data);
		expect(out).toContain('value="mal"');
		expect(out).toMatch(/name="consentimento" value="si" checked/);
	});

	it('tras un erro dos avisos, o empadroamento escollido volve marcado', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const r = await outcome(() =>
			call(
				actions.rematar,
				post(db, u, { avisos: 'correo', email: 'mal', empadroado: f.municipalityId })
			)
		);
		expect(isActionFailure(r.value)).toBe(true);
		const failure = r.value as { data: object };
		const out = html(await call<Promise<object>>(load, get(db, u, '?paso=3')), failure.data);
		expect(out).toMatch(new RegExp(`name="empadroado" value="${f.municipalityId}" checked`));
		expect(out).not.toMatch(/name="empadroado" value="" checked/);
		// Sen erro previo, «non» segue marcado por defecto.
		const clean = html(await call<Promise<object>>(load, get(db, u, '?paso=3')));
		expect(clean).toMatch(/name="empadroado" value="" checked/);
	});

	it('unha foto grande non se le enteira: o tamaño compróbase antes', async () => {
		const { db, f, u } = await fresh();
		await call(actions.concellos, post(db, u, { concello: f.municipalityId })).catch(() => {});
		const spy = vi.spyOn(File.prototype, 'arrayBuffer');
		try {
			const event = post(db, u, {});
			const body = new FormData();
			body.set('foto', new File([new Uint8Array(300_000)], 'big.png', { type: 'image/png' }));
			(event as { request: Request }).request = new Request(event.url, { method: 'POST', body });
			const r = await outcome(() => call(actions.foto, event));
			expect((r.value as { data: { foto: string } }).data.foto).toBe('PHOTO_TOO_LARGE');
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it('quen xa fixo a benvida vai directo ao destino', async () => {
		const { db, u } = await fresh();
		await db.update(users).set({ onboardedAt: NOW }).where(eq(users.id, u.id));
		const r = await outcome(() =>
			call(load, get(db, u, `?redirectTo=${encodeURIComponent('/ribadavila')}`))
		);
		expect(location(r)).toBe('/ribadavila');
	});
});
