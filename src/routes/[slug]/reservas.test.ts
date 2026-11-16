// SPDX-License-Identifier: EUPL-1.2
// As miñas reservas (tarea 7; v1 tarefa 6): lista, calendario, detalle, cancelar, cambiar e QR.
import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { bookings, municipalities, municipalityProfiles, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../lib/server/services/fixtures';
import Detalle from './reserva/[id]/+page.svelte';
import Qr from '../../lib/ui/Qr.svelte';
import Fob from '../../lib/ui/Fob.svelte';
import {
	actions as cambiarActions,
	load as loadCambiar
} from './reserva/[id]/cambiar/+page.server';
import {
	actions as cancelarActions,
	load as loadCancelar
} from './reserva/[id]/cancelar/+page.server';
import { load as loadDetalle } from './reserva/[id]/+page.server';
import { load as loadReservas } from './reservas/+page.server';
import ReservasPage from './reservas/+page.svelte';
import { qrPayload, signBookingQr } from '../../lib/server/domain/booking-qr';
import { bookingQrSecret } from '../../lib/server/auth/booking-qr-secret';

// Clave dos QR: sen AUTH_SECRET non se emiten (Ruling 2), así que aquí se fixa unha.
vi.mock('$app/env/private', () => ({
	OIDC_SCOPES: undefined,
	OIDC_SUBJECT_CLAIM: undefined,
	OIDC_CLAVE_ISSUER: undefined,
	OIDC_CLAVE_CLIENT_ID: undefined,
	OIDC_CLAVE_CLIENT_SECRET: undefined,
	OIDC_CHAVE365_ISSUER: undefined,
	OIDC_CHAVE365_CLIENT_ID: undefined,
	OIDC_CHAVE365_CLIENT_SECRET: undefined,
	DATABASE_URL: 'postgres://x',
	IDENTITY_MODE: undefined,
	AUTH_SECRET: 'k'.repeat(40),
	PUBLIC_ORIGIN: undefined
}));

// Martes 24 nov 2026, 08:00 en Madrid.
const NOW = new Date('2026-11-24T08:00:00+01:00');
const DATE = '2026-11-24';

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

type Row = { id: string; status: string };

/** Reserva insertada a mano para la persona del fixture (o la que se diga). */
async function book(
	db: Db,
	f: Fixture,
	date: string,
	hhmm: string,
	extra: {
		status?: 'confirmed' | 'cancelled' | 'attended' | 'no_show';
		profileId?: string;
		code?: string;
		minutes?: number;
	} = {}
): Promise<string> {
	const startsAt = localDateTimeToUtc(date, hhmm);
	const [row] = await db
		.insert(bookings)
		.values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: extra.profileId ?? f.profileId,
			seats: 1,
			startsAt,
			endsAt: new Date(startsAt.getTime() + (extra.minutes ?? 60) * 60_000),
			accessCode: extra.code ?? '482193',
			priceCents: 600,
			status: extra.status ?? 'confirmed',
			channel: 'online',
			createdByUserId: f.userId
		})
		.returning();
	return row.id;
}

const ev = (db: Db, f: Fixture, user: SessionUser | null, id?: string, extra = {}) =>
	makeEvent({
		db,
		now: NOW,
		user,
		params: id ? { slug: 'ribadavila', id } : { slug: 'ribadavila' },
		url: `http://localhost/ribadavila/reserva/${id ?? ''}`,
		...extra
	});

/** Evento POST con un formulario `application/x-www-form-urlencoded`. */
function form(db: Db, user: SessionUser, id: string, fields: Record<string, string>) {
	const event = ev(db, undefined as never, user, id, { method: 'POST' });
	(event as { request: Request }).request = new Request(event.url, {
		method: 'POST',
		body: new URLSearchParams(fields)
	});
	return event;
}

async function fresh() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	return { db, f, u: { id: f.userId, displayName: 'Nerea Veciña' } as SessionUser };
}

type Item = { id: string; code: string; qr: string | null; date: string };
type ListData = {
	needsLogin: boolean;
	vista: 'lista' | 'calendario';
	groups: { key: string; items: Item[] }[];
	calendar: {
		month: string;
		prev: string | null;
		next: string;
		selected: string | null;
		days: Record<string, { mascot: string; color: string }[]>;
		agenda: Item[];
	} | null;
};

/** Load de «As miñas reservas» coa query que se diga. */
const lista = (db: Db, f: Fixture, u: SessionUser | null, query = '') =>
	call<Promise<ListData>>(loadReservas, {
		...ev(db, f, u),
		url: new URL(`http://localhost/ribadavila/reservas${query}`)
	});

const layoutData = {
	locale: 'gl',
	municipality: { slug: 'ribadavila', name: 'Ribadávila', primaryColor: '#1d4ed8', hasLogo: false }
};
const page = (data: object) =>
	render(ReservasPage, { props: { data: { ...layoutData, ...data } } as never }).body;

describe('lista', () => {
	it('sen sesión: needsLogin', async () => {
		const { db, f } = await fresh();
		const out = await lista(db, f, null);
		expect(out.needsLogin).toBe(true);
	});

	it('agrupa en hoxe, esta semana e máis adiante polo día local; sen canceladas', async () => {
		const { db, f, u } = await fresh();
		// Empezou ás 07:30 e remata ás 08:30: aínda está en curso, segue na lista.
		const enCurso = await book(db, f, DATE, '07:30');
		const hoxe = await book(db, f, DATE, '19:00');
		const mana = await book(db, f, '2026-11-25', '10:00');
		await book(db, f, DATE, '20:00', { status: 'cancelled' });
		// 23:30 UTC do 24 xa é o 25 en Madrid: vai á semana, non a hoxe.
		const tarde = await book(db, f, '2026-11-25', '00:30');
		const domingo = await book(db, f, '2026-11-29', '11:00');
		const luns = await book(db, f, '2026-11-30', '11:00');
		const out = await lista(db, f, u);
		expect(out.needsLogin).toBe(false);
		expect(out.vista).toBe('lista');
		expect(out.groups.map((g) => [g.key, g.items.map((b) => b.id)])).toEqual([
			['hoxe', [enCurso, hoxe]],
			['semana', [tarde, mana, domingo]],
			['adiante', [luns]]
		]);
	});

	it('ensina o PIN de cada reserva próxima e un QR pequeno', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, DATE, '19:00', { code: '4821' });
		await book(db, f, '2026-11-27', '11:00', { code: '7350' });
		await book(db, f, '2026-12-09', '18:00', { code: '2207' });
		const data = await lista(db, f, u);
		const body = page(data);
		for (const pin of ['4821', '7350', '2207']) expect(body).toContain(pin);
		// O QR pequeno da lista é decorativo (o grande está no detalle): oculto e sen role.
		const qrs = body.match(/<svg[^>]*shape-rendering="crispEdges"[^>]*>/g) ?? [];
		expect(qrs).toHaveLength(3);
		for (const q of qrs) {
			expect(q).toContain('aria-hidden="true"');
			expect(q).not.toContain('role=');
		}
		expect(body).toContain('Esta semana');
		expect(body).toContain('Máis adiante');
		// O cambio Lista | Calendario son ligazóns: van sen JS.
		expect(body).toContain('href="/ribadavila/reservas?vista=calendario"');
	});

	it('vista ou mes inválidos volven á lista e ao mes actual sen erro', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-11-25', '10:00');
		const raro = await lista(db, f, u, '?vista=xx&mes=2026-13');
		expect(raro.vista).toBe('lista');
		const cal = await lista(db, f, u, '?vista=calendario&mes=abc&dia=2026-02-31');
		expect(cal.vista).toBe('calendario');
		expect(cal.calendar?.month).toBe('2026-11');
		// Un mes pasado tampouco: o pasado está no historial.
		// Un `dia` doutro mes ou xa pasado tampouco vale: vai ao día da próxima reserva.
		const fora = await lista(db, f, u, '?vista=calendario&mes=2026-11&dia=2026-12-03');
		expect(fora.calendar?.selected).toBe('2026-11-25');
		const pasado = await lista(db, f, u, '?vista=calendario&mes=2026-11&dia=2026-11-20');
		expect(pasado.calendar?.selected).toBe('2026-11-25');
		const vello = await lista(db, f, u, '?vista=calendario&mes=2026-09');
		expect(vello.calendar?.month).toBe('2026-11');
		expect(vello.calendar?.prev).toBeNull();
	});
});

describe('calendario', () => {
	it('marca os días con reservas do mes actual e `dia` dá a axenda dese día', async () => {
		const { db, f, u } = await fresh();
		const a = await book(db, f, '2026-11-27', '18:00', { code: '2207' });
		const b = await book(db, f, '2026-11-27', '20:00', { code: '1946' });
		const c = await book(db, f, '2026-11-29', '11:00', { code: '7350' });
		await book(db, f, '2026-12-03', '11:00');
		await book(db, f, '2026-11-28', '11:00', { status: 'cancelled' });
		const def = await lista(db, f, u, '?vista=calendario');
		expect(def.calendar?.month).toBe('2026-11');
		expect(Object.keys(def.calendar?.days ?? {}).sort()).toEqual(['2026-11-27', '2026-11-29']);
		expect(def.calendar?.days['2026-11-27']).toHaveLength(2);
		// Sen `dia`, a axenda ensina o día da próxima reserva.
		expect(def.calendar?.selected).toBe('2026-11-27');
		expect(def.calendar?.agenda.map((x) => x.id)).toEqual([a, b]);
		expect(def.calendar?.next).toBe('2026-12');

		const dia = await lista(db, f, u, '?vista=calendario&mes=2026-11&dia=2026-11-29');
		expect(dia.calendar?.selected).toBe('2026-11-29');
		expect(dia.calendar?.agenda.map((x) => x.id)).toEqual([c]);

		const body = page(dia);
		expect(body).toMatch(/novembro 2026/i);
		expect(body).toContain('7350');
		expect(body).toContain(
			'href="/ribadavila/reservas?vista=calendario&amp;mes=2026-11&amp;dia=2026-11-27"'
		);
		// O selo do día 27 é a mascota da súa reserva; un día sen reservas non ten selo.
		const day = (d: string) =>
			new RegExp(`<a[^>]*dia=${d}"[^>]*>[\\s\\S]*?</a>`).exec(body)?.[0] ?? '';
		expect(day('2026-11-27')).toContain('href="#d-padel"');
		expect(day('2026-11-26')).not.toBe('');
		expect(day('2026-11-26')).not.toContain('href="#d-');
		// O día escollido leva aria-current="true"; hoxe dío no nome.
		expect(day('2026-11-29')).toContain('aria-current="true"');
		expect(day('2026-11-24')).toMatch(/aria-label="Hoxe, 24 de novembro/);
		expect(body).not.toMatch(/noviembre/i);

		// Un día libre di que está libre e ofrece reservar.
		const libre = await lista(db, f, u, '?vista=calendario&mes=2026-11&dia=2026-11-26');
		expect(libre.calendar?.agenda).toEqual([]);
		expect(page(libre)).toContain('Libre. Queres reservar algo?');
	});

	it('sen `dia`, o día por defecto é o primeiro con reservas desde hoxe', async () => {
		const { db, f, u } = await fresh();
		// Empezou onte ás 23:30 e remata hoxe ás 08:30: segue en curso, pero o seu día xa pasou.
		await book(db, f, '2026-11-23', '23:30', { minutes: 540 });
		await book(db, f, '2026-11-26', '10:00');
		const out = await lista(db, f, u, '?vista=calendario');
		expect(out.calendar?.selected).toBe('2026-11-26');
	});

	it('unha reserva ás 00:30 locais do día 1 sae no día 1, non no último do mes anterior', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-12-01', '00:30');
		const nov = await lista(db, f, u, '?vista=calendario&mes=2026-11');
		expect(nov.calendar?.days['2026-11-30']).toBeUndefined();
		const dec = await lista(db, f, u, '?vista=calendario&mes=2026-12');
		expect(dec.calendar?.days['2026-12-01']).toHaveLength(1);
		expect(dec.calendar?.selected).toBe('2026-12-01');
		expect(dec.calendar?.agenda.map((x) => x.id)).toEqual([id]);
		expect(dec.calendar?.prev).toBe('2026-11');
	});

	it('os nomes dos meses non dependen de Intl', async () => {
		const { db, f, u } = await fresh();
		await book(db, f, '2026-12-02', '10:00');
		const data = await lista(db, f, u, '?vista=calendario&mes=2026-12');
		const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
			throw new Error('sen Intl');
		});
		try {
			expect(page(data)).toMatch(/decembro 2026/i);
			expect(
				render(ReservasPage, {
					props: { data: { ...layoutData, ...data, locale: 'es' } } as never
				}).body
			).toMatch(/diciembre 2026/i);
		} finally {
			spy.mockRestore();
		}
	});
});

describe('detalle', () => {
	it('a reserva doutra persoa dá 404; a propia devolve o código', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const [other] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'det-outra', displayName: 'Antía Outra' })
			.returning();
		await db
			.insert(municipalityProfiles)
			.values({ municipalityId: f.municipalityId, userId: other.id, isResident: true });
		const foreign = await outcome(() =>
			call(loadDetalle, ev(db, f, { id: other.id, displayName: 'Antía' }, id))
		);
		expect(isHttpError(foreign.thrown, 404)).toBe(true);

		const mine = await call<Promise<{ code: string; editable: boolean }>>(
			loadDetalle,
			ev(db, f, u, id)
		);
		expect(mine.code).toBe('482193');
		expect(mine.editable).toBe(true);
		const qr = (mine as unknown as { qr: string }).qr;
		// URL absoluta co orixe da petición: un lector de mostrador ou unha cámara pode abrila.
		expect(qr.startsWith('http://localhost/ribadavila/conserxeria/validar?qr=')).toBe(true);
		expect(qr).toBe(
			qrPayload('http://localhost', 'ribadavila', signBookingQr(id, bookingQrSecret()!))
		);
	});
});

describe('prazo para cambiar', () => {
	it('fóra de prazo o detalle non ofrece cambiar e o load de cambiar redirixe', async () => {
		const { db, f, u } = await fresh();
		await db
			.update(municipalities)
			.set({ cancellationDeadlineMinutes: 120 })
			.where(eq(municipalities.id, f.municipalityId));
		const id = await book(db, f, DATE, '09:00');
		const out = await call<Promise<{ editable: boolean; inTime: boolean }>>(
			loadDetalle,
			ev(db, f, u, id)
		);
		expect(out.editable).toBe(true);
		expect(out.inTime).toBe(false);
		const r = await outcome(() => call(loadCambiar, ev(db, f, u, id)));
		expect(isRedirect(r.thrown)).toBe(true);
		expect((r.thrown as { location: string }).location).toBe(`/ribadavila/reserva/${id}`);
	});

	it('o detalle dunha reserva cancelada marca o estado e non se pode editar', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00', { status: 'cancelled' });
		const out = await call<Promise<{ status: string; editable: boolean; code: string | null }>>(
			loadDetalle,
			ev(db, f, u, id)
		);
		expect(out.status).toBe('cancelled');
		expect(out.editable).toBe(false);
		expect(out.code).toBeNull();
	});
});

describe('cancelar', () => {
	it('dentro de prazo deixa a reserva cancelled e redirixe a reservas', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const r = await outcome(() => call(cancelarActions.default, form(db, u, id, {})));
		expect(isRedirect(r.thrown)).toBe(true);
		expect((r.thrown as { location: string }).location).toBe('/ribadavila/reservas');
		const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
		expect(row.status).toBe('cancelled');
	});

	it('fóra de prazo (120 min, reserva dentro de 1 h) dá fail(422) e non cancela', async () => {
		const { db, f, u } = await fresh();
		await db
			.update(municipalities)
			.set({ cancellationDeadlineMinutes: 120 })
			.where(eq(municipalities.id, f.municipalityId));
		const id = await book(db, f, DATE, '09:00');
		const r = await outcome(() => call(cancelarActions.default, form(db, u, id, {})));
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(422);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
		expect(row.status).toBe('confirmed');
		const page = await call<Promise<{ inTime: boolean }>>(loadCancelar, ev(db, f, u, id));
		expect(page.inTime).toBe(false);
	});

	it('a reserva doutra persoa dá 404', async () => {
		const { db, f } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const r = await outcome(() =>
			call(cancelarActions.default, form(db, { id: crypto.randomUUID(), displayName: 'x' }, id, {}))
		);
		expect(isHttpError(r.thrown, 404)).toBe(true);
	});
});

describe('cambiar', () => {
	it('o load ofrece horas libres da mesma instalación e a orixinal sae chea', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const out = await call<
			Promise<{ date: string; hours: { time: string; free: boolean }[]; facilityId: string }>
		>(loadCambiar, {
			...ev(db, f, u, id),
			url: new URL(`http://localhost/ribadavila/reserva/${id}/cambiar?date=2026-11-25`)
		});
		expect(out.facilityId).toBe(f.facilityId);
		expect(out.hours.find((h) => h.time === '10:00')?.free).toBe(false);
		expect(out.hours.find((h) => h.time === '11:00')?.free).toBe(true);
	});

	it('a unha hora libre crea unha nova, cancela a orixinal e redirixe ao novo xa', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const r = await outcome(() =>
			call(cambiarActions.default, form(db, u, id, { date: '2026-11-26', time: '12:00' }))
		);
		expect(isRedirect(r.thrown)).toBe(true);
		const location = (r.thrown as { location: string }).location;
		expect(location).toMatch(/^\/ribadavila\/reserva\/[0-9a-f-]{36}\/xa$/);
		const newId = location.split('/')[3];
		expect(newId).not.toBe(id);
		const rows: Row[] = await db.select().from(bookings);
		expect(rows.find((b) => b.id === id)?.status).toBe('cancelled');
		expect(rows.find((b) => b.id === newId)?.status).toBe('confirmed');
	});

	it('a unha hora ocupada dá fail(409) e a orixinal queda intacta', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		await book(db, f, '2026-11-26', '12:00', { profileId: f.residentProfileId });
		const r = await outcome(() =>
			call(cambiarActions.default, form(db, u, id, { date: '2026-11-26', time: '12:00' }))
		);
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(409);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
		expect(row.status).toBe('confirmed');
		expect(await db.select().from(bookings)).toHaveLength(2);
	});
});

describe('cambiar á mesma franxa', () => {
	it('elixir a hora que xa ten dá fail(422) e non toca a reserva', async () => {
		const { db, f, u } = await fresh();
		const id = await book(db, f, '2026-11-25', '10:00');
		const r = await outcome(() =>
			call(cambiarActions.default, form(db, u, id, { date: '2026-11-25', time: '10:00' }))
		);
		expect(isActionFailure(r.value)).toBe(true);
		expect((r.value as { status: number }).status).toBe(422);
		const rows = await db.select().from(bookings);
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('confirmed');
	});
});

describe('Qr', () => {
	it('renderiza un svg con path ou rect', () => {
		const { body } = render(Qr, { props: { value: '482193', label: 'QR' } });
		expect(body).toContain('<svg');
		expect(body).toMatch(/<path|<rect/);
	});

	it('o QR grande do chaveiro leva 4 módulos de marxe; o pequeno, 2', () => {
		const value = 'http://localhost/a/conserxeria/validar?qr=x';
		const side = (h: string) => Number(/viewBox="0 0 (\d+) /.exec(h)?.[1]);
		const small = render(Qr, { props: { value, label: 'QR' } }).body;
		const big = render(Fob, {
			props: { locale: 'gl', code: '4821', size: 'xl', color: '#1d4ed8', qr: value, qrLabel: 'QR' }
		}).body;
		expect(side(big)).toBe(side(small) + 4);
		// O primeiro módulo escuro (esquina do patrón de posición) empeza na columna 4.
		expect(big).toContain('d="M4 4h1v1h-1z');
		expect(small).toContain('d="M2 2h1v1h-1z');
	});
});

describe('detalle (render)', () => {
	const ID = '0d258c54-2a25-4901-a7fa-c18016f1282d';
	const base = {
		locale: 'gl',
		municipality: {
			slug: 'ribadavila',
			name: 'Ribadávila',
			primaryColor: '#1d4ed8',
			hasLogo: false
		},
		id: ID,
		code: '4821' as string | null,
		qr: null as string | null,
		priceCents: 400,
		status: 'confirmed',
		startsAt: new Date('2026-11-25T10:00:00+01:00'),
		endsAt: new Date('2026-11-25T11:00:00+01:00'),
		unitIndex: 0,
		today: DATE,
		editable: true,
		inTime: true,
		facility: {
			name: 'Pista 1',
			location: 'Polideportivo',
			address: 'Rúa do Deporte, 4',
			nameGl: 'Pádel',
			nameEs: 'Pádel',
			color: '#1d4ed8',
			mascot: 'padel',
			bookingMode: 'unit',
			rules: 'Calzado de sola lisa.'
		}
	};
	const html = (over: object) =>
		render(Detalle, { props: { data: { ...base, ...over } } as never }).body;

	it('fóra de prazo: sen enlaces a cambiar nin cancelar e co aviso', () => {
		const body = html({ inTime: false });
		expect(body).not.toContain(`/reserva/${ID}/cambiar`);
		expect(body).toContain('Xa pasou o prazo para cambiar esta reserva.');
		expect(body).toContain('Xa pasou o prazo para cancelar. Se non vas, contará como falta.');
		expect(body).not.toContain(`/reserva/${ID}/cancelar`);
	});

	it('dentro de prazo: enlace a cambiar, PIN e QR grande coa ruta de validar', () => {
		const token = signBookingQr(ID, 'k'.repeat(40));
		const qr = qrPayload('https://reservas.exemplo.gal', 'viana-do-bolo', token);
		const body = html({
			qr,
			municipality: { ...base.municipality, slug: 'viana-do-bolo', name: 'Viana do Bolo' }
		});
		expect(body).toContain(`/reserva/${ID}/cambiar`);
		expect(body).toContain('4821');
		const svg = /<svg[^>]*role="img"[^>]*>[\s\S]*?<\/svg>/.exec(body)?.[0] ?? '';
		expect(svg).not.toBe('');
		expect(Number(/width="(\d+)"/.exec(svg)?.[1])).toBeGreaterThanOrEqual(200);
		// O QR codifica exactamente o payload, que empeza pola ruta de validar do concello.
		expect(
			qr.startsWith('https://reservas.exemplo.gal/viana-do-bolo/conserxeria/validar?qr=')
		).toBe(true);
		const qrBody = render(Qr, { props: { value: qr, label: 'x', quiet: 4 } }).body;
		const d = (h: string) => /<path d="([^"]+)"/.exec(h)?.[1];
		expect(d(svg)).toBe(d(qrBody));
		// Datos, normas e as tres accións.
		expect(body).toContain('4 €');
		expect(body).toContain('Calzado de sola lisa.');
		expect(body).toContain('/api/v1/m/viana-do-bolo/me/bookings.ics');
	});

	it('sen clave de QR (Ruling 2): só o PIN, sen QR e sen erro', () => {
		const body = html({ qr: null });
		expect(body).toContain('4821');
		expect(body).not.toMatch(/<svg[^>]*role="img"/);
	});

	it('cancelada: sen código nin QR e co texto de estado', () => {
		const body = html({ status: 'cancelled', code: null, editable: false });
		expect(body).not.toContain('4821');
		expect(body).not.toMatch(/<svg[^>]*role="img"/);
		expect(body).toContain('Esta reserva está cancelada.');
	});
});
