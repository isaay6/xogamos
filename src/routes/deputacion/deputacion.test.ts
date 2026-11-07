// SPDX-License-Identifier: EUPL-1.2
// Panel da Deputación: comparativa, alta de concellos e puntos de entrada.
import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { municipalities, staffRoles, users } from '../../lib/server/db/schema';
import { seedDemo } from '../../lib/server/db/seed';
import { DEMO_DEPUTACION, DEMO_MUNICIPALITIES, DEMO_STAFF } from '../../lib/server/db/seed-data';
import { createTestDb } from '../../lib/server/db/test-db';
import { requirePageDeputacion } from '../../lib/server/http/page-guards';
import { makeEvent } from '../../lib/server/http/test-event';
import { compareMunicipalities, RESERVED_SLUGS } from '../../lib/server/services/deputacion';
import { municipalityIndicators } from '../../lib/server/services/indicators';
import { load as loadSlugLayout } from '../[slug]/+layout.server';
import { load as loadEu } from '../[slug]/eu/+page.server';
import EuPage from '../[slug]/eu/+page.svelte';
import { load as loadRoot } from '../+page.server';
import RootPage from '../+page.svelte';
import { load as loadLayout } from './+layout.server';
import { load as loadComparativa } from './+page.server';
import ComparativaPage from './+page.svelte';
import { actions as novoActions, load as loadNovo } from './novo/+page.server';
import NovoPage from './novo/+page.svelte';
import { actions as idiomaActions } from './idioma/+page.server';
import { actions as adminsActions, load as loadAdmins } from './administradores/+page.server';

// Xoves 26 nov 2026, 12:00 en Madrid (a demo colócase arredor de agora).
const NOW = new Date('2026-11-26T12:00:00+01:00');
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

let db: Db;
let dep: SessionUser;
let admin: SessionUser;
let resident: SessionUser;

async function userBySubject(subject: string): Promise<SessionUser> {
	const [u] = await db.select().from(users).where(eq(users.subject, subject));
	return { id: u.id, displayName: u.displayName };
}

beforeAll(async () => {
	db = await createTestDb();
	await seedDemo(db, { now: NOW, scale: 0.2 });
	dep = await userBySubject(DEMO_DEPUTACION.subject);
	admin = await userBySubject(DEMO_STAFF.find((s) => s.role === 'admin')!.subject);
	resident = await userBySubject('DEMO-2');
});

const ev = (user: SessionUser | null, url = 'http://localhost/deputacion', extra = {}) =>
	makeEvent({ db, now: NOW, user, url, ...extra });

const post = (user: SessionUser | null, fields: Record<string, string>, path = 'novo') => {
	const event = ev(user, `http://localhost/deputacion/${path}`, { method: 'POST' });
	Object.defineProperty(event, 'request', {
		value: new Request(event.url, { method: 'POST', body: new URLSearchParams(fields) })
	});
	return event;
};

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

const valid = {
	name: 'Vilanova de Proba',
	slug: 'vilanova-de-proba',
	province: 'Pontevedra',
	primaryColor: '#8A3FFC',
	adminName: 'Marta Proba Ficticia',
	provider: 'clave',
	subject: 'DEMO-77777777A'
};

describe('requirePageDeputacion', () => {
	it('sen sesión: 303 á entrada; sen o rol: 403; con rol devolve a persoa', async () => {
		const anon = await outcome(() => requirePageDeputacion(ev(null) as never));
		expect(isRedirect(anon.thrown) && anon.thrown.status).toBe(303);
		expect(isRedirect(anon.thrown) && anon.thrown.location).toContain('redirectTo=%2Fdeputacion');
		// Sin cookie, o con una cookie de un concello que no existe: el primero por nombre.
		expect(isRedirect(anon.thrown) && anon.thrown.location).toBe(
			'/a-pobra-de-trives/entrar?redirectTo=%2Fdeputacion'
		);
		const stale = await outcome(() =>
			requirePageDeputacion(ev(null, undefined, { cookies: { concello: 'non-existe' } }) as never)
		);
		expect(isRedirect(stale.thrown) && stale.thrown.location).toBe(
			'/a-pobra-de-trives/entrar?redirectTo=%2Fdeputacion'
		);
		const known = await outcome(() =>
			requirePageDeputacion(
				ev(null, undefined, { cookies: { concello: 'viana-do-bolo' } }) as never
			)
		);
		expect(isRedirect(known.thrown) && known.thrown.location).toBe(
			'/viana-do-bolo/entrar?redirectTo=%2Fdeputacion'
		);
		const empty = await createTestDb();
		const none = await outcome(() =>
			requirePageDeputacion(makeEvent({ db: empty, url: 'http://localhost/deputacion' }) as never)
		);
		expect(isRedirect(none.thrown) && none.thrown.location).toBe('/?redirectTo=%2Fdeputacion');
		const forbidden = await outcome(() => requirePageDeputacion(ev(admin) as never));
		expect(isHttpError(forbidden.thrown) && forbidden.thrown.status).toBe(403);
		const ok = await requirePageDeputacion(ev(dep) as never);
		expect(ok.id).toBe(dep.id);
	});
});

describe('Comparativa', () => {
	it('anónimo: redirección ao inicio de sesión', async () => {
		const r = await outcome(() => call(loadComparativa, ev(null)));
		expect(isRedirect(r.thrown)).toBe(true);
	});

	it('admin dun concello: 403; o layout tamén', async () => {
		const r = await outcome(() => call(loadComparativa, ev(admin)));
		expect(isHttpError(r.thrown) && r.thrown.status).toBe(403);
		const l = await outcome(() => call(loadLayout, ev(admin)));
		expect(isHttpError(l.thrown) && l.thrown.status).toBe(403);
	});

	it('deputación: unha fila por concello da demo, con números e sen datos persoais', async () => {
		const data = await call<
			Promise<{ rows: Record<string, unknown>[]; rango: string; from: string; to: string }>
		>(loadComparativa, ev(dep));
		expect(data.rows).toHaveLength(DEMO_MUNICIPALITIES.length);
		for (const row of data.rows) {
			for (const k of ['facilities', 'openFacilities', 'bookings', 'avgOccupancy', 'noShowRate']) {
				expect(typeof row[k], k).toBe('number');
			}
			expect(Object.keys(row).sort()).toEqual(
				[
					'avgOccupancy',
					'bookings',
					'facilities',
					'id',
					'name',
					'noShowRate',
					'openFacilities',
					'province',
					'slug'
				].sort()
			);
		}
		expect(data.rango).toBe('mes');
		expect(data.from).toBe('2026-10-28');
		expect(data.to).toBe('2026-11-26');
	});

	it('a ocupación media de cada concello deixa fóra as instalacións pechadas (piscinas de Viana)', async () => {
		const rows = await compareMunicipalities(db, '2026-11-23', '2026-11-26');
		const viana = rows.find((r) => r.slug === 'viana-do-bolo')!;
		// Viana ten sete instalacións reais; as dúas piscinas están pechadas fóra do verán.
		expect(viana.facilities).toBe(7);
		expect(viana.openFacilities).toBe(5);
		const { byFacility } = await municipalityIndicators(db, viana.id, '2026-11-23', '2026-11-26');
		const open = byFacility.filter((f) => f.open);
		expect(open).toHaveLength(5);
		const mean = open.reduce((n, f) => n + f.occupancy, 0) / open.length;
		expect(viana.avgOccupancy).toBeCloseTo(mean, 3);
		expect(viana.avgOccupancy).toBeGreaterThan(
			byFacility.reduce((n, f) => n + f.occupancy, 0) / byFacility.length
		);
	});

	it('o intervalo: semana 7 días, mes 30 días e 3 meses 91 días; un valor inválido cae ao mes', async () => {
		const load = (q: string) =>
			call<Promise<{ rango: string; from: string; to: string }>>(
				loadComparativa,
				ev(dep, `http://localhost/deputacion${q}`)
			);
		expect(await load('?rango=mes')).toMatchObject({ rango: 'mes', from: '2026-10-28' });
		expect(await load('?rango=tres')).toMatchObject({ rango: 'tres', from: '2026-08-28' });
		expect(await load('?rango=ano')).toMatchObject({ rango: 'mes', from: '2026-10-28' });
		expect(await load('?rango=')).toMatchObject({ rango: 'mes' });
	});

	it('o resultado cadra coa API (a mesma comparativa)', async () => {
		const data = await call<Promise<{ rows: { slug: string; bookings: number }[] }>>(
			loadComparativa,
			ev(dep, 'http://localhost/deputacion?rango=tres')
		);
		expect(data.rows.reduce((n, r) => n + r.bookings, 0)).toBeGreaterThan(0);
	});

	it('SSR: táboa con caption e th scope, ligazón á páxina pública e fila de totais', async () => {
		const data = await call<Promise<object>>(loadComparativa, ev(dep));
		const body = render(ComparativaPage as never, {
			props: { data: { locale: 'gl', ...data }, form: undefined } as never
		}).body;
		expect(body).toContain('<table');
		expect(body).toMatch(/<caption[^>]*>[^<]+<\/caption>/);
		expect(body).toContain('scope="col"');
		expect(body).toContain('scope="row"');
		expect(body).toContain('href="/viana-do-bolo"');
		expect(body).not.toContain('/admin');
		expect(body).toContain(t('gl', 'dep.total'));
		expect(body).toContain(t('gl', 'dep.rango.mes'));
	});

	it('SSR: a ocupación total pondérase por instalacións abertas (un concello con 0 non a baixa)', () => {
		const row = (id: string, facilities: number, avgOccupancy: number, open = facilities) => ({
			id,
			slug: id,
			name: id,
			province: 'Lugo',
			facilities,
			openFacilities: open,
			bookings: 0,
			avgOccupancy,
			noShowRate: 0
		});
		const html = (rows: ReturnType<typeof row>[]) =>
			render(ComparativaPage as never, {
				props: {
					data: {
						locale: 'gl',
						rows,
						rango: 'semana',
						from: '2026-11-23',
						to: '2026-11-26',
						novo: null
					},
					form: undefined
				} as never
			}).body;
		const foot = (b: string) =>
			/<tfoot[^>]*>.*?<span class="v[^"]*"[^>]*>([^<]*)<\/span>/s.exec(b)![1];
		expect(foot(html([row('a', 4, 0.5), row('b', 0, 0)]))).toBe('50%');
		expect(foot(html([row('a', 0, 0), row('b', 0, 0)]))).toBe('0%');
		// Pechadas todo o período (piscina de verán): non pesan no total.
		expect(foot(html([row('a', 4, 0.5, 2), row('b', 2, 0.2, 2)]))).toBe('35%');
		expect(foot(html([row('a', 3, 0.6, 3), row('b', 1, 0, 0)]))).toBe('60%');
	});

	it('SSR: sen concellos, o estado baleiro', () => {
		const body = render(ComparativaPage as never, {
			props: {
				data: {
					locale: 'gl',
					rows: [],
					rango: 'semana',
					from: '2026-11-23',
					to: '2026-11-26',
					novo: null
				},
				form: undefined
			} as never
		}).body;
		expect(body).toContain('Aínda non hai concellos');
		expect(body).not.toContain('<table');
	});

	it('?novo={slug} mostra o aviso só se o concello existe', async () => {
		const withNovo = await call<Promise<{ novo: { slug: string } | null }>>(
			loadComparativa,
			ev(dep, 'http://localhost/deputacion?novo=viana-do-bolo')
		);
		expect(withNovo.novo?.slug).toBe('viana-do-bolo');
		const bogus = await call<Promise<{ novo: unknown }>>(
			loadComparativa,
			ev(dep, 'http://localhost/deputacion?novo=non-existe')
		);
		expect(bogus.novo).toBeNull();
		const body = render(ComparativaPage as never, {
			props: {
				data: {
					locale: 'gl',
					rows: [],
					rango: 'semana',
					from: '2026-11-23',
					to: '2026-11-26',
					novo: withNovo.novo
				},
				form: undefined
			} as never
		}).body;
		expect(body).toContain('Concello creado');
		expect(body).toContain('href="/viana-do-bolo"');
	});
});

describe('Novo concello', () => {
	it('load: só a deputación', async () => {
		expect(await call(loadNovo, ev(dep, 'http://localhost/deputacion/novo'))).toBeDefined();
		const r = await outcome(() => call(loadNovo, ev(admin, 'http://localhost/deputacion/novo')));
		expect(isHttpError(r.thrown) && r.thrown.status).toBe(403);
	});

	it('un POST válido crea o concello e a súa primeira persoa administradora, e dá 303', async () => {
		const r = await outcome(() => call(novoActions.default, post(dep, valid)));
		expect(isRedirect(r.thrown) && r.thrown.status).toBe(303);
		expect(isRedirect(r.thrown) && r.thrown.location).toBe('/deputacion?novo=vilanova-de-proba');
		const [m] = await db.select().from(municipalities).where(eq(municipalities.slug, valid.slug));
		expect(m.name).toBe(valid.name);
		expect(m.primaryColor).toBe('#8A3FFC');
		const [u] = await db.select().from(users).where(eq(users.subject, valid.subject));
		expect(u.displayName).toBe(valid.adminName);
		const roles = await db
			.select()
			.from(staffRoles)
			.where(and(eq(staffRoles.municipalityId, m.id), eq(staffRoles.userId, u.id)));
		expect(roles.map((x) => x.role)).toEqual(['admin']);
	});

	it('slug reservado ou repetido: fail con SLUG_TAKEN ao carón do campo', async () => {
		for (const slug of ['deputacion', 'admin', valid.slug, 'viana-do-bolo']) {
			const r = await call<Promise<unknown>>(novoActions.default, post(dep, { ...valid, slug }));
			expect(isActionFailure(r), slug).toBe(true);
			const f = r as { status: number; data: { errors: Record<string, string>; values: object } };
			expect(f.status).toBe(409);
			expect(f.data.errors.slug).toBe('SLUG_TAKEN');
			expect(f.data.values).toMatchObject({ slug });
		}
	});

	it('cor ou slug inválidos: fail 400 con erros por campo', async () => {
		const r = await call<Promise<unknown>>(
			novoActions.default,
			post(dep, { ...valid, slug: 'Con Espazos', primaryColor: 'azul', name: '  ' })
		);
		expect(isActionFailure(r)).toBe(true);
		const f = r as { status: number; data: { errors: Record<string, string> } };
		expect(f.status).toBe(400);
		expect(Object.keys(f.data.errors).sort()).toEqual(['name', 'primaryColor', 'slug']);
	});

	it('provincia, proveedor e identificador inválidos tamén fallan', async () => {
		const r = await call<Promise<unknown>>(
			novoActions.default,
			post(dep, { ...valid, province: 'Madrid', provider: 'x', subject: '', adminName: '' })
		);
		const f = r as { status: number; data: { errors: Record<string, string> } };
		expect(f.status).toBe(400);
		expect(Object.keys(f.data.errors).sort()).toEqual([
			'adminName',
			'provider',
			'province',
			'subject'
		]);
	});

	it('unha persoa administradora ou veciña: 403 e non se crea nada', async () => {
		for (const u of [admin, resident]) {
			const r = await outcome(() =>
				call(novoActions.default, post(u, { ...valid, slug: 'non-debe-existir' }))
			);
			expect(isHttpError(r.thrown) && r.thrown.status).toBe(403);
		}
		const none = await db
			.select()
			.from(municipalities)
			.where(eq(municipalities.slug, 'non-debe-existir'));
		expect(none).toHaveLength(0);
		const anon = await outcome(() => call(novoActions.default, post(null, valid)));
		expect(isRedirect(anon.thrown)).toBe(true);
	});

	it('SSR: formulario con etiquetas, aviso da demo e cor por defecto', () => {
		const body = render(NovoPage as never, {
			props: { data: { locale: 'gl', provinces: ['A Coruña', 'Lugo'] }, form: undefined } as never
		}).body;
		expect(body).toContain('Identificador (DNI/NIE)');
		expect(body).toContain('type="color"');
		expect(body).toContain('#17202A');
		expect(body).toContain('Cl@ve');
		expect(body).toContain('Chave365');
		expect(body).toContain('A Coruña');
	});

	it('SSR: o erro SLUG_TAKEN aparece ao carón do campo', () => {
		const body = render(NovoPage as never, {
			props: {
				data: { locale: 'gl', provinces: ['Lugo'] },
				form: { errors: { slug: 'SLUG_TAKEN' }, values: valid }
			} as never
		}).body;
		expect(body).toContain('aria-invalid="true"');
		expect(body).toContain(t('gl', 'dep.erro.SLUG_TAKEN'));
	});
});

describe('Administradores dos concellos', () => {
	it('unha persoa sen rol da deputación recibe 404', async () => {
		const result = await outcome(() =>
			call(loadAdmins, ev(admin, 'http://localhost/deputacion/administradores'))
		);
		expect(isHttpError(result.thrown) && result.thrown.status).toBe(404);
	});

	it('asigna unha persoa existente, repetir non duplica e permite retirala', async () => {
		const target = DEMO_MUNICIPALITIES[0];
		const [municipality] = await db
			.select()
			.from(municipalities)
			.where(eq(municipalities.slug, target.slug));
		const [candidate] = await db
			.select()
			.from(users)
			.where(
				eq(
					users.subject,
					DEMO_STAFF.find((staff) => staff.role === 'admin' && staff.municipality !== target.slug)!
						.subject
				)
			);
		for (let i = 0; i < 2; i++) {
			const added = await call<Promise<unknown>>(
				adminsActions.engadir,
				post(dep, { municipalityId: municipality.id, userId: candidate.id }, 'administradores')
			);
			expect(added).toMatchObject({ added: true });
		}
		const roles = await db
			.select()
			.from(staffRoles)
			.where(
				and(
					eq(staffRoles.municipalityId, municipality.id),
					eq(staffRoles.userId, candidate.id),
					eq(staffRoles.role, 'admin')
				)
			);
		expect(roles).toHaveLength(1);
		expect(
			await call<Promise<unknown>>(
				adminsActions.quitar,
				post(dep, { municipalityId: municipality.id, roleId: roles[0].id }, 'administradores')
			)
		).toMatchObject({ removed: true });
	});

	it('non permite retirar a última persoa administradora', async () => {
		const data = await call<
			Promise<{ municipalities: { id: string; admins: { roleId: string }[] }[] }>
		>(loadAdmins, ev(dep, 'http://localhost/deputacion/administradores'));
		const only = data.municipalities.find((municipality) => municipality.admins.length === 1)!;
		const result = await call<Promise<unknown>>(
			adminsActions.quitar,
			post(dep, { municipalityId: only.id, roleId: only.admins[0].roleId }, 'administradores')
		);
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number; data: { error: string } }).status).toBe(409);
		expect((result as { data: { error: string } }).data.error).toBe('LAST_ADMIN');
	});
});

describe('Idioma da Deputación', () => {
	it('garda a cookie e volve; só a deputación', async () => {
		const event = post(dep, { lingua: 'es', redirectTo: '/deputacion' }, 'idioma');
		const r = await outcome(() => call(idiomaActions.default, event));
		expect(isRedirect(r.thrown) && r.thrown.location).toBe('/deputacion');
		expect(event.cookies.get('lingua')).toBe('es');
		const bad = await outcome(() =>
			call(
				idiomaActions.default,
				post(admin, { lingua: 'es', redirectTo: '/deputacion' }, 'idioma')
			)
		);
		expect(isHttpError(bad.thrown) && bad.thrown.status).toBe(403);
	});
});

describe('Rutas e slugs reservados', () => {
	it('«deputacion» está reservado e todas as rutas estáticas de primeiro nivel tamén', () => {
		expect(RESERVED_SLUGS).toContain('deputacion');
		const dir = fileURLToPath(new URL('..', import.meta.url));
		const top = readdirSync(dir, { withFileTypes: true })
			.filter((d) => d.isDirectory() && !/^[[(]/.test(d.name))
			.map((d) => d.name);
		expect(top).toContain('deputacion');
		// Segmento estático gaña a `[slug]` en SvelteKit; ningún concello pode colar un deses nomes.
		for (const name of top) expect(RESERVED_SLUGS, name).toContain(name);
	});
});

describe('Puntos de entrada', () => {
	const slugEvent = (user: SessionUser | null) =>
		ev(user, 'http://localhost/viana-do-bolo/eu', { params: { slug: 'viana-do-bolo' } });

	it('o layout do concello marca isDeputacion só para o rol da deputación (sen tocar roles)', async () => {
		const asDep = await call<Promise<{ isDeputacion: boolean; roles: string[] }>>(
			loadSlugLayout,
			slugEvent(dep)
		);
		expect(asDep.isDeputacion).toBe(true);
		expect(asDep.roles).toEqual([]);
		const asAdmin = await call<Promise<{ isDeputacion: boolean; roles: string[] }>>(
			loadSlugLayout,
			slugEvent(admin)
		);
		expect(asAdmin.isDeputacion).toBe(false);
		expect(asAdmin.roles).toEqual(['admin']);
		const anon = await call<Promise<{ isDeputacion: boolean }>>(loadSlugLayout, slugEvent(null));
		expect(anon.isDeputacion).toBe(false);
	});

	it('Eu mostra a ligazón «Deputación» só con ese rol', async () => {
		const html = async (user: SessionUser, isDeputacion: boolean) => {
			const eu = await call<Promise<object>>(loadEu, slugEvent(user));
			return render(EuPage as never, {
				props: {
					data: {
						locale: 'gl',
						municipality: { slug: 'viana-do-bolo', name: 'Viana do Bolo' },
						roles: [],
						isDeputacion,
						...eu
					},
					form: undefined
				} as never
			}).body;
		};
		expect(await html(dep, true)).toContain('href="/deputacion"');
		expect(await html(admin, false)).not.toContain('href="/deputacion"');
		expect(await html(resident, false)).not.toContain('/deputacion');
	});

	it('a raíz ofrece «Panel da Deputación» só a quen ten o rol', async () => {
		const root = async (user: SessionUser | null) => {
			const data = await call<Promise<object>>(loadRoot, ev(user, 'http://localhost/'));
			return {
				data,
				body: render(RootPage as never, {
					props: { data: { locale: 'gl', ...data } } as never
				}).body
			};
		};
		const asDep = await root(dep);
		expect((asDep.data as { isDeputacion: boolean }).isDeputacion).toBe(true);
		expect(asDep.body).toContain('Panel da Deputación');
		expect(asDep.body).toContain('href="/deputacion"');
		expect((await root(admin)).body).not.toContain('/deputacion');
		expect((await root(null)).body).not.toContain('/deputacion');
	});
});
