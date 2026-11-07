// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	facilities,
	facilityTypes,
	municipalityProfiles,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { FIXTURE_PRICES, seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import {
	requireDeputacion,
	requireMunicipality,
	requireStaff,
	requireUser
} from '../../../lib/server/http/guards';
import { GET as me, PATCH as patchMe } from './me/+server';
import { GET as summary } from './m/[slug]/me/summary/+server';
import { GET as myBookings } from './m/[slug]/me/bookings/+server';
import { POST as create } from './m/[slug]/bookings/+server';
import { POST as cancel } from './m/[slug]/bookings/[id]/cancel/+server';
import { POST as reschedule } from './m/[slug]/bookings/[id]/reschedule/+server';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const SLOT = '2026-11-24T18:00:00+01:00';
const SLOT2 = '2026-11-24T19:00:00+01:00';

let db: Db;
let fx: Fixture;
let uxia: { id: string; displayName: string };
let brais: { id: string; displayName: string };
let carme: { id: string; displayName: string };

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [c] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'carme', displayName: 'Rebeca Nova' })
		.returning();
	carme = { id: c.id, displayName: c.displayName };
	const [r] = await db.select().from(users).where(eq(users.id, fx.userId));
	uxia = { id: r.id, displayName: r.displayName };
	const [p] = await db
		.select({ u: users })
		.from(municipalityProfiles)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(eq(municipalityProfiles.id, fx.residentProfileId));
	brais = { id: p.u.id, displayName: p.u.displayName };
});

beforeEach(async () => {
	await db.delete(bookings);
	await db
		.update(municipalityProfiles)
		.set({ penaltyUntil: null })
		.where(eq(municipalityProfiles.id, fx.profileId));
	await db
		.delete(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.municipalityId, fx.otherMunicipalityId),
				eq(municipalityProfiles.userId, uxia.id)
			)
		);
});

type U = { id: string; displayName: string } | null;
const post = (
	handler: (e: never) => Promise<Response> | Response,
	slug: string,
	user: U,
	extra: { id?: string; body?: unknown; rawBody?: string } = {}
) =>
	handler(
		makeEvent({
			db,
			now: NOW,
			user,
			method: 'POST',
			params: extra.id ? { slug, id: extra.id } : { slug },
			body: extra.body,
			rawBody: extra.rawBody
		}) as never
	);
const book = (slug: string, user: U, facilityId: string, startsAt = SLOT) =>
	post(create, slug, user, { body: { facilityId, startsAt } });
const bookedId = async (slug: string, user: U, facilityId: string, startsAt = SLOT) =>
	((await (await book(slug, user, facilityId, startsAt)).json()) as { id: string }).id;
const statusOf = async (id: string) =>
	(await db.select().from(bookings).where(eq(bookings.id, id)))[0].status;

describe('guardas', () => {
	it('requireUser: 401 sin sesión, usuario con sesión', async () => {
		const res = requireUser(makeEvent({ db }));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(401);
		expect(await (res as Response).json()).toEqual({ error: 'UNAUTHENTICATED' });
		expect(requireUser(makeEvent({ db, user: uxia }))).toEqual(uxia);
	});

	it('requireMunicipality: 404 desconocido, 400 mal formado, fila si existe', async () => {
		const bad = await requireMunicipality(makeEvent({ db, params: { slug: 'nope' } }));
		expect((bad as Response).status).toBe(404);
		const malformed = await requireMunicipality(makeEvent({ db, params: { slug: 'No Vale!' } }));
		expect((malformed as Response).status).toBe(400);
		const ok = await requireMunicipality(makeEvent({ db, params: { slug: 'ribadavila' } }));
		expect((ok as { id: string }).id).toBe(fx.municipalityId);
	});

	it('requireStaff: 401, 403, admin cumple conserxe, conserxe no cumple admin, otro concello, deputacion no cuenta', async () => {
		await db.insert(staffRoles).values([
			{ userId: uxia.id, municipalityId: fx.municipalityId, role: 'conserxe' },
			{ userId: brais.id, municipalityId: fx.municipalityId, role: 'admin' },
			{ userId: carme.id, municipalityId: null, role: 'deputacion' }
		]);
		const ev = (user: U) => makeEvent({ db, user });
		const status = async (user: U, muni: string, roles: ('admin' | 'conserxe')[]) => {
			const r = await requireStaff(ev(user), muni, roles);
			return r instanceof Response ? r.status : 200;
		};
		expect(await status(null, fx.municipalityId, ['conserxe'])).toBe(401);
		expect(await status(uxia, fx.municipalityId, ['conserxe'])).toBe(200);
		expect(await status(uxia, fx.municipalityId, ['admin'])).toBe(403);
		expect(await status(uxia, fx.otherMunicipalityId, ['conserxe', 'admin'])).toBe(403);
		expect(await status(brais, fx.municipalityId, ['conserxe'])).toBe(200);
		expect(await status(brais, fx.municipalityId, ['admin'])).toBe(200);
		expect(await status(brais, fx.otherMunicipalityId, ['conserxe'])).toBe(403);
		expect(await status(carme, fx.municipalityId, ['conserxe', 'admin'])).toBe(403);
	});

	it('requireDeputacion: solo el rol provincial', async () => {
		const status = async (user: U) => {
			const r = await requireDeputacion(makeEvent({ db, user }));
			return r instanceof Response ? r.status : 200;
		};
		expect(await status(null)).toBe(401);
		expect(await status(carme)).toBe(200);
		expect(await status(brais)).toBe(403);
		expect(await status(uxia)).toBe(403);
	});
});

describe('GET /api/v1/me', () => {
	it('sin sesión 401', async () => {
		expect((await me(makeEvent({ db }) as never)).status).toBe(401);
	});
	it('devuelve usuario, perfiles y roles con slug', async () => {
		const res = await me(makeEvent({ db, user: uxia }) as never);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			user: unknown;
			profiles: unknown[];
			roles: { municipalitySlug: string | null; role: string }[];
		};
		expect(body.user).toEqual(uxia);
		expect(body.profiles).toEqual([
			{ municipalitySlug: 'ribadavila', isResident: false, penaltyUntil: null }
		]);
		expect(body.roles).toEqual([{ municipalitySlug: 'ribadavila', role: 'conserxe' }]);
		const dep = await me(makeEvent({ db, user: carme }) as never);
		expect(((await dep.json()) as { roles: unknown[] }).roles).toEqual([
			{ municipalitySlug: null, role: 'deputacion' }
		]);
	});
});

describe('POST /m/[slug]/bookings', () => {
	it('sin sesión 401', async () => {
		expect((await book('ribadavila', null, fx.facilityId)).status).toBe(401);
	});

	it('primera reserva en Montemaior: perfil no empadronado y precio de no empadronado', async () => {
		const res = await book('montemaior-do-rio', uxia, fx.otherFacilityId);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { priceCents: number; accessCode: string; channel: string };
		expect(body.priceCents).toBe(FIXTURE_PRICES.priceNonResidentCents);
		expect(body.accessCode).toMatch(/^\d{4}$/);
		expect(body.channel).toBe('online');
		const [p] = await db
			.select()
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.municipalityId, fx.otherMunicipalityId),
					eq(municipalityProfiles.userId, uxia.id)
				)
			);
		expect(p.isResident).toBe(false);
	});

	it('empadronado de Ribadávila paga precio de empadronado', async () => {
		const res = await book('ribadavila', brais, fx.facilityId);
		expect(res.status).toBe(201);
		expect(((await res.json()) as { priceCents: number }).priceCents).toBe(
			FIXTURE_PRICES.priceResidentCents
		);
	});

	it('SLOT_UNAVAILABLE 409', async () => {
		expect((await book('ribadavila', brais, fx.facilityId)).status).toBe(201);
		const res = await book('ribadavila', uxia, fx.facilityId);
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: 'SLOT_UNAVAILABLE' });
	});

	it('NOT_ALIGNED 422', async () => {
		const res = await book('ribadavila', uxia, fx.facilityId, '2026-11-24T18:30:00+01:00');
		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ error: 'NOT_ALIGNED' });
	});

	it('perfil penalizado 403 PENALIZED', async () => {
		await db
			.update(municipalityProfiles)
			.set({ penaltyUntil: new Date('2026-12-31T00:00:00Z') })
			.where(eq(municipalityProfiles.id, fx.profileId));
		const res = await book('ribadavila', uxia, fx.facilityId);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'PENALIZED' });
	});

	it('instalación de otro concello 404', async () => {
		expect((await book('ribadavila', uxia, fx.otherFacilityId)).status).toBe(404);
	});

	it('entrada mal formada 400 VALIDATION_FAILED', async () => {
		const cases: { body?: unknown; rawBody?: string }[] = [
			{ body: { facilityId: fx.facilityId, startsAt: '2026-11-24T18:00:00' } },
			{ body: { facilityId: 'no-uuid', startsAt: SLOT } },
			{ body: { facilityId: fx.facilityId, startsAt: SLOT, unitIndex: -1 } },
			{ body: { facilityId: fx.facilityId, startsAt: SLOT, seats: 0 } },
			{ rawBody: '' },
			{ rawBody: '{roto' }
		];
		for (const c of cases) {
			const res = await post(create, 'ribadavila', uxia, c);
			expect(res.status).toBe(400);
			expect(((await res.json()) as { error: string }).error).toBe('VALIDATION_FAILED');
		}
		expect((await post(create, 'No Vale', uxia, { body: {} })).status).toBe(400);
		expect(
			(await post(create, 'nope', uxia, { body: { facilityId: fx.facilityId, startsAt: SLOT } }))
				.status
		).toBe(404);
	});
});

describe('cancel y reschedule', () => {
	it('cancelar la reserva propia', async () => {
		const id = await bookedId('ribadavila', uxia, fx.facilityId);
		const res = await post(cancel, 'ribadavila', uxia, { id });
		expect(res.status).toBe(200);
		expect(await statusOf(id)).toBe('cancelled');
	});

	it('cancelar la reserva de otra persona 404 y sigue confirmed', async () => {
		const id = await bookedId('ribadavila', brais, fx.facilityId);
		for (const intruder of [uxia, carme]) {
			const res = await post(cancel, 'ribadavila', intruder, { id });
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
		}
		expect(await statusOf(id)).toBe('confirmed');
	});

	it('cancelar con el slug de otro concello 404 y sigue confirmed', async () => {
		const id = await bookedId('ribadavila', uxia, fx.facilityId);
		const res = await post(cancel, 'montemaior-do-rio', uxia, { id });
		expect(res.status).toBe(404);
		expect(await statusOf(id)).toBe('confirmed');
	});

	it('cancel: 401 sin sesión, 400 con id que no es uuid', async () => {
		expect((await post(cancel, 'ribadavila', null, { id: fx.facilityId })).status).toBe(401);
		const res = await post(cancel, 'ribadavila', uxia, { id: 'abc' });
		expect(res.status).toBe(400);
	});

	it('reprogramar a franja libre', async () => {
		const id = await bookedId('ribadavila', uxia, fx.facilityId);
		const res = await post(reschedule, 'ribadavila', uxia, { id, body: { startsAt: SLOT2 } });
		expect(res.status).toBe(200);
		const moved = (await res.json()) as { id: string; startsAt: string };
		expect(new Date(moved.startsAt).toISOString()).toBe(new Date(SLOT2).toISOString());
		expect(await statusOf(id)).toBe('cancelled');
	});

	it('reprogramar a hora ocupada 409 y la original sigue igual', async () => {
		const mine = await bookedId('ribadavila', uxia, fx.facilityId);
		await bookedId('ribadavila', brais, fx.facilityId, SLOT2);
		const res = await post(reschedule, 'ribadavila', uxia, { id: mine, body: { startsAt: SLOT2 } });
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: 'SLOT_UNAVAILABLE' });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, mine));
		expect(row.status).toBe('confirmed');
		expect(row.startsAt.toISOString()).toBe(new Date(SLOT).toISOString());
		const all = await db.select().from(bookings).where(eq(bookings.profileId, fx.profileId));
		expect(all).toHaveLength(1);
	});

	it('reprogramar la reserva de otra persona 404; cuerpo mal formado 400', async () => {
		const id = await bookedId('ribadavila', brais, fx.facilityId);
		expect(
			(await post(reschedule, 'ribadavila', uxia, { id, body: { startsAt: SLOT2 } })).status
		).toBe(404);
		expect(await statusOf(id)).toBe('confirmed');
		expect(
			(await post(reschedule, 'ribadavila', uxia, { id, body: { startsAt: '2026-11-24T19:00' } }))
				.status
		).toBe(400);
		expect((await post(reschedule, 'ribadavila', uxia, { id, rawBody: '' })).status).toBe(400);
		expect(
			(await post(reschedule, 'ribadavila', null, { id, body: { startsAt: SLOT2 } })).status
		).toBe(401);
	});
});

describe('GET /m/[slug]/me/bookings', () => {
	const list = (slug: string, user: U, scope?: string) =>
		myBookings(
			makeEvent({
				db,
				now: NOW,
				user,
				params: { slug },
				url: `http://localhost/x${scope ? `?scope=${scope}` : ''}`
			}) as never
		);

	it('sin sesión 401; scope inválido 400; slug desconocido 404', async () => {
		expect((await list('ribadavila', null)).status).toBe(401);
		expect((await list('ribadavila', uxia, 'todo')).status).toBe(400);
		expect((await list('nope', uxia)).status).toBe(404);
	});

	it('solo las del usuario y del concello del slug, con instalación, mascota y color', async () => {
		const a = await bookedId('ribadavila', uxia, fx.facilityId);
		await bookedId('ribadavila', brais, fx.facilityId, SLOT2);
		await bookedId('montemaior-do-rio', uxia, fx.otherFacilityId);
		const res = await list('ribadavila', uxia, 'upcoming');
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			id: string;
			facilityName: string;
			mascot: string;
			color: string;
		}[];
		expect(body.map((b) => b.id)).toEqual([a]);
		expect(body[0]).toMatchObject({ facilityName: 'Pista 1', mascot: 'padel', color: '#1d4ed8' });
		expect(((await (await list('ribadavila', uxia)).json()) as unknown[]).length).toBe(1);
		expect(((await (await list('ribadavila', uxia, 'past')).json()) as unknown[]).length).toBe(0);
		expect(((await (await list('ribadavila', carme)).json()) as unknown[]).length).toBe(0);
	});

	it('orden ascendente en upcoming y descendente en past', async () => {
		const first = await bookedId('ribadavila', uxia, fx.facilityId, SLOT);
		const second = await bookedId('ribadavila', uxia, fx.facilityId, SLOT2);
		const ids = async (scope: string, now: Date) =>
			(
				(await (
					await myBookings(
						makeEvent({
							db,
							now,
							user: uxia,
							params: { slug: 'ribadavila' },
							url: `http://localhost/x?scope=${scope}`
						}) as never
					)
				).json()) as { id: string }[]
			).map((b) => b.id);
		expect(await ids('upcoming', NOW)).toEqual([first, second]);
		expect(await ids('past', new Date('2026-11-25T00:00:00+01:00'))).toEqual([second, first]);
	});
});

describe('listMyBookings: canceladas', () => {
	const list = (scope: string) =>
		myBookings(
			makeEvent({
				db,
				now: NOW,
				user: uxia,
				params: { slug: 'ribadavila' },
				url: `http://localhost/x?scope=${scope}`
			}) as never
		);

	it('upcoming non inclúe unha cancelada e past si, con tipo, lugar e enderezo', async () => {
		await db
			.update(facilities)
			.set({ location: 'Polideportivo', address: 'Rúa do Campo, 1' })
			.where(eq(facilities.id, fx.facilityId));
		const kept = await bookedId('ribadavila', uxia, fx.facilityId, SLOT);
		const gone = await bookedId('ribadavila', uxia, fx.facilityId, SLOT2);
		expect((await post(cancel, 'ribadavila', uxia, { id: gone })).status).toBe(200);
		const up = (await (await list('upcoming')).json()) as Record<string, unknown>[];
		expect(up.map((b) => b.id)).toEqual([kept]);
		expect(up[0]).toMatchObject({
			typeId: fx.typeId,
			facilityLocation: 'Polideportivo',
			facilityAddress: 'Rúa do Campo, 1',
			mascot: 'padel'
		});
		const past = (await (await list('past')).json()) as { id: string; status: string }[];
		expect(past.map((b) => [b.id, b.status])).toEqual([[gone, 'cancelled']]);
	});
});

describe('PATCH /api/v1/me', () => {
	const patch = (user: U, body: unknown) =>
		patchMe(makeEvent({ db, now: NOW, user, method: 'PATCH', body }) as never);

	it('sen sesión 401', async () => {
		expect((await patch(null, { phone: '600' })).status).toBe(401);
	});

	it('un email non válido é 400; un phone válido é 200 e persiste', async () => {
		const bad = await patch(carme, { email: 'non-é-un-correo' });
		expect(bad.status).toBe(400);
		expect((await bad.json()).error).toBe('VALIDATION_FAILED');
		expect((await patch(carme, { email: `${'a'.repeat(195)}@x.gal` })).status).toBe(400);
		expect((await patch(carme, { phone: '6'.repeat(41) })).status).toBe(400);

		const res = await patch(carme, { phone: '600 222 333' });
		expect(res.status).toBe(200);
		const out = (await res.json()) as Record<string, unknown>;
		expect(out).toMatchObject({ id: carme.id, phone: '600 222 333', email: null });
		expect(out).not.toHaveProperty('subject');
		const [row] = await db.select().from(users).where(eq(users.id, carme.id));
		expect(row.phone).toBe('600 222 333');
	});

	it('email válido gárdase e null bórrao; os campos ausentes non cambian', async () => {
		await patch(carme, { phone: '600 222 333' });
		expect((await patch(carme, { email: 'carme@example.org' })).status).toBe(200);
		let [row] = await db.select().from(users).where(eq(users.id, carme.id));
		expect(row).toMatchObject({ email: 'carme@example.org', phone: '600 222 333' });
		expect((await patch(carme, { email: null })).status).toBe(200);
		[row] = await db.select().from(users).where(eq(users.id, carme.id));
		expect(row).toMatchObject({ email: null, phone: '600 222 333' });
	});
});

describe('GET /m/[slug]/me/summary', () => {
	const get = (slug: string, user: U, now = new Date('2026-11-25T12:00:00+01:00')) =>
		summary(makeEvent({ db, now, user, params: { slug } }) as never);

	const insert = async (localStart: string, status: string, facilityId = fx.facilityId) => {
		const startsAt = new Date(`${localStart}+01:00`);
		await db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId,
			profileId: fx.profileId,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3_600_000),
			status: status as 'attended',
			accessCode: '111111',
			priceCents: 600,
			channel: 'online',
			createdByUserId: uxia.id
		});
	};

	it('sen sesión 401; slug descoñecido 404', async () => {
		expect((await get('ribadavila', null)).status).toBe(401);
		expect((await get('nope', uxia)).status).toBe(404);
	});

	it('racha, reservas deste ano e deporte favorito coherentes', async () => {
		const [pool] = await db
			.insert(facilityTypes)
			.values({
				municipalityId: fx.municipalityId,
				nameGl: 'Piscina',
				nameEs: 'Piscina',
				mascot: 'natacion',
				color: '#0ea5e9',
				bookingMode: 'capacity'
			})
			.returning();
		const [piscina] = await db
			.insert(facilities)
			.values({
				municipalityId: fx.municipalityId,
				typeId: pool.id,
				name: 'Piscina cuberta',
				capacity: 20,
				priceResidentCents: 200,
				priceNonResidentCents: 400
			})
			.returning();
		await db
			.update(users)
			.set({ email: 'uxia@example.org', phone: '600999000' })
			.where(eq(users.id, uxia.id));
		// Pádel: 2 non canceladas (18/11 e 11/11) + 1 cancelada; piscina: 2 non canceladas, a máis
		// recente o 04/11, e unha de 2025 que non conta no ano.
		await insert('2026-11-18T18:00:00', 'attended');
		await insert('2026-11-11T18:00:00', 'attended');
		await insert('2026-11-20T18:00:00', 'cancelled');
		await insert('2026-11-04T18:00:00', 'attended', piscina.id);
		await insert('2025-12-30T18:00:00', 'attended', piscina.id);

		const res = await get('ribadavila', uxia);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			displayName: 'Nerea Veciña',
			provider: 'local',
			email: 'uxia@example.org',
			phone: '600999000',
			isResident: false,
			residencyDeclaredAt: null,
			socialTariff: null,
			avatarKey: null,
			hasAvatarPhoto: false,
			onboardedAt: null,
			penaltyUntil: null,
			streak: 3,
			bookingsThisYear: 3,
			favouriteTypeId: fx.typeId
		});
	});

	it('empate no favorito: gaña o tipo coa reserva máis recente', async () => {
		const [pool] = await db
			.insert(facilityTypes)
			.values({
				municipalityId: fx.municipalityId,
				nameGl: 'Ximnasio',
				nameEs: 'Gimnasio',
				mascot: 'ximnasio',
				color: '#334155',
				bookingMode: 'capacity'
			})
			.returning();
		const [gym] = await db
			.insert(facilities)
			.values({
				municipalityId: fx.municipalityId,
				typeId: pool.id,
				name: 'Ximnasio',
				capacity: 20,
				priceResidentCents: 200,
				priceNonResidentCents: 400
			})
			.returning();
		await insert('2026-11-04T18:00:00', 'attended');
		await insert('2026-11-11T18:00:00', 'attended', gym.id);
		const body = (await (await get('ribadavila', uxia)).json()) as { favouriteTypeId: string };
		expect(body.favouriteTypeId).toBe(pool.id);
	});

	it('penalización vixente devólvese; sen perfil no concello todo baleiro', async () => {
		await db
			.update(municipalityProfiles)
			.set({ penaltyUntil: new Date('2026-11-30T00:00:00+01:00') })
			.where(eq(municipalityProfiles.id, fx.profileId));
		const body = (await (await get('ribadavila', uxia)).json()) as { penaltyUntil: string };
		expect(body.penaltyUntil).toBe('2026-11-29T23:00:00.000Z');
		const none = await (await get('montemaior-do-rio', carme)).json();
		expect(none).toMatchObject({
			displayName: 'Rebeca Nova',
			isResident: false,
			penaltyUntil: null,
			streak: 0,
			bookingsThisYear: 0,
			favouriteTypeId: null
		});
	});
});
