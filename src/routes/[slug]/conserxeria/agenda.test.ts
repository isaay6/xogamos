// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	facilities,
	closures,
	municipalityProfiles,
	openingHours,
	seasonBookings,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { makeEvent } from '../../../lib/server/http/test-event';
import { createBooking } from '../../../lib/server/services/bookings';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { localDateTimeToUtc } from '../../../lib/server/domain/time';
import { getOpenMinutes, type AgendaFacility } from '../../../lib/server/services/staff';
import AgendaGrid from '../../../lib/ui/AgendaGrid.svelte';
import AgendaWeek from '../../../lib/ui/AgendaWeek.svelte';
import { load as follaLoad } from './folla/+page.server';
import FollaPage from './folla/+page.svelte';
import { initialSurname } from './folla/sheet';
import { busyMinutes } from './week';
import { load as layoutLoad } from './+layout.server';
import { actions, load } from './+page.server';
import AgendaPage from './+page.svelte';

const CREATED = new Date('2026-11-20T10:00:00+01:00');
const SLOT = new Date('2026-11-24T18:00:00+01:00');
const MORNING = new Date('2026-11-24T10:00:00+01:00');
const DURING = new Date('2026-11-24T18:05:00+01:00');
const LATER = new Date('2026-11-24T19:30:00+01:00');

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let conserje: U;
let admin: U;
let montemaiorConserje: U;
let vecina: U;
let poolId: string;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const book = async (facilityId: string, profileId: string, startsAt = SLOT) => {
	const r = await createBooking(db, {
		municipalityId: fx.municipalityId,
		facilityId,
		profileId,
		startsAt,
		channel: 'phone',
		createdByUserId: conserje.id,
		now: CREATED
	});
	if (!r.ok) throw new Error(r.error);
	return r.value;
};

const ev = (user: U | null, opts: { url?: string; now?: Date; slug?: string } = {}) =>
	makeEvent({
		db,
		user,
		now: opts.now ?? MORNING,
		url: opts.url ?? 'http://localhost/ribadavila/conserxeria',
		params: { slug: opts.slug ?? 'ribadavila' }
	}) as never;

// `redirect()` y `error()` lanzan; devolvemos lo lanzado.
const thrown = async (fn: () => unknown): Promise<{ status: number; location?: string }> => {
	try {
		await fn();
	} catch (e) {
		return e as { status: number; location?: string };
	}
	throw new Error('no ha lanzado');
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	conserje = await mkUser('conserje', 'Telmo Novo');
	admin = await mkUser('admin', 'Admin Ribadávila');
	montemaiorConserje = await mkUser('conserje-m', 'Conserxe Montemaior');
	vecina = { id: fx.userId, displayName: 'Nerea Veciña' };
	await db.insert(staffRoles).values([
		{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: montemaiorConserje.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' }
	]);
	await db
		.update(facilities)
		.set({ location: 'Polideportivo' })
		.where(eq(facilities.id, fx.facilityId));
	const [pool] = await db
		.insert(facilities)
		.values({
			municipalityId: fx.municipalityId,
			typeId: fx.typeId,
			name: 'Piscina',
			location: 'Piscina municipal',
			slotMinutes: 60,
			priceResidentCents: 300,
			priceNonResidentCents: 600
		})
		.returning();
	poolId = pool.id;
	await db.insert(openingHours).values(
		[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
			facilityId: pool.id,
			weekday,
			opens: '08:00',
			closes: '21:00'
		}))
	);
});

describe('layout del personal', () => {
	it('sin sesión redirige a entrar con redirectTo', async () => {
		const r = await thrown(() => layoutLoad(ev(null)));
		expect(r.status).toBe(303);
		const loc = new URL(r.location!, 'http://localhost');
		expect(loc.pathname).toBe('/ribadavila/entrar');
		expect(loc.searchParams.get('redirectTo')).toBe('/ribadavila/conserxeria');
	});
	it('un vecino sin rol recibe 403', async () => {
		expect((await thrown(() => layoutLoad(ev(vecina)))).status).toBe(403);
	});
	it('un conserje de Montemaior recibe 403 en Ribadávila', async () => {
		expect((await thrown(() => layoutLoad(ev(montemaiorConserje)))).status).toBe(403);
	});
	it('un conserje entra y no ve «Administración»', async () => {
		const d = (await layoutLoad(ev(conserje))) as { userName: string; isAdmin: boolean };
		expect(d.userName).toBe('Telmo Novo');
		expect(d.isAdmin).toBe(false);
	});
	it('un admin de Ribadávila entra y ve «Administración»', async () => {
		const d = (await layoutLoad(ev(admin))) as { isAdmin: boolean };
		expect(d.isAdmin).toBe(true);
	});
});

describe('agenda load', () => {
	it('agrupa por instalación, con horas de apertura y «agora»', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const d = (await load(ev(conserje))) as any;
		expect(d.date).toBe('2026-11-24');
		expect(d.facilities.map((f: any) => f.facilityName)).toEqual(['Piscina', 'Pista 1']);
		expect(d.facilities[1].bookings.map((x: any) => x.id)).toEqual([b.id]);
		expect(d.facilities[0].bookings).toEqual([]);
		expect(d.startMinute).toBe(8 * 60);
		expect(d.endMinute).toBe(22 * 60);
		expect(d.nowMinute).toBe(10 * 60);
		expect(d.panel).toBeNull();
		await db.delete(bookings);
	});
	it('?inst= filtra as instalacións; o menú segue listándoas todas', async () => {
		const d = (await load(
			ev(conserje, { url: `http://localhost/ribadavila/conserxeria?inst=${poolId}` })
		)) as any;
		expect(d.facilities.map((f: any) => f.facilityName)).toEqual(['Piscina']);
		expect(d.facilityOptions.map((f: any) => f.facilityName)).toEqual(['Piscina', 'Pista 1']);
		expect(d.selected).toEqual([poolId]);
		// Varias casiñas: as dúas.
		const both = (await load(
			ev(conserje, {
				url: `http://localhost/ribadavila/conserxeria?inst=${poolId}&inst=${fx.facilityId}`
			})
		)) as any;
		expect(both.facilities).toHaveLength(2);
		// Todas marcadas é o mesmo que sen filtro: non se ensina como activo.
		expect(both.selected).toEqual([]);
		expect(pageHtml(both)).not.toMatch(/<details[^>]*class="[^"]*\bon\b/);
		// Un id que non é do concello (ou non é un uuid) non filtra nada.
		const junk = (await load(
			ev(conserje, {
				url: `http://localhost/ribadavila/conserxeria?inst=${fx.otherFacilityId}&inst=xx`
			})
		)) as any;
		expect(junk.facilities).toHaveLength(2);
		expect(junk.selected).toEqual([]);
		// A páxina ten o menú de casiñas e conserva o filtro nas ligazóns de día.
		const html = render(AgendaPage as never, {
			props: {
				data: { ...d, municipality: { slug: 'ribadavila', name: 'R' }, locale: 'gl' }
			} as never
		}).body;
		expect(html).toMatch(/<details[^>]*class="[^"]*filtro/);
		expect(html).toContain(`name="inst" value="${poolId}" checked`);
		expect(html).toMatch(new RegExp(`name="inst" value="${fx.facilityId}"(?! checked)`));
		expect(html).toContain(`dia=2026-11-25&amp;inst=${poolId}`);
	});
	it('?reserva= abre el panel con la persona, el código y el límite de faltas', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const d = (await load(
			ev(conserje, { url: `http://localhost/ribadavila/conserxeria?reserva=${b.id}` })
		)) as any;
		expect(d.panel.id).toBe(b.id);
		expect(d.panel.displayName).toBe('Nerea Veciña');
		expect(d.panel.accessCode).toBe(b.accessCode);
		expect(d.panel.noShowThreshold).toBe(3);
		expect(d.panel.facilityName).toBe('Pista 1');
		await db.delete(bookings);
	});
	it('?reserva= de otro concello da 404', async () => {
		const [otherUser] = await db.select().from(users).where(eq(users.id, fx.userId));
		const [p] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.otherMunicipalityId, userId: otherUser.id, isResident: true })
			.returning();
		const [b] = await db
			.insert(bookings)
			.values({
				municipalityId: fx.otherMunicipalityId,
				facilityId: fx.otherFacilityId,
				profileId: p.id,
				startsAt: SLOT,
				endsAt: new Date(SLOT.getTime() + 3_600_000),
				channel: 'online',
				priceCents: 300,
				accessCode: '654321',
				createdByUserId: otherUser.id,
				createdAt: CREATED
			})
			.returning();
		const r = await thrown(() =>
			load(ev(conserje, { url: `http://localhost/ribadavila/conserxeria?reserva=${b.id}` }))
		);
		expect(r.status).toBe(404);
		const bad = await thrown(() =>
			load(ev(conserje, { url: 'http://localhost/ribadavila/conserxeria?reserva=nope' }))
		);
		expect(bad.status).toBe(404);
		await db.delete(bookings);
	});
	it('vecino sin rol no ejecuta el load', async () => {
		expect((await thrown(() => load(ev(vecina)))).status).toBe(403);
	});
});

describe('acciones del panel', () => {
	const act = (
		name: 'chegou' | 'nonVeu' | 'cancelar',
		id: string,
		now: Date,
		user = conserje,
		fields: Record<string, string> = {}
	) => {
		const event = makeEvent({
			db,
			user,
			now,
			method: 'POST',
			url: `http://localhost/ribadavila/conserxeria?reserva=${id}`,
			params: { slug: 'ribadavila' }
		});
		Object.defineProperty(event, 'request', {
			value: new Request(event.url, { method: 'POST', body: new URLSearchParams(fields) })
		});
		return actions[name](event as never) as Promise<any>;
	};

	it('chegou antes de la ventana devuelve fail(422, OUTSIDE_WINDOW) y dentro deja attended', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const early = await act('chegou', b.id, MORNING);
		expect(early.status).toBe(422);
		expect(early.data).toEqual({ error: 'OUTSIDE_WINDOW' });
		await act('chegou', b.id, DURING);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('attended');
		const again = await act('chegou', b.id, DURING);
		expect(again.data).toEqual({ error: 'ALREADY_FINAL' });
		await db.delete(bookings);
	});
	it('nonVeu incrementa noShowCount y antes del inicio da NOT_STARTED', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const early = await act('nonVeu', b.id, MORNING);
		expect(early.data).toEqual({ error: 'NOT_STARTED' });
		await act('nonVeu', b.id, LATER);
		const [p] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, fx.profileId));
		expect(p.noShowCount).toBe(1);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('no_show');
		await db.delete(bookings);
	});
	it('cancelar fuera de plazo funciona porque lo hace el personal', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		await act('cancelar', b.id, DURING, conserje, { confirmar: '1', motivo: 'Pista mollada' });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('cancelled');
		await db.delete(bookings);
	});
	it('cancelar confirmado sen motivo devolve fail(400) e non cancela', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const r = await act('cancelar', b.id, DURING, conserje, { confirmar: '1', motivo: '  ' });
		expect(r.status).toBe(400);
		expect(r.data).toEqual({ confirmCancel: b.id, error: 'VALIDATION_FAILED' });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('confirmed');
		await db.delete(bookings);
	});
	it('cancelar sen confirmar devolve fail(409, confirmCancel) e non cancela', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		const first = await act('cancelar', b.id, DURING);
		expect(first.status).toBe(409);
		expect(first.data).toEqual({ confirmCancel: b.id });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('confirmed');

		// A páxina pide a segunda confirmación e reenvía con confirmar=1.
		const data = await load(
			ev(conserje, { url: `http://localhost/ribadavila/conserxeria?reserva=${b.id}`, now: DURING })
		);
		const html = render(AgendaPage as never, {
			props: {
				data: { ...data, municipality: { slug: 'ribadavila', name: 'R' }, locale: 'gl' },
				form: first.data
			} as never
		}).body;
		expect(html).toContain('Seguro?');
		// Ruling 10: etiqueta neutra de empadroamento.
		expect(html).toContain('Empadroamento: non');
		expect(html).not.toMatch(/mpadroada/);
		expect(html).toContain('name="confirmar" value="1"');
		expect(html).toMatch(/<textarea name="motivo" required/);
		const plain = render(AgendaPage as never, {
			props: {
				data: { ...data, municipality: { slug: 'ribadavila', name: 'R' }, locale: 'gl' }
			} as never
		}).body;
		expect(plain).not.toContain('Seguro?');
		await db.delete(bookings);
	});
	it('cancelar sen confirmar tamén exixe rol', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		expect((await thrown(() => act('cancelar', b.id, DURING, vecina))).status).toBe(403);
		await db.delete(bookings);
	});
	it('exigen rol: un vecino recibe 403 y no cambia nada', async () => {
		const b = await book(fx.facilityId, fx.profileId);
		expect((await thrown(() => act('cancelar', b.id, DURING, vecina))).status).toBe(403);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('confirmed');
		await db.delete(bookings);
	});
});

describe('AgendaGrid', () => {
	const base = {
		locale: 'gl' as const,
		startMinute: 480,
		endMinute: 1320,
		nowMinute: 600,
		selectedId: null,
		query: ''
	};
	const entry = (over: Record<string, unknown>) => ({
		id: 'b1',
		startsAt: SLOT,
		endsAt: new Date(SLOT.getTime() + 3_600_000),
		unitIndex: null,
		seats: 1,
		channel: 'online',
		status: 'confirmed',
		profileId: 'p',
		displayName: 'Lucía Rial',
		phone: null,
		accessCode: '123456',
		priceCents: 300,
		isResident: true,
		noShowCount: 0,
		...over
	});
	const fac = (over: Record<string, unknown>) => ({
		facilityId: 'f1',
		facilityName: 'Pádel',
		location: '',
		mascot: 'padel',
		color: '#F2762E',
		bookingMode: 'slot',
		units: 1,
		capacity: 1,
		bookings: [],
		...over
	});

	it('cada bloque es un enlace ?reserva= con marcas y línea «agora»', () => {
		const { body } = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					fac({
						bookings: [
							entry({ id: 'b1', status: 'attended' }),
							entry({ id: 'b2', status: 'no_show', channel: 'phone', displayName: 'Rosa Souto' }),
							entry({ id: 'b3', status: 'cancelled' })
						]
					})
				]
			}
		});
		expect(body).toMatch(/<a[^>]*href="\?reserva=b1"/);
		expect(body).toMatch(/<a[^>]*href="\?reserva=b2"/);
		expect(body).not.toContain('reserva=b3');
		expect(body).toContain('Lucía R.');
		expect(body).toContain('☎');
		expect(body).toContain('✓');
		expect(body).toMatch(/class="now\b/);
	});
	it('unit: una fila por unidad; capacity: una fila con ocupadas/aforo', () => {
		const unit = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					fac({
						bookingMode: 'unit',
						units: 2,
						facilityName: 'Piscina',
						bookings: [entry({ unitIndex: 1 })]
					})
				]
			}
		}).body;
		expect(unit).toContain('Piscina · Pista 1');
		expect(unit).toContain('Piscina · Pista 2');
		const pool = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					fac({ bookingMode: 'unit', units: 2, facilityName: 'Piscina', mascot: 'natacion' })
				]
			}
		}).body;
		expect(pool).toContain('Piscina · Rúa 2');
		const cap = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					fac({
						bookingMode: 'capacity',
						capacity: 8,
						bookings: [entry({ id: 'c1', seats: 3 }), entry({ id: 'c2', seats: 2 })]
					})
				]
			}
		}).body;
		expect(cap).toContain('5/8');
	});
});

// ── Axenda de varios días (1a + 2b), semana e folla do día ────────────────────────────────

/** Reserva insertada a man (sen as regras de reserva) á hora local `hhmm` do día `date`. */
const put = async (
	date: string,
	hhmm: string,
	minutes = 60,
	over: Partial<typeof bookings.$inferInsert> = {}
) => {
	const startsAt = localDateTimeToUtc(date, hhmm);
	const [row] = await db
		.insert(bookings)
		.values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt,
			endsAt: new Date(startsAt.getTime() + minutes * 60_000),
			channel: 'online',
			priceCents: 300,
			accessCode: '4821',
			createdByUserId: fx.userId,
			createdAt: CREATED,
			...over
		})
		.returning();
	return row;
};

const url = (q: string) => `http://localhost/ribadavila/conserxeria${q}`;
const pageHtml = (d: object) =>
	render(AgendaPage as never, {
		props: {
			data: { ...d, municipality: { slug: 'ribadavila', name: 'R' }, locale: 'gl' }
		} as never
	}).body;

describe('axenda: navegación por días', () => {
	it('?dia= ensina ese día, con Onte/Mañá e sen liña «agora» fóra de hoxe', async () => {
		const today = await put('2026-11-24', '18:00');
		const tomorrow = await put('2026-11-25', '11:00');
		const d = (await load(ev(conserje, { url: url('?dia=2026-11-25') }))) as any;
		expect(d.date).toBe('2026-11-25');
		expect(d.today).toBe('2026-11-24');
		expect(d.vista).toBe('dia');
		expect(d.prev).toBe('2026-11-24');
		expect(d.next).toBe('2026-11-26');
		expect(d.nowMinute).toBeNull();
		const ids = d.facilities.flatMap((f: any) => f.bookings.map((b: any) => b.id));
		expect(ids).toEqual([tomorrow.id]);
		const html = pageHtml(d);
		expect(html).toContain('href="?dia=2026-11-24"');
		expect(html).toContain('href="?dia=2026-11-26"');
		expect(html).toContain('Onte');
		expect(html).toContain('Mañá');
		expect(html).toMatch(/<input[^>]*type="date"[^>]*name="dia"[^>]*value="2026-11-25"/);
		expect(html).not.toMatch(/class="now\b/);
		// Sen filtro, todas as casiñas marcadas.
		expect(html).toContain(`name="inst" value="${fx.facilityId}" checked`);
		// Cada bloque conserva o día ao abrir a tarxeta.
		expect(html).toContain(`?reserva=${tomorrow.id}&amp;dia=2026-11-25`);
		// Hoxe: a liña «agora» e a reserva de hoxe.
		const t = (await load(ev(conserje, { url: url('') }))) as any;
		expect(t.nowMinute).toBe(600);
		expect(t.facilities.flatMap((f: any) => f.bookings.map((b: any) => b.id))).toEqual([today.id]);
		// A tarxeta dunha reserva doutro día ábrese con ?dia=.
		const p = (await load(
			ev(conserje, { url: url(`?dia=2026-11-25&reserva=${tomorrow.id}`) })
		)) as any;
		expect(p.panel.id).toBe(tomorrow.id);
		await db.delete(bookings);
	});

	it('parámetros non válidos volven a hoxe e á vista de día', async () => {
		for (const q of [
			'?dia=2026-02-31&vista=mes',
			'?dia=onte',
			'?dia=24-11-2026&vista=',
			'?dia=0000-01-01'
		]) {
			const d = (await load(ev(conserje, { url: url(q) }))) as any;
			expect(d.date, q).toBe('2026-11-24');
			expect(d.vista, q).toBe('dia');
			expect(d.week, q).toBeNull();
		}
		// Anos fóra de 2000–2100: hoxe, tamén na semana (antes, o ano 10000 rompía a consulta).
		for (const q of ['?dia=9999-12-31&vista=semana', '?dia=1999-12-31&vista=semana']) {
			const d = (await load(ev(conserje, { url: url(q) }))) as any;
			expect(d.date, q).toBe('2026-11-24');
			expect(d.week.days[0].date, q).toBe('2026-11-23');
		}
	});
});

describe('axenda: semana', () => {
	it('conta as horas por instalación e día, con tranquila / media / chea / pechada', async () => {
		// Pista 1 abre 13 h (09–22). Luns 23: 2 h (+1 cancelada); martes 24: 10 h; mércores 25: 7 h.
		await put('2026-11-23', '10:00');
		await put('2026-11-23', '11:00');
		await put('2026-11-23', '12:00', 60, { status: 'cancelled' });
		for (let h = 9; h < 19; h++) await put('2026-11-24', `${String(h).padStart(2, '0')}:00`);
		for (let h = 9; h < 16; h++) await put('2026-11-25', `${String(h).padStart(2, '0')}:00`);
		// Sábado 28 pechada todo o día.
		await db.insert(closures).values({
			facilityId: fx.facilityId,
			startsAt: localDateTimeToUtc('2026-11-28', '00:00'),
			endsAt: localDateTimeToUtc('2026-11-29', '00:00'),
			reason: 'Mantemento'
		});
		const d = (await load(ev(conserje, { url: url('?dia=2026-11-26&vista=semana') }))) as any;
		expect(d.vista).toBe('semana');
		expect(d.prev).toBe('2026-11-19');
		expect(d.next).toBe('2026-12-03');
		expect(d.week.days.map((x: any) => x.date)).toEqual([
			'2026-11-23',
			'2026-11-24',
			'2026-11-25',
			'2026-11-26',
			'2026-11-27',
			'2026-11-28',
			'2026-11-29'
		]);
		const pista = d.week.rows.find((r: any) => r.facilityId === fx.facilityId);
		const cell = (date: string) => pista.cells.find((c: any) => c.date === date);
		expect(cell('2026-11-23')).toMatchObject({ minutes: 120, possible: 780, level: 'tranquila' });
		expect(cell('2026-11-24')).toMatchObject({ minutes: 600, level: 'chea' });
		expect(cell('2026-11-25')).toMatchObject({ minutes: 420, level: 'media' });
		expect(cell('2026-11-26')).toMatchObject({ minutes: 0, level: 'tranquila' });
		expect(cell('2026-11-28')).toMatchObject({ possible: 0, level: 'pechada' });
		const html = pageHtml(d);
		expect(html).toContain('href="?dia=2026-11-24"');
		expect(html).toContain('10 h');
		expect(html).toContain('chea');
		expect(html).toContain('Pechada');
		await db.delete(bookings);
		await db.delete(closures);
	});

	it('o filtro tamén vale na semana', async () => {
		const d = (await load(ev(conserje, { url: url(`?vista=semana&inst=${poolId}`) }))) as any;
		expect(d.week.rows.map((r: any) => r.facilityName)).toEqual(['Piscina']);
		expect(pageHtml(d)).toContain(`href="?dia=2026-11-24&amp;inst=${poolId}"`);
	});

	it('cambio de hora (25 out 2026): unha reserva ás 23:30 sae unha vez, o día 25', async () => {
		const late = await put('2026-10-25', '23:30', 60);
		const now = new Date('2026-10-25T12:00:00+01:00');
		const at = (q: string) => load(ev(conserje, { url: url(q), now })) as Promise<any>;
		const ids = (d: any) => d.facilities.flatMap((f: any) => f.bookings.map((b: any) => b.id));
		expect(ids(await at('?dia=2026-10-25'))).toEqual([late.id]);
		expect(ids(await at('?dia=2026-10-26'))).toEqual([]);
		expect(ids(await at('?dia=2026-10-24'))).toEqual([]);
		// O día 25 ten 25 horas: a columna chega ata a medianoite.
		expect((await at('?dia=2026-10-25')).endMinute).toBe(24 * 60);

		const minutesOf = (d: any) =>
			Object.fromEntries(
				d.week.rows
					.find((r: any) => r.facilityId === fx.facilityId)
					.cells.map((c: any) => [c.date, c.minutes])
			);
		const week = minutesOf(await at('?dia=2026-10-22&vista=semana'));
		expect(Object.keys(week)).toEqual([
			'2026-10-19',
			'2026-10-20',
			'2026-10-21',
			'2026-10-22',
			'2026-10-23',
			'2026-10-24',
			'2026-10-25'
		]);
		expect(week['2026-10-25']).toBe(60);
		expect(Object.values(week).reduce((a: number, b) => a + (b as number), 0)).toBe(60);
		const next = minutesOf(await at('?dia=2026-10-26&vista=semana'));
		expect(Object.keys(next)[0]).toBe('2026-10-26');
		expect(Object.values(next).every((m) => m === 0)).toBe(true);
		await db.delete(bookings);
	});
});

describe('axenda: reservas de tempada', () => {
	it('saen coa entidade, só de lectura, e contan na semana', async () => {
		const [season] = await db
			.insert(seasonBookings)
			.values({
				municipalityId: fx.municipalityId,
				facilityId: fx.facilityId,
				entityName: 'CD Ribadávila',
				weekday: 1, // martes
				startsTime: '19:00',
				endsTime: '20:30',
				fromDate: '2026-10-01',
				toDate: '2027-06-30',
				createdBy: conserje.id
			})
			.returning();
		const d = (await load(ev(conserje, { url: url('') }))) as any;
		const html = pageHtml(d);
		expect(html).toContain('CD Ribadávila');
		expect(html).not.toContain(season.id);
		expect(html).toMatch(/class="[^"]*\btempada\b/);
		const w = (await load(ev(conserje, { url: url('?vista=semana') }))) as any;
		const pista = w.week.rows.find((r: any) => r.facilityId === fx.facilityId);
		expect(pista.cells.find((c: any) => c.date === '2026-11-24').minutes).toBe(90);
		// A folla tamén a leva, sen PIN.
		const f = (await follaLoad(
			ev(conserje, { url: 'http://localhost/ribadavila/conserxeria/folla' })
		)) as any;
		const rows = f.sheet.flatMap((g: any) => g.rows);
		expect(rows).toContainEqual(expect.objectContaining({ name: 'CD Ribadávila', code: null }));
		await db.delete(seasonBookings);
	});
});

describe('AgendaGrid vertical: tempada e peche', () => {
	const base = {
		locale: 'gl' as const,
		startMinute: 480,
		endMinute: 1320,
		nowMinute: null,
		selectedId: null,
		query: ''
	};
	const season = {
		id: 's1',
		entityName: 'Escola de natación',
		startsAt: SLOT,
		endsAt: new Date(SLOT.getTime() + 5_400_000),
		unitIndex: null
	};
	it('unha tempada sen unidade ocupa todas as rúas e non é unha ligazón', () => {
		const body = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					{
						facilityId: 'f1',
						facilityName: 'Piscina',
						mascot: 'natacion',
						color: '#1AA6C8',
						bookingMode: 'unit',
						units: 2,
						capacity: 1,
						bookings: [],
						seasons: [season],
						closed: false
					}
				]
			}
		}).body;
		expect(body.match(/Escola de natación/g)?.length).toBe(2);
		expect(body).not.toContain('reserva=s1');
		expect(body).not.toMatch(/class="now\b/);
	});
	it('unha instalación pechada ese día di «Pechada»', () => {
		const body = render(AgendaGrid, {
			props: {
				...base,
				facilities: [
					{
						facilityId: 'f1',
						facilityName: 'Pádel',
						mascot: 'padel',
						color: '#F2762E',
						bookingMode: 'slot',
						units: 1,
						capacity: 1,
						bookings: [],
						seasons: [],
						closed: true
					}
				]
			}
		}).body;
		expect(body).toContain('Pechada');
	});
});

describe('AgendaWeek', () => {
	it('cada caixa leva ao día, con horas e palabra', () => {
		const body = render(AgendaWeek, {
			props: {
				locale: 'gl',
				query: '&inst=f1',
				days: [
					{ date: '2026-11-23', isToday: false, isPast: true },
					{ date: '2026-11-24', isToday: true, isPast: false }
				],
				rows: [
					{
						facilityId: 'f1',
						facilityName: 'Pádel',
						mascot: 'padel',
						color: '#F2762E',
						cells: [
							{ date: '2026-11-23', minutes: 90, possible: 780, level: 'tranquila' },
							{ date: '2026-11-24', minutes: 0, possible: 0, level: 'pechada' }
						]
					}
				]
			}
		}).body;
		expect(body).toContain('href="?dia=2026-11-23&amp;inst=f1"');
		expect(body).toContain('1,5 h');
		expect(body).toContain('tranquila');
		expect(body).toContain('Pechada');
		expect(body).toContain('Lun');
		expect(body).toMatch(/aria-current="date"/);
	});
});

describe('folla do día', () => {
	it('inicial e apelido', () => {
		expect(initialSurname('Nerea Veciña')).toBe('N. Veciña');
		expect(initialSurname('Hadrián Seixo Mouriño')).toBe('H. Seixo');
		// Tres palabras: «Nome Apelido1 Apelido2», tamén cando o nome parece composto.
		expect(initialSurname('Ana María Pérez')).toBe('A. María');
		expect(initialSurname('Olaia Pazó Lago')).toBe('O. Pazó');
		expect(initialSurname('María José Pérez López')).toBe('M. Pérez');
		expect(initialSurname('  Telmo  ')).toBe('T.');
	});

	it('lista as reservas do día (sen canceladas) con inicial+apelido, PIN e casiña', async () => {
		await db.update(users).set({ phone: '600111222' }).where(eq(users.id, fx.userId));
		await put('2026-11-24', '18:00', 60, { accessCode: '0407' });
		await put('2026-11-24', '19:00', 60, {
			profileId: fx.residentProfileId,
			status: 'cancelled',
			accessCode: '9999'
		});
		await put('2026-11-25', '10:00', 60, { accessCode: '5555' });
		const d = (await follaLoad(
			ev(conserje, { url: 'http://localhost/ribadavila/conserxeria/folla' })
		)) as any;
		expect(d.date).toBe('2026-11-24');
		const rows = d.sheet.flatMap((g: any) => g.rows);
		expect(rows).toEqual([
			expect.objectContaining({ time: '18:00–19:00', name: 'N. Veciña', code: '0407' })
		]);
		// Nada de nome completo nin contacto nos datos que chegan á páxina.
		const json = JSON.stringify(d);
		expect(json).not.toContain('Nerea');
		expect(json).not.toContain('600111222');
		expect(json).not.toContain('Empadroado');
		const html = render(FollaPage as never, {
			props: {
				data: { ...d, municipality: { slug: 'ribadavila', name: 'Ribadávila' }, locale: 'gl' }
			} as never
		}).body;
		expect(html).toContain('N. Veciña');
		expect(html).toContain('0407');
		expect(html).not.toContain('9999');
		expect(html).not.toContain('Nerea');
		expect(html).toContain('Pista 1');
		expect(html).toMatch(/class="casa\b/);
		// Sen JS: unha axuda para imprimir co navegador.
		expect(html).toContain('Ctrl+P');
		// Outro día por ?dia=; un día inválido volve a hoxe.
		const other = (await follaLoad(
			ev(conserje, { url: 'http://localhost/ribadavila/conserxeria/folla?dia=2026-11-25' })
		)) as any;
		expect(other.sheet.flatMap((g: any) => g.rows).map((r: any) => r.code)).toEqual(['5555']);
		const bad = (await follaLoad(
			ev(conserje, { url: 'http://localhost/ribadavila/conserxeria/folla?dia=nope' })
		)) as any;
		expect(bad.date).toBe('2026-11-24');
		const far = (await follaLoad(
			ev(conserje, { url: 'http://localhost/ribadavila/conserxeria/folla?dia=9999-12-31' })
		)) as any;
		expect(far.date).toBe('2026-11-24');
		await db.delete(bookings);
		await db.update(users).set({ phone: null }).where(eq(users.id, fx.userId));
	});

	it('exixe rol de conserxe', async () => {
		const r = await thrown(() =>
			follaLoad(ev(vecina, { url: 'http://localhost/ribadavila/conserxeria/folla' }))
		);
		expect(r.status).toBe(403);
	});
});

describe('ocupación: aforo e unidades', () => {
	const at = (hhmm: string) => localDateTimeToUtc('2026-11-24', hhmm);
	const entry = (over: Record<string, unknown>) =>
		({
			id: 'b',
			startsAt: at('10:00'),
			endsAt: at('11:00'),
			unitIndex: null,
			seats: 1,
			channel: 'online',
			status: 'confirmed',
			profileId: 'p',
			displayName: 'X',
			phone: null,
			accessCode: '0000',
			priceCents: 0,
			isResident: true,
			noShowCount: 0,
			...over
		}) as AgendaFacility['bookings'][number];
	const fac = (over: Partial<AgendaFacility>): AgendaFacility => ({
		facilityId: 'f',
		facilityName: 'F',
		location: '',
		mascot: 'natacion',
		color: '#1AA6C8',
		bookingMode: 'slot',
		units: 1,
		capacity: 1,
		bookings: [],
		seasons: [],
		...over
	});

	it('aforo: a franxa pesa as prazas ocupadas entre o aforo; a tempada, enteira', () => {
		const pool = fac({
			bookingMode: 'capacity',
			capacity: 8,
			bookings: [
				entry({ id: 'a', seats: 1 }),
				entry({ id: 'b', seats: 3 }),
				entry({ id: 'c', seats: 4, status: 'cancelled' })
			],
			seasons: [
				{
					id: 's',
					entityName: 'Escola',
					startsAt: at('18:00'),
					endsAt: at('19:00'),
					unitIndex: null
				}
			]
		});
		// 60 min × 4/8 + 60 min de tempada.
		expect(busyMinutes(pool)).toBe(90);
		// Unha soa persoa nunha hora: 60/8, non a hora enteira.
		expect(busyMinutes(fac({ bookingMode: 'capacity', capacity: 8, bookings: [entry({})] }))).toBe(
			8
		);
		// Máis prazas que aforo non pasa da franxa.
		expect(
			busyMinutes(fac({ bookingMode: 'capacity', capacity: 2, bookings: [entry({ seats: 5 })] }))
		).toBe(60);
	});

	it('unidades: media por unidade, nunca máis que as horas de apertura', () => {
		const courts = fac({
			bookingMode: 'unit',
			units: 2,
			bookings: [
				entry({ id: 'a', unitIndex: 0, endsAt: at('12:00') }),
				entry({ id: 'b', unitIndex: 1 })
			],
			seasons: [
				{ id: 's', entityName: 'Club', startsAt: at('18:00'), endsAt: at('19:00'), unitIndex: null }
			]
		});
		// (120 + 60 + 60 + 60) / 2
		expect(busyMinutes(courts)).toBe(150);
	});
});

describe('getOpenMinutes', () => {
	it('resta os peches (parciais e solapados) e conta o día do cambio de hora', async () => {
		// Pista 1: 09–22 todos os días (780 min).
		await db.insert(closures).values([
			{
				facilityId: fx.facilityId,
				startsAt: localDateTimeToUtc('2026-11-26', '12:00'),
				endsAt: localDateTimeToUtc('2026-11-26', '14:00'),
				reason: 'a'
			},
			{
				facilityId: fx.facilityId,
				startsAt: localDateTimeToUtc('2026-11-26', '13:00'),
				endsAt: localDateTimeToUtc('2026-11-26', '15:00'),
				reason: 'b'
			}
		]);
		// Unha instalación aberta toda a noite os domingos (00:00–23:59).
		const [night] = await db
			.insert(facilities)
			.values({
				municipalityId: fx.municipalityId,
				typeId: fx.typeId,
				name: 'Noite',
				active: false,
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0
			})
			.returning();
		await db
			.insert(openingHours)
			.values({ facilityId: night.id, weekday: 6, opens: '00:00', closes: '23:59' });
		const open = await getOpenMinutes(db, fx.municipalityId, [
			'2026-11-25',
			'2026-11-26',
			'2026-10-25',
			'2026-11-01'
		]);
		expect(open.get(fx.facilityId)?.get('2026-11-25')).toBe(780);
		expect(open.get(fx.facilityId)?.get('2026-11-26')).toBe(780 - 180);
		expect(open.get(fx.facilityId)?.get('2026-10-25')).toBe(780);
		// O 25 de outubro ten 25 horas: a noite aberta dura unha hora máis.
		expect(open.get(night.id)?.get('2026-10-25')).toBe(25 * 60 - 1);
		expect(open.get(night.id)?.get('2026-11-01')).toBe(24 * 60 - 1);
		// Outro concello non ve nada deste.
		const other = await getOpenMinutes(db, fx.otherMunicipalityId, ['2026-11-26']);
		expect(other.has(fx.facilityId)).toBe(false);
		await db.delete(closures);
		await db.delete(facilities).where(eq(facilities.id, night.id));
	});
});
