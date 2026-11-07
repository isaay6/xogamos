// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { bookings, municipalities, staffRoles, users } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { GET as indicators } from './m/[slug]/admin/indicators/+server';
import { GET as indicatorsCsv } from './m/[slug]/admin/indicators.csv/+server';
import { GET as occupancy } from './m/[slug]/open-data/occupancy/+server';
import { GET as compare, POST as onboard } from './deputacion/municipalities/+server';
import { GET as settings } from './m/[slug]/admin/settings/+server';
import { GET as exportJson } from './m/[slug]/admin/export/+server';

const NOW = new Date('2026-11-20T10:00:00+01:00');
type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let diputacion: U;
let vecina: U;
const bookingIds: string[] = [];

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Admin Ribadávila');
	diputacion = await mkUser('dep', 'Persoa Deputación');
	vecina = { id: fx.userId, displayName: 'Nerea Veciña' };
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: diputacion.id, municipalityId: null, role: 'deputacion' }
	]);
	let code = 0;
	const mk = (day: string, hh: string, status: 'confirmed' | 'no_show' | 'cancelled') => ({
		municipalityId: fx.municipalityId,
		facilityId: fx.facilityId,
		profileId: fx.profileId,
		startsAt: new Date(`${day}T${hh}:00:00+01:00`),
		endsAt: new Date(`${day}T${String(Number(hh) + 1).padStart(2, '0')}:00:00+01:00`),
		status,
		accessCode: `10000${++code}`,
		priceCents: 300,
		channel: 'online' as const,
		createdByUserId: fx.userId
	});
	const rows = await db
		.insert(bookings)
		.values([
			mk('2026-11-16', '10', 'confirmed'),
			mk('2026-11-17', '10', 'no_show'),
			mk('2026-11-18', '11', 'cancelled')
		])
		.returning({ id: bookings.id });
	bookingIds.push(...rows.map((r) => r.id));
});

const ev = (
	user: U | null,
	params: Record<string, string>,
	url = 'http://localhost/',
	extra: { method?: string; body?: unknown } = {}
) => makeEvent({ db, now: NOW, user, params, url, ...extra }) as never;

describe('indicadores del concello', () => {
	it('acceso: sin sesión 401, vecina 403', async () => {
		const url = 'http://localhost/?from=2026-11-16&to=2026-11-22';
		expect((await indicators(ev(null, { slug: 'ribadavila' }, url))).status).toBe(401);
		expect((await indicators(ev(vecina, { slug: 'ribadavila' }, url))).status).toBe(403);
	});

	it('más de 92 días → 400; fecha inválida → 400; falta to → 400', async () => {
		const p = { slug: 'ribadavila' };
		const long = 'http://localhost/?from=2026-01-01&to=2026-04-03';
		expect((await indicators(ev(admin, p, long))).status).toBe(400);
		const bad = 'http://localhost/?from=2026-02-30&to=2026-03-01';
		expect((await indicators(ev(admin, p, bad))).status).toBe(400);
		expect((await indicators(ev(admin, p, 'http://localhost/?from=2026-01-01'))).status).toBe(400);
		const reversed = 'http://localhost/?from=2026-01-10&to=2026-01-01';
		expect((await indicators(ev(admin, p, reversed))).status).toBe(400);
	});

	it('92 días exactos (to inclusivo) → 200 con la semana de datos', async () => {
		const url = 'http://localhost/?from=2026-11-16&to=2026-11-22';
		const res = await indicators(ev(admin, { slug: 'ribadavila' }, url));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.byFacility).toHaveLength(1);
		const f = data.byFacility[0];
		expect(f.name).toBe('Pista 1');
		expect(f.bookings).toBe(2);
		expect(f.noShows).toBe(1);
		expect(f.noShowRate).toBe(0.5);
		// 7 días × 13 franjas = 91 ofertadas, 2 reservadas.
		expect(f.occupancy).toBe(0.022);
		expect(f.underused).toBe(true);
		expect(data.peakHours).toEqual([
			{ weekday: 0, hour: 10, bookings: 1 },
			{ weekday: 1, hour: 10, bookings: 1 }
		]);
		const ninetyTwo = 'http://localhost/?from=2026-01-01&to=2026-04-02';
		expect((await indicators(ev(admin, { slug: 'ribadavila' }, ninetyTwo))).status).toBe(200);
	});

	it('CSV con cabecera y una fila por instalación, sin caché', async () => {
		const url = 'http://localhost/?from=2026-11-16&to=2026-11-22';
		const res = await indicatorsCsv(ev(admin, { slug: 'ribadavila' }, url));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/csv');
		expect(res.headers.get('cache-control')).toBe('no-store');
		const lines = (await res.text()).replace('﻿', '').trim().split('\r\n');
		expect(lines).toHaveLength(2);
		expect(lines[0]).toBe(
			'Identificador da instalación;Instalación;Ocupación;Reservas;Faltas;Taxa de faltas;Pouco usada'
		);
		expect(lines[1]).toContain('Pista 1');
		expect((await indicatorsCsv(ev(vecina, { slug: 'ribadavila' }, url))).status).toBe(403);
	});
});

describe('datos abiertos de ocupación', () => {
	const url = 'http://localhost/?week=2026-11-16';

	it('público, sin datos personales ni ids de reserva, con CORS', async () => {
		const res = await occupancy(ev(null, { slug: 'ribadavila' }, url));
		expect(res.status).toBe(200);
		expect(res.headers.get('access-control-allow-origin')).toBe('*');
		const text = await res.text();
		expect(text).not.toContain('displayName');
		expect(text).not.toContain(vecina.displayName);
		for (const id of bookingIds) expect(text).not.toContain(id);
		const data = JSON.parse(text);
		expect(data.week).toBe('2026-11-16');
		expect(data.facilities).toHaveLength(1);
		const days = data.facilities[0].days;
		expect(days.map((d: { date: string }) => d.date)).toEqual([
			'2026-11-16',
			'2026-11-17',
			'2026-11-18',
			'2026-11-19',
			'2026-11-20',
			'2026-11-21',
			'2026-11-22'
		]);
		expect(days[0].occupancy).toBe(0.077);
		expect(days[2].occupancy).toBe(0);
	});

	it('semana que no es lunes, mal formada o ausente → 400; concello inexistente → 404', async () => {
		const p = { slug: 'ribadavila' };
		expect((await occupancy(ev(null, p, 'http://localhost/?week=2026-11-17'))).status).toBe(400);
		expect((await occupancy(ev(null, p, 'http://localhost/?week=2026-02-30'))).status).toBe(400);
		expect((await occupancy(ev(null, p, 'http://localhost/'))).status).toBe(400);
		expect((await occupancy(ev(null, { slug: 'nada' }, url))).status).toBe(404);
	});
});

describe('deputación', () => {
	const newBody = {
		slug: 'vilanova-de-arousa-demo',
		name: 'Vilanova de Arousa Demo',
		province: 'Pontevedra',
		primaryColor: '#0f766e',
		firstAdmin: { provider: 'clave', subject: 'demo-admin-1', displayName: 'Alcaldía Demo' }
	};
	const post = (user: U | null, body: unknown) =>
		onboard(ev(user, {}, 'http://localhost/', { method: 'POST', body }));

	it('alta con primer admin → 201 y ese admin accede a admin/settings', async () => {
		const res = await post(diputacion, newBody);
		expect(res.status).toBe(201);
		const created = await res.json();
		expect(created.slug).toBe('vilanova-de-arousa-demo');
		const [row] = await db.select().from(municipalities).where(eq(municipalities.id, created.id));
		expect(row.cancellationDeadlineMinutes).toBe(120);
		const [u] = await db.select().from(users).where(eq(users.subject, 'demo-admin-1'));
		const s = await settings(
			ev({ id: u.id, displayName: u.displayName }, { slug: 'vilanova-de-arousa-demo' })
		);
		expect(s.status).toBe(200);
		expect((await s.json()).name).toBe('Vilanova de Arousa Demo');
		// y no en otro concello
		expect(
			(await settings(ev({ id: u.id, displayName: u.displayName }, { slug: 'ribadavila' }))).status
		).toBe(403);
	});

	it('firstAdmin ya existente: conserva nombre y email y recibe el rol admin', async () => {
		const [prev] = await db
			.insert(users)
			.values({
				provider: 'clave',
				subject: 'persona-existente',
				displayName: 'Nome Orixinal',
				email: 'orixinal@example.org'
			})
			.returning();
		const res = await post(diputacion, {
			...newBody,
			slug: 'concello-con-admin-existente',
			firstAdmin: { provider: 'clave', subject: 'persona-existente', displayName: 'Nome Pisado' }
		});
		expect(res.status).toBe(201);
		const created = await res.json();
		const [after] = await db.select().from(users).where(eq(users.id, prev.id));
		expect(after.displayName).toBe('Nome Orixinal');
		expect(after.email).toBe('orixinal@example.org');
		const roles = await db.select().from(staffRoles).where(eq(staffRoles.userId, prev.id));
		expect(roles).toContainEqual(
			expect.objectContaining({ municipalityId: created.id, role: 'admin' })
		);
	});

	it('firstAdmin.subject de más de 64 caracteres → 400 (el login lo rechazaría)', async () => {
		const long = { provider: 'clave', subject: 'a'.repeat(65), displayName: 'X' };
		expect(
			(await post(diputacion, { ...newBody, slug: 'subject-largo', firstAdmin: long })).status
		).toBe(400);
		const ok = { ...long, subject: 'a'.repeat(64) };
		expect(
			(await post(diputacion, { ...newBody, slug: 'subject-justo', firstAdmin: ok })).status
		).toBe(201);
	});

	it.each(['api', 'auth', 'simulador', 'admin', 'conserxeria', 'entrar'])(
		'slug reservado %s → 409 SLUG_TAKEN',
		async (slug) => {
			const res = await post(diputacion, { ...newBody, slug });
			expect(res.status).toBe(409);
			expect((await res.json()).error).toBe('SLUG_TAKEN');
		}
	);

	it('slug repetido → 409; cuerpo inválido → 400', async () => {
		const res = await post(diputacion, newBody);
		expect(res.status).toBe(409);
		expect((await res.json()).error).toBe('SLUG_TAKEN');
		expect((await post(diputacion, { ...newBody, province: 'Madrid' })).status).toBe(400);
		expect((await post(diputacion, { ...newBody, slug: 'Mal Slug' })).status).toBe(400);
		const broken = await onboard(
			ev(diputacion, {}, 'http://localhost/', { method: 'POST', body: undefined })
		);
		expect(broken.status).toBe(400);
	});

	it('una persona normal y un admin de concello → 403, sin sesión → 401', async () => {
		const url = 'http://localhost/?from=2026-11-16&to=2026-11-22';
		expect((await post(vecina, { ...newBody, slug: 'otro' })).status).toBe(403);
		expect((await post(admin, { ...newBody, slug: 'otro' })).status).toBe(403);
		expect((await post(null, newBody)).status).toBe(401);
		expect((await compare(ev(vecina, {}, url))).status).toBe(403);
		expect((await compare(ev(null, {}, url))).status).toBe(401);
	});

	it('comparativa: solo agregados por concello', async () => {
		const url = 'http://localhost/?from=2026-11-16&to=2026-11-22';
		const res = await compare(ev(diputacion, {}, url));
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain('displayName');
		expect(text).not.toContain(vecina.displayName);
		const data = JSON.parse(text) as {
			slug: string;
			name: string;
			facilities: number;
			bookings: number;
			avgOccupancy: number;
			noShowRate: number;
		}[];
		const riba = data.find((m) => m.slug === 'ribadavila')!;
		expect(riba).toMatchObject({
			name: 'Ribadávila',
			facilities: 1,
			bookings: 2,
			avgOccupancy: 0.022,
			noShowRate: 0.5
		});
		const monte = data.find((m) => m.slug === 'montemaior-do-rio')!;
		expect(monte).toMatchObject({ facilities: 1, bookings: 0, avgOccupancy: 0, noShowRate: 0 });
		expect(Object.keys(riba).sort()).toEqual([
			'avgOccupancy',
			'bookings',
			'facilities',
			'id',
			'name',
			'noShowRate',
			'openFacilities',
			'province',
			'slug'
		]);
	});

	it('la deputación no puede usar admin/export de Ribadávila → 403', async () => {
		expect((await exportJson(ev(diputacion, { slug: 'ribadavila' }))).status).toBe(403);
	});
});
