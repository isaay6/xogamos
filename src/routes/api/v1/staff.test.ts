// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	facilities,
	municipalityProfiles,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { POST as residentCancel } from './m/[slug]/bookings/[id]/cancel/+server';
import { GET as agenda } from './m/[slug]/staff/agenda/+server';
import { GET as searchPeople, POST as createPerson } from './m/[slug]/staff/people/+server';
import { POST as staffBook } from './m/[slug]/staff/bookings/+server';
import { POST as staffCancel } from './m/[slug]/staff/bookings/[id]/cancel/+server';
import { POST as staffNoShow } from './m/[slug]/staff/bookings/[id]/no-show/+server';
import { POST as validateCode } from './m/[slug]/staff/access-codes/validate/+server';
import { POST as staffAttended } from './m/[slug]/staff/bookings/[id]/attended/+server';
import { searchPeople as searchPeopleService } from '../../../lib/server/services/staff';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const SLOT = '2026-11-24T18:00:00+01:00';
const DAY = '2026-11-24';

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let conserje: U;
let montemaiorConserje: U;
let depu: U;
let vecina: U;

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
	conserje = await mkUser('conserje', 'Conserxe Ribadávila');
	montemaiorConserje = await mkUser('conserje-m', 'Conserxe Montemaior');
	depu = await mkUser('depu', 'Deputación');
	const [v] = await db.select().from(users).where(eq(users.id, fx.userId));
	vecina = { id: v.id, displayName: v.displayName };
	await db.insert(staffRoles).values([
		{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: montemaiorConserje.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' },
		{ userId: depu.id, municipalityId: null, role: 'deputacion' }
	]);
});

beforeEach(async () => {
	await db.delete(bookings);
});

type Extra = {
	now?: Date;
	id?: string;
	body?: unknown;
	rawBody?: string;
	url?: string;
};
const call = (
	handler: (e: never) => Promise<Response> | Response,
	slug: string,
	user: U | null,
	method: 'GET' | 'POST',
	extra: Extra = {}
) =>
	handler(
		makeEvent({
			db,
			now: extra.now ?? NOW,
			user,
			method,
			url: extra.url,
			params: extra.id ? { slug, id: extra.id } : { slug },
			body: extra.body,
			rawBody: extra.rawBody
		}) as never
	);

const phoneBooking = async (profileId: string) => {
	const res = await call(staffBook, 'ribadavila', conserje, 'POST', {
		body: { profileId, facilityId: fx.facilityId, startsAt: SLOT, channel: 'phone' }
	});
	expect(res.status).toBe(201);
	return (await res.json()) as { id: string; accessCode: string; createdByUserId: string };
};

describe('acceso del personal', () => {
	const routes: [string, (s: string, u: U | null) => Promise<Response> | Response][] = [
		['agenda', (s, u) => call(agenda, s, u, 'GET', { url: `http://localhost/?date=${DAY}` })],
		['people GET', (s, u) => call(searchPeople, s, u, 'GET', { url: 'http://localhost/?q=ab' })],
		[
			'people POST',
			(s, u) => call(createPerson, s, u, 'POST', { body: { displayName: 'Ana', phone: '600' } })
		],
		[
			'bookings',
			(s, u) =>
				call(staffBook, s, u, 'POST', {
					body: {
						profileId: fx.profileId,
						facilityId: fx.facilityId,
						startsAt: SLOT,
						channel: 'desk'
					}
				})
		],
		[
			'cancel',
			(s, u) => call(staffCancel, s, u, 'POST', { id: '8f14e45f-ceea-467f-a0e6-1f0d6f4f0a11' })
		],
		[
			'no-show',
			(s, u) => call(staffNoShow, s, u, 'POST', { id: '8f14e45f-ceea-467f-a0e6-1f0d6f4f0a11' })
		],
		['validate', (s, u) => call(validateCode, s, u, 'POST', { body: { code: '1234' } })],
		[
			'attended',
			(s, u) => call(staffAttended, s, u, 'POST', { id: '8f14e45f-ceea-467f-a0e6-1f0d6f4f0a11' })
		]
	];

	it.each(routes)('%s: sin sesión 401', async (_n, run) => {
		expect((await run('ribadavila', null)).status).toBe(401);
	});
	it.each(routes)('%s: una persona normal recibe 403', async (_n, run) => {
		const res = await run('ribadavila', vecina);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'FORBIDDEN' });
	});
	it.each(routes)('%s: el conserje de Ribadávila en Montemaior recibe 403', async (_n, run) => {
		expect((await run('montemaior-do-rio', conserje)).status).toBe(403);
	});
	it.each(routes)('%s: el rol deputacion recibe 403', async (_n, run) => {
		expect((await run('ribadavila', depu)).status).toBe(403);
	});
});

describe('reserva telefónica', () => {
	it('crear persona local, buscarla, reservar y verla en la agenda', async () => {
		const created = await call(createPerson, 'ribadavila', conserje, 'POST', {
			body: { displayName: 'Manuela Outeiro', phone: '600123456' }
		});
		expect(created.status).toBe(201);
		const person = (await created.json()) as { profileId: string; displayName: string };
		expect(person.displayName).toBe('Manuela Outeiro');

		for (const q of ['manuela', 'OUTEIRO']) {
			const res = await call(searchPeople, 'ribadavila', conserje, 'GET', {
				url: `http://localhost/?q=${q}`
			});
			expect(res.status).toBe(200);
			const found = (await res.json()) as { profileId: string }[];
			expect(found.map((p) => p.profileId)).toContain(person.profileId);
		}

		const booking = await phoneBooking(person.profileId);
		expect(booking.createdByUserId).toBe(conserje.id);

		const ag = await call(agenda, 'ribadavila', conserje, 'GET', {
			url: `http://localhost/?date=${DAY}`
		});
		expect(ag.status).toBe(200);
		const text = await ag.text();
		expect(text).toContain(booking.id);
		expect(text).toContain('Manuela Outeiro');
		expect(text).toContain('600123456');
		expect(text).toContain('phone');
	});

	it('a axenda trae por instalación e por reserva o que precisa o panel lateral', async () => {
		await db
			.update(facilities)
			.set({ location: 'Polideportivo municipal' })
			.where(eq(facilities.id, fx.facilityId));
		const booking = await phoneBooking(fx.profileId);
		const ag = await call(agenda, 'ribadavila', conserje, 'GET', {
			url: `http://localhost/?date=${DAY}`
		});
		const body = (await ag.json()) as Record<string, unknown>[];
		const group = body.find((g) => g.facilityId === fx.facilityId)!;
		expect(group).toMatchObject({
			facilityName: 'Pista 1',
			location: 'Polideportivo municipal',
			mascot: 'padel',
			color: '#1d4ed8',
			bookingMode: 'slot',
			units: 1
		});
		expect((group.bookings as Record<string, unknown>[])[0]).toMatchObject({
			id: booking.id,
			accessCode: booking.accessCode,
			priceCents: 600,
			isResident: false,
			noShowCount: 0
		});
	});

	it('searchPeople atopa por teléfono comparando só cifras', async () => {
		const [u] = await db
			.insert(users)
			.values({
				provider: 'local',
				subject: 'tel-600111222',
				displayName: 'Xosé Telefónico',
				phone: '600111222'
			})
			.returning();
		await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.municipalityId, userId: u.id });
		const found = await searchPeopleService(db, fx.municipalityId, '600 11');
		expect(found.map((p) => p.userId)).toEqual([u.id]);
		// Con menos de 3 cifras non se compara o teléfono.
		expect(await searchPeopleService(db, fx.municipalityId, '60')).toEqual([]);
		const res = await call(searchPeople, 'ribadavila', conserje, 'GET', {
			url: `http://localhost/?q=${encodeURIComponent('600 111 222')}`
		});
		expect(((await res.json()) as { userId: string }[]).map((p) => p.userId)).toEqual([u.id]);
	});

	it('la búsqueda ignora tildes y mayúsculas, y no cruza concellos', async () => {
		const res = await call(searchPeople, 'ribadavila', conserje, 'GET', {
			url: `http://localhost/?q=${encodeURIComponent('VECINA')}`
		});
		const found = (await res.json()) as { displayName: string }[];
		expect(found.map((p) => p.displayName)).toContain('Nerea Veciña');
		const other = await call(searchPeople, 'montemaior-do-rio', montemaiorConserje, 'GET', {
			url: `http://localhost/?q=manuela`
		});
		expect(await other.json()).toEqual([]);
	});

	it('q de un solo carácter es 400', async () => {
		const res = await call(searchPeople, 'ribadavila', conserje, 'GET', {
			url: 'http://localhost/?q=a'
		});
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('VALIDATION_FAILED');
	});

	it('reservar para un perfil de otro concello es 404', async () => {
		const res = await call(staffBook, 'montemaior-do-rio', montemaiorConserje, 'POST', {
			body: {
				profileId: fx.profileId,
				facilityId: fx.otherFacilityId,
				startsAt: SLOT,
				channel: 'phone'
			}
		});
		expect(res.status).toBe(404);
	});

	it('cuerpo mal formado es 400', async () => {
		const res = await call(staffBook, 'ribadavila', conserje, 'POST', { rawBody: '{' });
		expect(res.status).toBe(400);
		const bad = await call(staffBook, 'ribadavila', conserje, 'POST', {
			body: { profileId: 'x', facilityId: fx.facilityId, startsAt: SLOT, channel: 'online' }
		});
		expect(bad.status).toBe(400);
		const date = await call(agenda, 'ribadavila', conserje, 'GET', {
			url: 'http://localhost/?date=2026-02-30'
		});
		expect(date.status).toBe(400);
	});
});

describe('cancelación, ausencia y códigos', () => {
	it('el personal cancela dentro del plazo cuando la vecina recibiría TOO_LATE_TO_CANCEL', async () => {
		const booking = await phoneBooking(fx.profileId);
		const late = new Date('2026-11-24T17:00:00+01:00');
		const resident = await call(residentCancel, 'ribadavila', vecina, 'POST', {
			id: booking.id,
			now: late
		});
		expect(resident.status).toBe(422);
		expect((await resident.json()).error).toBe('TOO_LATE_TO_CANCEL');
		const missing = await call(staffCancel, 'ribadavila', conserje, 'POST', {
			id: booking.id,
			now: late,
			body: {}
		});
		expect(missing.status).toBe(400);
		expect((await missing.json()).error).toBe('VALIDATION_FAILED');
		const res = await call(staffCancel, 'ribadavila', conserje, 'POST', {
			id: booking.id,
			now: late,
			body: { reason: 'Pista mollada' }
		});
		expect(res.status).toBe(200);
		expect((await res.json()).status).toBe('cancelled');
	});

	it('cancelar una reserva de otro concello es 404', async () => {
		const booking = await phoneBooking(fx.profileId);
		const res = await call(staffCancel, 'montemaior-do-rio', montemaiorConserje, 'POST', {
			id: booking.id,
			body: { reason: 'Proba' }
		});
		expect(res.status).toBe(404);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
		expect(row.status).toBe('confirmed');
	});

	it('no-show tras el inicio marca la ausencia; antes del inicio es 422', async () => {
		const booking = await phoneBooking(fx.profileId);
		const early = await call(staffNoShow, 'ribadavila', conserje, 'POST', { id: booking.id });
		expect(early.status).toBe(422);
		expect((await early.json()).error).toBe('NOT_STARTED');
		const res = await call(staffNoShow, 'ribadavila', conserje, 'POST', {
			id: booking.id,
			now: new Date('2026-11-24T19:30:00+01:00')
		});
		expect(res.status).toBe(200);
		expect((await res.json()).status).toBe('no_show');
	});
});

describe('validar código (sen efectos) e marcar chegada', () => {
	const TODAY = new Date('2026-11-24T10:00:00+01:00');
	const CODE = '4821';
	let pista2: string;
	let montemaiorProfile: string;

	beforeAll(async () => {
		const [f] = await db
			.insert(facilities)
			.values({
				municipalityId: fx.municipalityId,
				typeId: fx.typeId,
				name: 'Pista 2',
				priceResidentCents: 300,
				priceNonResidentCents: 600
			})
			.returning();
		pista2 = f.id;
		const [p] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.otherMunicipalityId, userId: vecina.id })
			.returning();
		montemaiorProfile = p.id;
	});

	const insert = async (
		over: Partial<typeof bookings.$inferInsert> & { startsAt: Date }
	): Promise<string> => {
		const [row] = await db
			.insert(bookings)
			.values({
				municipalityId: fx.municipalityId,
				facilityId: fx.facilityId,
				profileId: fx.profileId,
				endsAt: new Date(over.startsAt.getTime() + 3_600_000),
				accessCode: CODE,
				priceCents: 600,
				channel: 'desk',
				createdByUserId: conserje.id,
				...over
			})
			.returning();
		return row.id;
	};
	const validate = (code: string, slug = 'ribadavila', user: U = conserje) =>
		call(validateCode, slug, user, 'POST', { now: TODAY, body: { code } });
	const at = (iso: string) => new Date(iso);

	it('un código de hoxe na Pista 1 → 1 coincidencia; sen cambiar o estado', async () => {
		const id = await insert({ startsAt: at('2026-11-24T18:00:00+01:00') });
		const res = await validate(CODE);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { matches: Record<string, unknown>[] };
		expect(body.matches).toHaveLength(1);
		expect(body.matches[0]).toEqual({
			bookingId: id,
			facilityName: 'Pista 1',
			mascot: 'padel',
			startsAt: '2026-11-24T17:00:00.000Z',
			endsAt: '2026-11-24T18:00:00.000Z',
			unitIndex: null,
			displayName: 'Nerea Veciña',
			priceCents: 600
		});
		const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
		expect(row.status).toBe('confirmed');
	});

	it('o mesmo código noutra instalación hoxe → 2 coincidencias', async () => {
		await insert({ startsAt: at('2026-11-24T18:00:00+01:00') });
		await insert({ startsAt: at('2026-11-24T19:00:00+01:00'), facilityId: pista2 });
		const body = (await (await validate(CODE)).json()) as {
			matches: { facilityName: string }[];
		};
		expect(body.matches.map((m) => m.facilityName)).toEqual(['Pista 1', 'Pista 2']);
	});

	it('xa attended hoxe → 422 ALREADY_USED; cancelada hoxe → 422 CANCELLED', async () => {
		await insert({ startsAt: at('2026-11-24T09:00:00+01:00'), status: 'attended' });
		let res = await validate(CODE);
		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ error: 'ALREADY_USED' });
		await db.delete(bookings);
		await insert({ startsAt: at('2026-11-24T18:00:00+01:00'), status: 'cancelled' });
		res = await validate(CODE);
		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ error: 'CANCELLED' });
	});

	it('prioridade: unha confirmed de hoxe gaña a unha attended do mesmo código', async () => {
		await insert({ startsAt: at('2026-11-24T09:00:00+01:00'), status: 'attended' });
		const id = await insert({ startsAt: at('2026-11-24T19:00:00+01:00'), facilityId: pista2 });
		const body = (await (await validate(CODE)).json()) as { matches: { bookingId: string }[] };
		expect(body.matches.map((m) => m.bookingId)).toEqual([id]);
	});

	it('un PIN que só coincide con reservas doutros días → 404 NOT_FOUND (nunca NOT_TODAY)', async () => {
		// O PIN só é único dentro do día: a de mañá pode ser doutra persoa.
		await insert({ startsAt: at('2026-11-26T18:00:00+01:00') });
		await insert({ startsAt: at('2026-11-25T18:00:00+01:00') });
		const res = await validate(CODE);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
	});

	it('123456 sen reservas → 404 NOT_FOUND; un código de onte tamén', async () => {
		await insert({ startsAt: at('2026-11-23T18:00:00+01:00') });
		const res = await validate('1234');
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
		expect((await validate(CODE)).status).toBe(404);
	});

	it('un código de Montemaior baixo Ribadávila → 404', async () => {
		await insert({
			startsAt: at('2026-11-24T18:00:00+01:00'),
			municipalityId: fx.otherMunicipalityId,
			facilityId: fx.otherFacilityId,
			profileId: montemaiorProfile
		});
		expect((await validate(CODE)).status).toBe(404);
		expect((await validate(CODE, 'montemaior-do-rio', montemaiorConserje)).status).toBe(200);
	});

	it("'48 21' con espazo (normal ou fino) acéptase; '482' é 400", async () => {
		await insert({ startsAt: at('2026-11-24T18:00:00+01:00') });
		expect((await validate('48 21')).status).toBe(200);
		expect((await validate('48\u200921')).status).toBe(200);
		expect((await validate('482')).status).toBe(400);
		expect((await validate('482a')).status).toBe(400);
	});

	it('ningunha consulta cambia o estado das reservas', async () => {
		const ids = [
			await insert({ startsAt: at('2026-11-24T18:00:00+01:00') }),
			await insert({ startsAt: at('2026-11-24T09:00:00+01:00'), status: 'attended' }),
			await insert({ startsAt: at('2026-11-24T19:00:00+01:00'), status: 'cancelled' }),
			await insert({ startsAt: at('2026-11-25T18:00:00+01:00') })
		];
		const before = await db.select().from(bookings);
		for (const code of [CODE, '48 21', '1234']) await validate(code);
		const after = await db.select().from(bookings);
		expect(after).toHaveLength(ids.length);
		expect(after.map((b) => [b.id, b.status]).sort()).toEqual(
			before.map((b) => [b.id, b.status]).sort()
		);
	});

	it('marcar chegada: 16 min antes → 422 OUTSIDE_WINDOW; 14 min antes → ok; repetido → 409', async () => {
		const booking = await phoneBooking(fx.profileId);
		const mark = (now: Date, slug = 'ribadavila', user: U = conserje) =>
			call(staffAttended, slug, user, 'POST', { id: booking.id, now });
		const early = await mark(new Date('2026-11-24T17:44:00+01:00'));
		expect(early.status).toBe(422);
		expect(await early.json()).toEqual({ error: 'OUTSIDE_WINDOW' });
		const other = await mark(
			new Date('2026-11-24T17:46:00+01:00'),
			'montemaior-do-rio',
			montemaiorConserje
		);
		expect(other.status).toBe(404);
		const ok = await mark(new Date('2026-11-24T17:46:00+01:00'));
		expect(ok.status).toBe(200);
		expect((await ok.json()).status).toBe('attended');
		const again = await mark(new Date('2026-11-24T17:50:00+01:00'));
		expect(again.status).toBe(409);
		expect(await again.json()).toEqual({ error: 'ALREADY_FINAL' });
	});

	it('marcar chegada vale ata 48 h despois do fin, non máis', async () => {
		const booking = await phoneBooking(fx.profileId);
		const late = await call(staffAttended, 'ribadavila', conserje, 'POST', {
			id: booking.id,
			now: new Date('2026-11-26T19:01:00+01:00')
		});
		expect(late.status).toBe(422);
		const edge = await call(staffAttended, 'ribadavila', conserje, 'POST', {
			id: booking.id,
			now: new Date('2026-11-26T19:00:00+01:00')
		});
		expect(edge.status).toBe(200);
	});
});
