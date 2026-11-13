// SPDX-License-Identifier: EUPL-1.2
// Eu (tarea 8): perfil con racha, historial, datos de contacto y textos legales; en v1, tamén
// os meus concellos, o meu perfil (avatar) e as preferencias de avisos.
import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { bookings, municipalities, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../lib/server/services/fixtures';
import { t } from '../../lib/i18n';
import { load as loadDatos, actions as datosActions } from './eu/datos/+page.server';
import DatosPage from './eu/datos/+page.svelte';
import { load as loadHistorial } from './eu/historial/+page.server';
import HistorialPage from './eu/historial/+page.svelte';
import { load as loadEu } from './eu/+page.server';
import EuPage from './eu/+page.svelte';
import { load as loadLegal } from './legal/[doc]/+page.server';
import LegalPage from './legal/[doc]/+page.svelte';
import { load as loadConcellos, actions as concellosActions } from './eu/concellos/+page.server';
import ConcellosPage from './eu/concellos/+page.svelte';
import { load as loadPerfil, actions as perfilActions } from './eu/perfil/+page.server';
import PerfilPage from './eu/perfil/+page.svelte';
import { load as loadAvisosPrefs, actions as avisosActions } from './eu/avisos/+page.server';
import AvisosPrefsPage from './eu/avisos/+page.svelte';
import { load as loadConfirmar } from './confirmar/+page.server';
import { load as loadSlugLayout } from './+layout.server';
import AppHeader from '../../lib/ui/AppHeader.svelte';

// Miércoles 25 nov 2026, 10:00 en Madrid.
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

async function book(
	db: Db,
	f: Fixture,
	date: string,
	hhmm: string,
	status: 'confirmed' | 'cancelled' | 'no_show' | 'attended' = 'attended'
) {
	const startsAt = localDateTimeToUtc(date, hhmm);
	const [row] = await db
		.insert(bookings)
		.values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			seats: 1,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3600_000),
			accessCode: '482193',
			priceCents: 600,
			status,
			channel: 'online',
			createdByUserId: f.userId
		})
		.returning();
	return row.id;
}

const ev = (db: Db, user: SessionUser | null, extra = {}) =>
	makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila' },
		url: 'http://localhost/ribadavila/eu',
		...extra
	});

async function fresh() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	return { db, f, u: { id: f.userId, displayName: 'Nerea Veciña' } as SessionUser };
}

const layout = { municipality: { slug: 'ribadavila', name: 'Ribadávila' }, locale: 'gl' as const };
const html = (component: unknown, data: object, form?: object) =>
	render(component as never, { props: { data: { ...layout, ...data }, form } as never }).body;

describe('Eu', () => {
	it('sen sesión: summary null e a páxina ofrece Entrar e os textos legais', async () => {
		const { db } = await fresh();
		const data = await call<Promise<{ summary: null }>>(loadEu, ev(db, null));
		expect(data.summary).toBeNull();
		const out = html(EuPage, data);
		expect(out).toContain(t('gl', 'vec.eu.entrar'));
		expect(out).toContain('/ribadavila/legal/aviso-legal');
		expect(out).toContain('/ribadavila/legal/privacidade');
		expect(out).toContain('/ribadavila/legal/normas');
		expect(out).not.toContain('/auth/logout');
	});

	it('con sesión e tres semanas seguidas: streak 3, favorito e texto da racha', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-11-24', '09:00', 'attended');
		await book(db, f, '2026-11-17', '09:00', 'attended');
		await book(db, f, '2026-11-10', '09:00', 'attended');
		const data = await call<
			Promise<{
				summary: { streak: number; bookingsThisYear: number };
				favourite: { mascot: string };
			}>
		>(loadEu, ev(db, u));
		expect(data.summary.streak).toBe(3);
		expect(data.summary.bookingsThisYear).toBe(3);
		expect(data.favourite.mascot).toBe('padel');
		const out = html(EuPage, data);
		expect(out).toContain('3 semanas seguidas · Unha máis e acendes a torre');
		expect(out).toContain('/auth/logout');
		expect(out).toContain('Nerea Veciña');
		expect(out).toContain('Empadroamento: ');
		expect(out).not.toMatch(/Empadroamento: [a-z]+\s*·/);
		expect(out).not.toContain('· Ribadávila');
	});

	it('baixo os focos explica a racha nun <details> (gl e es)', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-11-24', '09:00', 'attended');
		const data = await call<Promise<{ summary: object }>>(loadEu, ev(db, u));
		const out = html(EuPage, data);
		expect(out).toMatch(/<details[\s>]/);
		expect(out).toContain(
			'Semanas seguidas nas que fuches polo menos unha vez. Cancelar a tempo non a rompe; non presentarte si.'
		);
		const es = html(EuPage, { ...data, locale: 'es' });
		expect(es).toContain('Cancelar a tiempo no la rompe; no presentarte, sí.');
	});

	it('racha 0 e racha 4 usan o seu texto; a penalización móstrase con data', async () => {
		const { db, u } = await fresh();
		const data = await call<Promise<{ summary: object }>>(loadEu, ev(db, u));
		expect(html(EuPage, data)).toContain('Reserva esta semana para acender o primeiro foco');
		const four = {
			...data,
			summary: { ...data.summary, streak: 5, penaltyUntil: new Date('2026-12-01T00:00:00Z') }
		};
		const real = Intl.DateTimeFormat;
		Intl.DateTimeFormat = (() => {
			throw new Error('Intl non debe usarse');
		}) as never;
		try {
			const out = html(EuPage, four);
			expect(out).toContain('Torre acesa! 5 semanas seguidas');
			expect(out).toContain('1 de decembro');
			expect(out).not.toMatch(/diciembre/);
		} finally {
			Intl.DateTimeFormat = real;
		}
	});
});

type Hist = {
	months: { month: string; items: { id: string; state: string }[] }[];
	filters: { mes: string | null; estado: string | null };
	monthOptions: string[];
	counts: Record<string, number>;
};

const historial = (db: Db, u: SessionUser, query = '') =>
	call<Promise<Hist>>(loadHistorial, {
		...ev(db, u),
		url: new URL(`http://localhost/ribadavila/eu/historial${query}`)
	});

describe('historial', () => {
	it('sen filtros: próximas, feitas, non fuches e canceladas, agrupadas por mes local', async () => {
		const { db, f, u } = await fresh();
		const proxima = await book(db, f, '2026-11-26', '10:00', 'confirmed');
		const feita = await book(db, f, '2026-11-20', '10:00', 'attended');
		// Confirmada que xa pasou sen marcar: conta como feita (igual que a racha).
		const pasada = await book(db, f, '2026-11-18', '10:00', 'confirmed');
		const nonFuches = await book(db, f, '2026-10-30', '10:00', 'no_show');
		const cancelada = await book(db, f, '2026-12-03', '10:00', 'cancelled');
		const data = await historial(db, u);
		expect(data.months.map((m) => m.month)).toEqual(['2026-12', '2026-11', '2026-10']);
		const states = Object.fromEntries(
			data.months.flatMap((m) => m.items.map((i) => [i.id, i.state]))
		);
		expect(states).toEqual({
			[proxima]: 'proxima',
			[feita]: 'feita',
			[pasada]: 'feita',
			[nonFuches]: 'non_fuches',
			[cancelada]: 'cancelada'
		});
		expect(data.counts).toEqual({ todas: 5, proxima: 1, feita: 2, non_fuches: 1, cancelada: 1 });
		expect(data.monthOptions).toEqual(['2026-12', '2026-11', '2026-10']);
		const out = html(HistorialPage, data);
		for (const label of ['Próxima', 'Feita', 'Non fuches', 'Cancelada', 'Todos os meses'])
			expect(out).toContain(label);
		expect(out).toMatch(/novembro/i);
		expect(out).toMatch(/decembro/i);
		// Os filtros son ligazóns (sen JS) e cada fila abre o detalle.
		expect(out).toContain('href="/ribadavila/eu/historial?estado=cancelada"');
		expect(out).toContain('href="/ribadavila/eu/historial?mes=2026-10"');
		expect(out).toContain(`href="/ribadavila/reserva/${feita}"`);
	});

	it('estado=cancelada dá só as canceladas e mes=2026-09 só setembro', async () => {
		const { db, f, u } = await fresh();
		const sep = await book(db, f, '2026-09-15', '10:00', 'attended');
		const sepCan = await book(db, f, '2026-09-20', '10:00', 'cancelled');
		const nov = await book(db, f, '2026-11-12', '10:00', 'cancelled');
		await book(db, f, '2026-11-13', '10:00', 'attended');
		await book(db, f, '2026-10-01', '10:00', 'no_show');

		const can = await historial(db, u, '?estado=cancelada');
		expect(can.filters.estado).toBe('cancelada');
		expect(can.months.flatMap((m) => m.items.map((i) => i.id))).toEqual([nov, sepCan]);

		const set = await historial(db, u, '?mes=2026-09');
		expect(set.filters.mes).toBe('2026-09');
		expect(set.months.map((m) => m.month)).toEqual(['2026-09']);
		expect(set.months[0].items.map((i) => i.id)).toEqual([sepCan, sep]);
		// Os contadores do estado son os do mes escollido.
		expect(set.counts).toEqual({ todas: 2, proxima: 0, feita: 1, non_fuches: 0, cancelada: 1 });

		const both = await historial(db, u, '?mes=2026-09&estado=cancelada');
		expect(both.months.flatMap((m) => m.items.map((i) => i.id))).toEqual([sepCan]);
		const out = html(HistorialPage, both);
		expect(out).toMatch(/setembro/i);
		expect(out).not.toMatch(/septiembre/i);
	});

	it('o filtro de mes usa o día local: 00:30 do 1 de decembro é decembro', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-12-01', '00:30', 'confirmed');
		expect((await historial(db, u, '?mes=2026-11')).months).toEqual([]);
		const dec = await historial(db, u, '?mes=2026-12');
		expect(dec.months[0].items.map((i) => i.id)).toEqual([id]);
	});

	it('unha reserva en curso é próxima, non feita; a que xa rematou é feita', async () => {
		const { db, f, u } = await fresh();
		// NOW son as 10:00: 09:30–10:30 está en curso, 08:00–09:00 xa rematou.
		const enCurso = await book(db, f, '2026-11-25', '09:30', 'confirmed');
		const rematada = await book(db, f, '2026-11-25', '08:00', 'confirmed');
		const todas = await historial(db, u);
		const states = Object.fromEntries(
			todas.months.flatMap((m) => m.items.map((i) => [i.id, i.state]))
		);
		expect(states).toEqual({ [enCurso]: 'proxima', [rematada]: 'feita' });
		const prox = await historial(db, u, '?estado=proxima');
		expect(prox.months.flatMap((m) => m.items.map((i) => i.id))).toEqual([enCurso]);
		const feita = await historial(db, u, '?estado=feita');
		expect(feita.months.flatMap((m) => m.items.map((i) => i.id))).toEqual([rematada]);
	});

	it('mes ou estado inválidos ignóranse sen erro', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-11-20', '10:00', 'attended');
		const data = await historial(db, u, '?mes=2026-99&estado=xx');
		expect(data.filters).toEqual({ mes: null, estado: null });
		expect(data.months).toHaveLength(1);
	});

	it('meses en galego e castelán sen Intl', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-10-20', '10:00', 'attended');
		const data = await historial(db, u);
		const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
			throw new Error('sen Intl');
		});
		try {
			expect(html(HistorialPage, data)).toMatch(/outubro 2026/i);
			expect(
				render(HistorialPage, { props: { data: { ...layout, ...data, locale: 'es' } } as never })
					.body
			).toMatch(/octubre 2026/i);
		} finally {
			spy.mockRestore();
		}
	});

	it('sen sesión redirixe a Entrar', async () => {
		const { db } = await fresh();
		const r = await outcome(() => call(loadHistorial, ev(db, null)));
		expect(isRedirect(r.thrown)).toBe(true);
	});
});

describe('datos', () => {
	const post = (db: Db, u: SessionUser, fields: Record<string, string>) => {
		const event = ev(db, u, { method: 'POST' });
		(event as { request: Request }).request = new Request(event.url, {
			method: 'POST',
			body: new URLSearchParams(fields)
		});
		return event;
	};

	it('un correo non válido dá fail(400) con issues en email', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() =>
			call(datosActions.gardar, post(db, u, { email: 'nope', phone: '' }))
		);
		expect(isActionFailure(r.value)).toBe(true);
		const failure = r.value as { status: number; data: { issues: { email?: boolean } } };
		expect(failure.status).toBe(400);
		expect(failure.data.issues.email).toBe(true);
		const out = html(
			DatosPage,
			{ displayName: 'Nerea', provider: 'clave', email: '', phone: '' },
			failure.data
		);
		expect(out).toContain('Escribe un correo válido');
	});

	it('borrar a conta sen escribir BORRAR dá fail(400)', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() => call(datosActions.borrar, post(db, u, { confirmacion: 'non' })));
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(400);
	});

	it('borrar a conta con BORRAR anonimiza e redirixe ao inicio con aviso', async () => {
		const { db, f, u } = await fresh();
		const r = await outcome(() =>
			call(datosActions.borrar, post(db, u, { confirmacion: 'BORRAR' }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect((r.thrown as { location: string }).location).toContain('conta-eliminada=1');
		const [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.displayName).toBe('Conta eliminada');
	});

	it('un correo válido persiste e redirixe con aviso', async () => {
		const { db, f, u } = await fresh();
		const r = await outcome(() =>
			call(datosActions.gardar, post(db, u, { email: 'uxia@exemplo.gal', phone: '600 000 000' }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect((r.thrown as { location: string }).location).toContain('gardado=1');
		const [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.email).toBe('uxia@exemplo.gal');
		expect(row.phone).toBe('600 000 000');
		const data = await call<
			Promise<{
				saved: boolean;
				email: string;
				displayName: string;
				provider: string;
				phone: string;
			}>
		>(loadDatos, ev(db, u, { url: 'http://localhost/ribadavila/eu/datos?gardado=1' }));
		expect(data.email).toBe('uxia@exemplo.gal');
		expect(html(DatosPage, data)).toContain('Gardado');
	});
});

describe('legal', () => {
	async function withText(text: string) {
		const { db, f } = await fresh();
		await db
			.update(municipalities)
			.set({ legalNotice: text })
			.where(eq(municipalities.id, f.municipalityId));
		return db;
	}
	const evDoc = (db: Db, doc: string) =>
		ev(db, null, {
			params: { slug: 'ribadavila', doc },
			url: `http://localhost/ribadavila/legal/${doc}`
		});

	it('un texto con <script> sae escapado', async () => {
		const db = await withText('Ola\n<script>alert(1)</script>');
		const data = await call<Promise<{ doc: string; text: string }>>(
			loadLegal,
			evDoc(db, 'aviso-legal')
		);
		expect(typeof data.text).toBe('string');
		const out = html(LegalPage, data);
		expect(out).toContain('&lt;script>alert(1)&lt;/script>');
		expect(out).not.toContain('<script>alert');
	});

	it('baleiro: mensaxe do concello; doc descoñecido: 404', async () => {
		const db = await withText('');
		const data = await call<Promise<{ doc: string; text: string }>>(loadLegal, evDoc(db, 'normas'));
		expect(html(LegalPage, data)).toContain('O concello aínda non publicou este texto');
		const r = await outcome(() => call(loadLegal, evDoc(db, 'otro')));
		expect(isHttpError(r.thrown, 404)).toBe(true);
	});
});

// ---------------------------------------------------------------------------------------------
// Eu v1 (tarefa 8 de v1): os meus concellos, o meu perfil (avatar) e avisos
// ---------------------------------------------------------------------------------------------

function postForm(db: Db, u: SessionUser, path: string, body: FormData) {
	const event = ev(db, u, { method: 'POST', url: `http://localhost/ribadavila${path}` });
	(event as { request: Request }).request = new Request(event.url, { method: 'POST', body });
	return event;
}

const formOf = (fields: Record<string, string | string[]>) => {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields))
		for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
	return body;
};

describe('Eu v1', () => {
	it('Eu enlaza os meus concellos, o meu perfil e avisos e amosa o avatar', async () => {
		const { db, f, u } = await fresh();
		await db.update(users).set({ avatarKey: 'deporte-padel' }).where(eq(users.id, f.userId));
		const data = await call<Promise<object>>(loadEu, ev(db, u));
		const out = html(EuPage, data);
		expect(out).toContain('href="/ribadavila/eu/concellos"');
		expect(out).toContain('href="/ribadavila/eu/perfil"');
		expect(out).toContain('href="/ribadavila/eu/avisos"');
		expect(out).toContain('Nerea Veciña: Pala de pádel');
	});

	it('os meus concellos: non deixa saír con reserva futura e conserva o historial ao saír', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-27', '10:00', 'confirmed');
		const data = await call<Promise<{ municipalities: { slug: string; checked: boolean }[] }>>(
			loadConcellos,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/concellos' })
		);
		expect(data.municipalities.find((m) => m.slug === 'ribadavila')?.checked).toBe(true);
		expect(html(ConcellosPage, data)).toContain('Deixar este concello');

		// Non pode ocultar unha reserva futura ao deixar o concello.
		const r = await outcome(() =>
			call(
				concellosActions.seguir,
				postForm(db, u, '/eu/concellos', formOf({ concello: f.otherMunicipalityId }))
			)
		);
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { data: { deixarErro: string } }).data.deixarErro).toBe('FUTURE_BOOKINGS');
		await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id));
		const left = await outcome(() =>
			call(
				concellosActions.deixar,
				postForm(db, u, '/eu/concellos', formOf({ concello: f.municipalityId }))
			)
		);
		expect(isRedirect(left.thrown)).toBe(true);
		const after = await call<Promise<{ municipalities: { slug: string; checked: boolean }[] }>>(
			loadConcellos,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/concellos' })
		);
		expect(after.municipalities.find((m) => m.slug === 'ribadavila')?.checked).toBe(false);
		const historial = await call<Promise<{ months: { items: { id: string }[] }[] }>>(
			loadHistorial,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/historial' })
		);
		expect(historial.months.flatMap((month) => month.items.map((item) => item.id))).toContain(id);
	});

	it('unirse engade o concello ao selector e aplica o prezo non empadroado', async () => {
		const { db, f, u } = await fresh();
		const joined = await outcome(() =>
			call(
				concellosActions.unirse,
				postForm(db, u, '/eu/concellos', formOf({ concello: f.otherMunicipalityId }))
			)
		);
		expect(isRedirect(joined.thrown)).toBe(true);
		const shell = await call<
			Promise<{
				followed: { slug: string }[];
				user: { id: string; initial: string; displayName: string };
			}>
		>(loadSlugLayout, ev(db, u, { url: 'http://localhost/ribadavila/eu' }));
		expect(shell.followed.map((m) => m.slug)).toEqual(['montemaior-do-rio', 'ribadavila']);
		const header = render(AppHeader, {
			props: {
				municipality: {
					slug: 'ribadavila',
					name: 'Ribadávila',
					primaryColor: '#000',
					hasLogo: false,
					logoVersion: 0
				},
				municipalities: shell.followed as never,
				user: shell.user as never,
				locale: 'gl',
				current: '/ribadavila'
			}
		}).body;
		expect(header).toContain('href="/montemaior-do-rio"');
		const startsAt = localDateTimeToUtc('2026-11-26', '10:00').toISOString();
		const confirmation = await call<Promise<{ resident: boolean; priceCents: number }>>(
			loadConfirmar,
			makeEvent({
				db,
				now: NOW,
				user: u,
				params: { slug: 'montemaior-do-rio' },
				url: `http://localhost/montemaior-do-rio/confirmar?facility=${f.otherFacilityId}&startsAt=${encodeURIComponent(startsAt)}`
			})
		);
		expect(confirmation).toMatchObject({ resident: false, priceCents: 600 });
	});

	it('os meus concellos sen ningún dá fail(400)', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() =>
			call(concellosActions.seguir, postForm(db, u, '/eu/concellos', formOf({})))
		);
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(400);
	});

	it('seguir cun UUID descoñecido non cambia os concellos seguidos', async () => {
		const { db, f, u } = await fresh();
		const before = await call<Promise<{ municipalities: { id: string; checked: boolean }[] }>>(
			loadConcellos,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/concellos' })
		);
		const r = await outcome(() =>
			call(
				concellosActions.seguir,
				postForm(
					db,
					u,
					'/eu/concellos',
					formOf({
						concello: [f.otherMunicipalityId, '00000000-0000-4000-8000-000000000000']
					})
				)
			)
		);
		expect(isActionFailure(r.value)).toBe(true);
		const after = await call<Promise<{ municipalities: { id: string; checked: boolean }[] }>>(
			loadConcellos,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/concellos' })
		);
		expect(after.municipalities.map(({ id, checked }) => ({ id, checked }))).toEqual(
			before.municipalities.map(({ id, checked }) => ({ id, checked }))
		);
	});

	it('declarar o empadroamento: «pendente de comprobar» e o prezo segue sendo o de non empadroado', async () => {
		const { db, f, u } = await fresh();
		const r = await outcome(() =>
			call(
				concellosActions.declarar,
				postForm(db, u, '/eu/concellos', formOf({ concello: f.municipalityId }))
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		const data = await call<Promise<object>>(
			loadConcellos,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/concellos' })
		);
		expect(html(ConcellosPage, data)).toContain('pendente de comprobar');
		const eu = await call<Promise<object>>(loadEu, ev(db, u));
		expect(html(EuPage, eu)).toContain('pendente de comprobar');
		const startsAt = localDateTimeToUtc('2026-11-26', '10:00').toISOString();
		const conf = await call<Promise<{ resident: boolean | null }>>(
			loadConfirmar,
			ev(db, u, {
				url: `http://localhost/ribadavila/confirmar?facility=${f.facilityId}&startsAt=${encodeURIComponent(startsAt)}`
			})
		);
		expect(conf.resident).toBe(false);
	});

	it('o meu perfil: o POST garda o debuxo e a cabeceira amósao', async () => {
		const { db, f, u } = await fresh();
		const data = await call<Promise<{ tab: string }>>(
			loadPerfil,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/perfil?tab=deportes' })
		);
		expect(data.tab).toBe('deportes');
		expect(html(PerfilPage, data)).toContain('value="deporte-tenis"');
		const r = await outcome(() =>
			call(perfilActions.avatar, postForm(db, u, '/eu/perfil', formOf({ avatar: 'deporte-tenis' })))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		const [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.avatarKey).toBe('deporte-tenis');

		const shell = await call<Promise<{ user: object }>>(
			loadSlugLayout,
			ev(db, u, { url: 'http://localhost/ribadavila/eu' })
		);
		const header = render(AppHeader, {
			props: {
				municipality: {
					slug: 'ribadavila',
					name: 'Ribadávila',
					primaryColor: '#000',
					hasLogo: false,
					logoVersion: 0
				},
				user: shell.user as never,
				locale: 'gl',
				current: '/ribadavila/eu'
			}
		}).body;
		expect(header).toContain('src="/api/v1/avatars/deporte-tenis"');
	});

	it('o meu perfil: accesibilidade garda a reserva fácil', async () => {
		const { db, f, u } = await fresh();
		const r = await outcome(() =>
			call(
				perfilActions.accesibilidade,
				postForm(
					db,
					u,
					'/eu/perfil',
					formOf({ textSize: 'normal', reduceMotion: 'system', easyBooking: 'on' })
				)
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		const [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.easyBooking).toBe(true);
	});

	it('o meu perfil: con foto, escoller un debuxo ou «sen avatar» borra a foto e vese o debuxo', async () => {
		const { db, f, u } = await fresh();
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
		const body = new FormData();
		body.set('foto', new File([png], 'eu.png', { type: 'image/png' }));
		await outcome(() => call(perfilActions.foto, postForm(db, u, '/eu/perfil', body)));
		const [withPhoto] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(withPhoto.avatarMime).toBe('image/png');

		await outcome(() =>
			call(perfilActions.avatar, postForm(db, u, '/eu/perfil', formOf({ avatar: 'deporte-padel' })))
		);
		const [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.avatarKey).toBe('deporte-padel');
		expect(row.avatarPhoto).toBeNull();
		expect(row.avatarMime).toBeNull();

		const shell = await call<Promise<{ user: object }>>(
			loadSlugLayout,
			ev(db, u, { url: 'http://localhost/ribadavila/eu' })
		);
		const header = render(AppHeader, {
			props: {
				municipality: {
					slug: 'ribadavila',
					name: 'Ribadávila',
					primaryColor: '#000',
					hasLogo: false,
					logoVersion: 0
				},
				user: shell.user as never,
				locale: 'gl',
				current: '/ribadavila/eu'
			}
		}).body;
		expect(header).toContain('src="/api/v1/avatars/deporte-padel"');
		expect(header).not.toContain(`/api/v1/users/${f.userId}/avatar`);
		const eu = html(EuPage, await call<Promise<object>>(loadEu, ev(db, u)));
		expect(eu).toContain('Nerea Veciña: Pala de pádel');
		expect(eu).not.toContain(`/api/v1/users/${f.userId}/avatar`);

		// «Sen avatar» (a inicial) tamén borra unha foto subida despois.
		await outcome(() => call(perfilActions.foto, postForm(db, u, '/eu/perfil', body)));
		await outcome(() =>
			call(perfilActions.avatar, postForm(db, u, '/eu/perfil', formOf({ avatar: '' })))
		);
		const [none] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(none.avatarKey).toBeNull();
		expect(none.avatarPhoto).toBeNull();
	});

	it('o meu perfil: unha foto grande dá PHOTO_TOO_LARGE como erro do campo', async () => {
		const { db, u } = await fresh();
		const big = new Uint8Array(300_000);
		big.set([0x89, 0x50, 0x4e, 0x47]);
		const body = new FormData();
		body.set('foto', new File([big], 'big.png', { type: 'image/png' }));
		const r = await outcome(() => call(perfilActions.foto, postForm(db, u, '/eu/perfil', body)));
		expect(isActionFailure(r.value)).toBe(true);
		const failure = r.value as { data: { foto: string } };
		expect(failure.data.foto).toBe('PHOTO_TOO_LARGE');
		const data = await call<Promise<object>>(
			loadPerfil,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/perfil?tab=foto' })
		);
		const out = html(PerfilPage, data, failure.data);
		expect(out).toContain('enctype="multipart/form-data"');
		expect(out).toContain('action="?/foto&amp;tab=foto"');
		expect(out).toContain('256 KB');
	});

	it('avisos: correo sen consentimento dá 400; apagalo borra o consentimento', async () => {
		const { db, f, u } = await fresh();
		const sen = await outcome(() =>
			call(
				avisosActions.default,
				postForm(db, u, '/eu/avisos', formOf({ avisos: 'correo', email: 'uxia@exemplo.gal' }))
			)
		);
		expect(isActionFailure(sen.value)).toBe(true);
		const con = await outcome(() =>
			call(
				avisosActions.default,
				postForm(
					db,
					u,
					'/eu/avisos',
					formOf({ avisos: 'correo', email: 'uxia@exemplo.gal', consentimento: 'si' })
				)
			)
		);
		expect(isRedirect(con.thrown)).toBe(true);
		let [row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.notifyEmail).toBe(true);
		expect(row.notifyConsentAt).not.toBeNull();
		const data = await call<Promise<object>>(
			loadAvisosPrefs,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/avisos' })
		);
		expect(html(AvisosPrefsPage, data)).toContain('value="uxia@exemplo.gal"');

		await call(
			avisosActions.default,
			postForm(db, u, '/eu/avisos', formOf({ avisos: 'app' }))
		).catch(() => {});
		[row] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(row.notifyEmail).toBe(false);
		expect(row.notifyConsentAt).toBeNull();
	});

	it('avisos: tras un erro, o correo e a caixa volven co enviado', async () => {
		const { db, u } = await fresh();
		const r = await outcome(() =>
			call(
				avisosActions.default,
				postForm(
					db,
					u,
					'/eu/avisos',
					formOf({ avisos: 'correo', email: 'mal', consentimento: 'si' })
				)
			)
		);
		const failure = r.value as { data: object };
		const data = await call<Promise<object>>(
			loadAvisosPrefs,
			ev(db, u, { url: 'http://localhost/ribadavila/eu/avisos' })
		);
		const out = html(AvisosPrefsPage, data, failure.data);
		expect(out).toContain('value="mal"');
		expect(out).toMatch(/name="consentimento" value="si" checked/);
	});

	it('SvelteKit non admite a acción default xunto con accións con nome', () => {
		for (const a of [concellosActions, perfilActions, avisosActions]) {
			const names = Object.keys(a);
			expect(names.includes('default') && names.length > 1, names.join()).toBe(false);
		}
	});

	it('as subpáxinas sen sesión redirixen a Entrar', async () => {
		const { db } = await fresh();
		for (const l of [loadConcellos, loadPerfil, loadAvisosPrefs]) {
			const r = await outcome(() => call(l, ev(db, null)));
			expect(isRedirect(r.thrown)).toBe(true);
		}
	});
});
