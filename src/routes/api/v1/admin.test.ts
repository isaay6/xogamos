// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	closures,
	municipalityProfiles,
	notifications,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { GET as getSettings, PUT as putSettings } from './m/[slug]/admin/settings/+server';
import { GET as listTypes, POST as createType } from './m/[slug]/admin/facility-types/+server';
import { PUT as putType } from './m/[slug]/admin/facility-types/[id]/+server';
import { GET as listFacilities, POST as createFacility } from './m/[slug]/admin/facilities/+server';
import { PUT as putFacility } from './m/[slug]/admin/facilities/[id]/+server';
import { POST as deactivate } from './m/[slug]/admin/facilities/[id]/deactivate/+server';
import { PUT as putHours } from './m/[slug]/admin/facilities/[id]/hours/+server';
import {
	GET as listClosures,
	POST as createClosure
} from './m/[slug]/admin/facilities/[id]/closures/+server';
import { DELETE as deleteClosure } from './m/[slug]/admin/closures/[id]/+server';
import { PUT as putResidency } from './m/[slug]/admin/profiles/[id]/residency/+server';
import { GET as publicFacilities } from './m/[slug]/facilities/+server';
import { GET as availability } from './m/[slug]/facilities/[id]/availability/+server';
import { POST as book } from './m/[slug]/bookings/+server';
import { GET as listStaff, POST as addStaff } from './m/[slug]/admin/staff/+server';
import { DELETE as removeStaff } from './m/[slug]/admin/staff/[id]/+server';
import { GET as staffCandidates } from './m/[slug]/admin/staff/candidates/+server';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const SLOT = '2026-11-24T18:00:00+01:00';
const DAY = '2026-11-24'; // martes
const UUID = '8f14e45f-ceea-467f-a0e6-1f0d6f4f0a11';

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserje: U;
let vecina: U;
let montemaiorAdmin: U;

/** Perfil de una persona en un concello (Ruling 14: solo así puede ser personal o candidata). */
const mkProfile = (userId: string, municipalityId = fx.municipalityId) =>
	db.insert(municipalityProfiles).values({ municipalityId, userId, isResident: false });

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
	conserje = await mkUser('conserje', 'Conserxe Ribadávila');
	montemaiorAdmin = await mkUser('admin-m', 'Admin Montemaior');
	const [v] = await db.select().from(users).where(eq(users.id, fx.userId));
	vecina = { id: v.id, displayName: v.displayName };
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{
			userId: conserje.id,
			municipalityId: fx.municipalityId,
			role: 'conserxe'
		},
		{
			userId: montemaiorAdmin.id,
			municipalityId: fx.otherMunicipalityId,
			role: 'admin'
		}
	]);
});

type Extra = { id?: string; body?: unknown; rawBody?: string; url?: string };
const call = (
	handler: (e: never) => Promise<Response> | Response,
	user: U | null,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	extra: Extra = {},
	slug = 'ribadavila'
) =>
	handler(
		makeEvent({
			db,
			now: NOW,
			user,
			method,
			url: extra.url,
			params: extra.id ? { slug, id: extra.id } : { slug },
			body: extra.body,
			rawBody: extra.rawBody
		}) as never
	);

const settingsBody = {
	name: 'Ribadávila',
	primaryColor: '#1d4ed8',
	cancellationDeadlineMinutes: 120,
	maxDaysAhead: 14,
	noShowThreshold: 3,
	penaltyDays: 7,
	legalNotice: '',
	privacyPolicy: '',
	usageRules: ''
};
const weekHours = (opens: string, closes: string) =>
	[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes }));

const typeBody = {
	nameGl: 'Rocódromo',
	nameEs: 'Rocódromo',
	mascot: 'escalada',
	color: '#7c3aed',
	bookingMode: 'capacity'
};

const createRocodromo = async () => {
	const t = await call(createType, admin, 'POST', { body: typeBody });
	expect(t.status).toBe(201);
	const type = (await t.json()) as { id: string };
	const f = await call(createFacility, admin, 'POST', {
		body: {
			typeId: type.id,
			name: 'Rocódromo municipal',
			capacity: 12,
			slotMinutes: 60,
			priceResidentCents: 200,
			priceNonResidentCents: 400,
			hours: weekHours('10:00', '20:00')
		}
	});
	expect(f.status).toBe(201);
	return { type, facility: (await f.json()) as { id: string } };
};

describe('acceso', () => {
	const routes: [string, (u: U | null, slug?: string) => Promise<Response> | Response][] = [
		['settings GET', (u, s) => call(getSettings, u, 'GET', {}, s)],
		['settings PUT', (u, s) => call(putSettings, u, 'PUT', { body: settingsBody }, s)],
		['types GET', (u, s) => call(listTypes, u, 'GET', {}, s)],
		['types POST', (u, s) => call(createType, u, 'POST', { body: typeBody }, s)],
		['types PUT', (u, s) => call(putType, u, 'PUT', { id: UUID, body: typeBody }, s)],
		['facilities GET', (u, s) => call(listFacilities, u, 'GET', {}, s)],
		['facilities POST', (u, s) => call(createFacility, u, 'POST', { body: {} }, s)],
		['facilities PUT', (u, s) => call(putFacility, u, 'PUT', { id: UUID, body: {} }, s)],
		['deactivate', (u, s) => call(deactivate, u, 'POST', { id: UUID }, s)],
		['hours', (u, s) => call(putHours, u, 'PUT', { id: UUID, body: { hours: [] } }, s)],
		['closures GET', (u, s) => call(listClosures, u, 'GET', { id: UUID }, s)],
		['closures POST', (u, s) => call(createClosure, u, 'POST', { id: UUID, body: {} }, s)],
		['closures DELETE', (u, s) => call(deleteClosure, u, 'DELETE', { id: UUID }, s)],
		[
			'residency',
			(u, s) => call(putResidency, u, 'PUT', { id: UUID, body: { isResident: true } }, s)
		],
		['staff GET', (u, s) => call(listStaff, u, 'GET', {}, s)],
		[
			'staff POST',
			(u, s) => call(addStaff, u, 'POST', { body: { userId: UUID, role: 'conserxe' } }, s)
		],
		['staff DELETE', (u, s) => call(removeStaff, u, 'DELETE', { id: UUID }, s)],
		[
			'staff candidates',
			(u, s) => call(staffCandidates, u, 'GET', { url: 'http://localhost/?q=ab' }, s)
		]
	];
	it.each(routes)('%s: sin sesión 401', async (_n, run) => {
		expect((await run(null)).status).toBe(401);
	});
	it.each(routes)('%s: el conserje recibe 403', async (_n, run) => {
		const res = await run(conserje);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'FORBIDDEN' });
	});
	it.each(routes)('%s: una persona normal recibe 403', async (_n, run) => {
		expect((await run(vecina)).status).toBe(403);
	});
	it.each(routes)('%s: el admin de otro concello recibe 403', async (_n, run) => {
		expect((await run(montemaiorAdmin)).status).toBe(403);
	});
});

describe('ajustes', () => {
	it('GET devuelve los ajustes y PUT los cambia', async () => {
		const res = await call(getSettings, admin, 'GET');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			name: 'Ribadávila',
			maxDaysAhead: 14
		});
		const put = await call(putSettings, admin, 'PUT', {
			body: { ...settingsBody, maxDaysAhead: 30, penaltyDays: 0 }
		});
		expect(put.status).toBe(200);
		expect(await put.json()).toMatchObject({
			maxDaysAhead: 30,
			penaltyDays: 0
		});
		await call(putSettings, admin, 'PUT', { body: settingsBody });
	});
	it.each([
		['maxDaysAhead 91', { maxDaysAhead: 91 }],
		['maxDaysAhead 0', { maxDaysAhead: 0 }],
		['noShowThreshold 11', { noShowThreshold: 11 }],
		['penaltyDays 91', { penaltyDays: 91 }],
		['plazo 10081', { cancellationDeadlineMinutes: 10081 }],
		['color malformado', { primaryColor: 'azul' }],
		['nombre vacío', { name: '' }]
	])('%s → 400', async (_n, patch) => {
		const res = await call(putSettings, admin, 'PUT', {
			body: { ...settingsBody, ...patch }
		});
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('VALIDATION_FAILED');
	});
	it('JSON roto → 400', async () => {
		const res = await call(putSettings, admin, 'PUT', { rawBody: '{' });
		expect(res.status).toBe(400);
	});
});

describe('textos legales, ubicación y personajes', () => {
	it('PUT settings guarda y devuelve legalNotice, privacyPolicy y usageRules', async () => {
		const put = await call(putSettings, admin, 'PUT', {
			body: {
				...settingsBody,
				legalNotice: 'Texto de exemplo: aviso legal',
				privacyPolicy: 'Texto de exemplo: privacidade',
				usageRules: 'Texto de exemplo: normas'
			}
		});
		expect(put.status).toBe(200);
		expect(await put.json()).toMatchObject({ legalNotice: 'Texto de exemplo: aviso legal' });
		const got = await (await call(getSettings, admin, 'GET')).json();
		expect(got).toMatchObject({
			legalNotice: 'Texto de exemplo: aviso legal',
			privacyPolicy: 'Texto de exemplo: privacidade',
			usageRules: 'Texto de exemplo: normas'
		});
		const tooLong = await call(putSettings, admin, 'PUT', {
			body: { ...settingsBody, legalNotice: 'x'.repeat(20_001) }
		});
		expect(tooLong.status).toBe(400);
		await call(putSettings, admin, 'PUT', { body: settingsBody });
	});

	it('una instalación con location y address las devuelve en el listado', async () => {
		const t = await (await call(createType, admin, 'POST', { body: typeBody })).json();
		const f = await call(createFacility, admin, 'POST', {
			body: {
				typeId: t.id,
				name: 'Frontón da Xunqueira',
				capacity: 10,
				slotMinutes: 60,
				priceResidentCents: 100,
				priceNonResidentCents: 200,
				location: 'Pavillón da Xunqueira',
				address: 'Rúa da Xunqueira, 1'
			}
		});
		expect(f.status).toBe(201);
		const list = (await (await call(listFacilities, admin, 'GET')).json()) as {
			name: string;
			location: string;
			address: string;
		}[];
		expect(list.find((x) => x.name === 'Frontón da Xunqueira')).toMatchObject({
			location: 'Pavillón da Xunqueira',
			address: 'Rúa da Xunqueira, 1'
		});
		const tooLong = await call(createFacility, admin, 'POST', {
			body: {
				typeId: t.id,
				name: 'X',
				capacity: 10,
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0,
				location: 'x'.repeat(121)
			}
		});
		expect(tooLong.status).toBe(400);
	});

	it('PUT de una instalación actualiza location y address', async () => {
		const { facility } = await createRocodromo();
		const cur = (await (await call(listFacilities, admin, 'GET')).json()) as {
			id: string;
			typeId: string;
			name: string;
		}[];
		const row = cur.find((x) => x.id === facility.id)!;
		const res = await call(putFacility, admin, 'PUT', {
			id: facility.id,
			body: {
				typeId: row.typeId,
				name: row.name,
				capacity: 12,
				slotMinutes: 60,
				priceResidentCents: 200,
				priceNonResidentCents: 400,
				location: 'Polideportivo Municipal',
				address: 'Rúa do Deporte, 4'
			}
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			location: 'Polideportivo Municipal',
			address: 'Rúa do Deporte, 4'
		});
	});

	it('un tipo con mascot escalada se crea y uno con pala da 400', async () => {
		expect((await call(createType, admin, 'POST', { body: typeBody })).status).toBe(201);
		const old = await call(createType, admin, 'POST', { body: { ...typeBody, mascot: 'pala' } });
		expect(old.status).toBe(400);
	});
});

describe('rocódromo con aforo', () => {
	it('el admin crea el tipo y la instalación, y la disponibilidad tiene 12 plazas', async () => {
		const { type, facility } = await createRocodromo();

		const types = (await (await call(listTypes, admin, 'GET')).json()) as {
			id: string;
		}[];
		expect(types.map((t) => t.id)).toContain(type.id);

		const pub = await publicFacilities({
			locals: { db },
			params: { slug: 'ribadavila' }
		} as never);
		const list = (await pub.json()) as {
			id: string;
			bookingMode: string;
			mascot: string;
		}[];
		expect(list.find((f) => f.id === facility.id)).toMatchObject({
			bookingMode: 'capacity',
			mascot: 'escalada'
		});

		const av = await availability({
			locals: { db, now: () => NOW },
			params: { slug: 'ribadavila', id: facility.id },
			url: new URL(`http://localhost/?date=${DAY}`)
		} as never);
		expect(av.status).toBe(200);
		const slots = (await av.json()) as {
			remaining?: number;
			capacity?: number;
		}[];
		expect(slots).toHaveLength(10);
		expect(JSON.stringify(slots[0])).toMatch(/12/);
	});

	it('PUT hours reemplaza todo el horario', async () => {
		const { facility } = await createRocodromo();
		const res = await call(putHours, admin, 'PUT', {
			id: facility.id,
			body: { hours: [{ weekday: 1, opens: '16:00', closes: '18:00' }] }
		});
		expect(res.status).toBe(200);
		const av = await availability({
			locals: { db, now: () => NOW },
			params: { slug: 'ribadavila', id: facility.id },
			url: new URL(`http://localhost/?date=${DAY}`)
		} as never);
		expect(await av.json()).toHaveLength(2);
	});

	it('un horario solapado → 422 INVALID_CONFIG con issues y no cambia nada', async () => {
		const { facility } = await createRocodromo();
		const res = await call(putHours, admin, 'PUT', {
			id: facility.id,
			body: {
				hours: [
					{ weekday: 1, opens: '09:00', closes: '13:00' },
					{ weekday: 1, opens: '12:00', closes: '15:00' }
				]
			}
		});
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string; issues: unknown[] };
		expect(body.error).toBe('INVALID_CONFIG');
		expect(body.issues.length).toBeGreaterThan(0);
		const av = await availability({
			locals: { db, now: () => NOW },
			params: { slug: 'ribadavila', id: facility.id },
			url: new URL(`http://localhost/?date=${DAY}`)
		} as never);
		expect(await av.json()).toHaveLength(10);
	});

	it('crear con aforo 1 en modo capacity → 422', async () => {
		const t = await call(createType, admin, 'POST', { body: typeBody });
		const type = (await t.json()) as { id: string };
		const res = await call(createFacility, admin, 'POST', {
			body: {
				typeId: type.id,
				name: 'Mal',
				capacity: 1,
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0
			}
		});
		expect(res.status).toBe(422);
		expect((await res.json()).error).toBe('INVALID_CONFIG');
	});

	it('hora mal formada → 400', async () => {
		const { facility } = await createRocodromo();
		const res = await call(putHours, admin, 'PUT', {
			id: facility.id,
			body: { hours: [{ weekday: 1, opens: '9:00', closes: '13:00' }] }
		});
		expect(res.status).toBe(400);
	});
});

describe('desactivar instalaciones', () => {
	it('con reservas futuras → 409; con force=true → ok, sigue la reserva y desaparece del listado público', async () => {
		const { facility } = await createRocodromo();
		const made = await call(book, vecina, 'POST', {
			body: { facilityId: facility.id, startsAt: SLOT }
		});
		expect(made.status).toBe(201);

		const blocked = await call(deactivate, admin, 'POST', { id: facility.id });
		expect(blocked.status).toBe(409);
		expect(await blocked.json()).toEqual({ error: 'HAS_FUTURE_BOOKINGS' });

		const forced = await call(deactivate, admin, 'POST', {
			id: facility.id,
			url: 'http://localhost/?force=true'
		});
		expect(forced.status).toBe(200);

		const pub = await publicFacilities({
			locals: { db },
			params: { slug: 'ribadavila' }
		} as never);
		const list = (await pub.json()) as { id: string }[];
		expect(list.map((f) => f.id)).not.toContain(facility.id);

		const adminList = (await (await call(listFacilities, admin, 'GET')).json()) as {
			id: string;
			active: boolean;
		}[];
		expect(adminList.find((f) => f.id === facility.id)?.active).toBe(false);

		const mine = await db.query.bookings.findMany({
			where: (b, { eq }) => eq(b.facilityId, facility.id)
		});
		expect(mine.map((b) => b.status)).toEqual(['confirmed']);
	});

	it('sin reservas futuras se desactiva sin force', async () => {
		const { facility } = await createRocodromo();
		expect((await call(deactivate, admin, 'POST', { id: facility.id })).status).toBe(200);
	});
});

describe('aislamiento entre concellos', () => {
	it('el admin de Ribadávila no puede modificar una instalación de Montemaior', async () => {
		const facBody = {
			name: 'Hackeada',
			slotMinutes: 60,
			priceResidentCents: 0,
			priceNonResidentCents: 0
		};
		const [row] = await db.query.facilities.findMany({
			where: (f, { eq }) => eq(f.id, fx.otherFacilityId)
		});
		const attempts = [
			await call(putFacility, admin, 'PUT', {
				id: fx.otherFacilityId,
				body: { ...facBody, typeId: row.typeId }
			}),
			await call(deactivate, admin, 'POST', { id: fx.otherFacilityId }),
			await call(putHours, admin, 'PUT', {
				id: fx.otherFacilityId,
				body: { hours: weekHours('00:00', '23:00') }
			}),
			await call(listClosures, admin, 'GET', { id: fx.otherFacilityId }),
			await call(createClosure, admin, 'POST', {
				id: fx.otherFacilityId,
				body: {
					startsAt: '2026-11-25T10:00:00+01:00',
					endsAt: '2026-11-25T12:00:00+01:00'
				}
			})
		];
		expect(attempts.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
		const after = await db.query.facilities.findMany({
			where: (f, { eq }) => eq(f.id, fx.otherFacilityId)
		});
		expect(after[0]).toMatchObject({ name: 'Pista central', active: true });
	});

	it('no se puede usar un tipo de otro concello ni tocarlo', async () => {
		const [otherType] = await db.query.facilityTypes.findMany({
			where: (t, { eq }) => eq(t.municipalityId, fx.otherMunicipalityId)
		});
		const create = await call(createFacility, admin, 'POST', {
			body: {
				typeId: otherType.id,
				name: 'X',
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0
			}
		});
		expect(create.status).toBe(404);
		expect((await call(putType, admin, 'PUT', { id: otherType.id, body: typeBody })).status).toBe(
			404
		);
		const [row] = await db.query.facilities.findMany({
			where: (f, { eq }) => eq(f.id, fx.facilityId)
		});
		const foreign = await call(putFacility, admin, 'PUT', {
			id: fx.facilityId,
			body: {
				typeId: otherType.id,
				name: row.name,
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0
			}
		});
		expect(foreign.status).toBe(404);
	});

	it('una clausura de otro concello no se puede borrar', async () => {
		const [c] = await db
			.insert(closures)
			.values({
				facilityId: fx.otherFacilityId,
				startsAt: new Date('2026-12-01T10:00:00+01:00'),
				endsAt: new Date('2026-12-01T12:00:00+01:00')
			})
			.returning();
		expect((await call(deleteClosure, admin, 'DELETE', { id: c.id })).status).toBe(404);
	});

	it('un perfil de otro concello no se puede marcar como empadronado', async () => {
		const mon = await mkUser('monte-person', 'Persoa Montemaior');
		const [p] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.otherMunicipalityId, userId: mon.id })
			.returning();
		const res = await call(putResidency, admin, 'PUT', {
			id: p.id,
			body: { isResident: true }
		});
		expect(res.status).toBe(404);
	});
});

describe('cierres', () => {
	it('crear, listar y borrar un cierre; ends debe ser posterior a starts', async () => {
		const { facility } = await createRocodromo();
		const created = await call(createClosure, admin, 'POST', {
			id: facility.id,
			body: {
				startsAt: '2026-11-25T10:00:00+01:00',
				endsAt: '2026-11-25T12:00:00+01:00',
				reason: 'Mantemento'
			}
		});
		expect(created.status).toBe(201);
		const closure = (await created.json()) as { id: string };
		const list = (await (await call(listClosures, admin, 'GET', { id: facility.id })).json()) as {
			id: string;
		}[];
		expect(list.map((c) => c.id)).toEqual([closure.id]);

		const bad = await call(createClosure, admin, 'POST', {
			id: facility.id,
			body: {
				startsAt: '2026-11-25T12:00:00+01:00',
				endsAt: '2026-11-25T10:00:00+01:00'
			}
		});
		expect(bad.status).toBe(400);

		expect((await call(deleteClosure, admin, 'DELETE', { id: closure.id })).status).toBe(200);
		expect((await call(deleteClosure, admin, 'DELETE', { id: closure.id })).status).toBe(404);
	});
});

describe('la API también avisa a quien queda afectado (como la interfaz)', () => {
	const bookedRocodromo = async () => {
		const { facility } = await createRocodromo();
		const res = await call(book, vecina, 'POST', {
			body: { facilityId: facility.id, startsAt: SLOT }
		});
		expect(res.status).toBe(201);
		const booking = (await res.json()) as { id: string };
		return { facility, bookingId: booking.id };
	};
	const noticesOf = (bookingId: string, kind: 'closure' | 'hours_changed') =>
		db
			.select()
			.from(notifications)
			.where(and(eq(notifications.bookingId, bookingId), eq(notifications.kind, kind)));

	it('POST closures sobre una reserva confirmada la cancela y avisa a su titular', async () => {
		const { facility, bookingId } = await bookedRocodromo();
		const res = await call(createClosure, admin, 'POST', {
			id: facility.id,
			body: {
				startsAt: '2026-11-24T17:00:00+01:00',
				endsAt: '2026-11-24T21:00:00+01:00',
				reason: 'Avaría'
			}
		});
		expect(res.status).toBe(201);
		const rows = await db
			.select()
			.from(notifications)
			.where(
				and(eq(notifications.bookingId, bookingId), eq(notifications.kind, 'cancelled_by_staff'))
			);
		expect(rows).toHaveLength(1);
		expect(rows[0].userId).toBe(vecina.id);
		expect(rows[0].params.reason).toBe('Avaría');
	});

	it('un motivo de cierre de más de 200 caracteres falla sin crear ni cancelar nada', async () => {
		const { facility, bookingId } = await bookedRocodromo();
		const res = await call(createClosure, admin, 'POST', {
			id: facility.id,
			body: {
				startsAt: '2026-11-24T17:00:00+01:00',
				endsAt: '2026-11-24T21:00:00+01:00',
				reason: 'x'.repeat(201)
			}
		});
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('VALIDATION_FAILED');
		expect(
			await db.select().from(closures).where(eq(closures.facilityId, facility.id))
		).toHaveLength(0);
		const [booking] = await db
			.select({ status: bookings.status })
			.from(bookings)
			.where(eq(bookings.id, bookingId));
		expect(booking.status).toBe('confirmed');
	});

	it('PUT hours que deja fuera una reserva confirmada avisa (hours_changed)', async () => {
		const { facility, bookingId } = await bookedRocodromo();
		const res = await call(putHours, admin, 'PUT', {
			id: facility.id,
			body: { hours: weekHours('10:00', '14:00') }
		});
		expect(res.status).toBe(200);
		const rows = await noticesOf(bookingId, 'hours_changed');
		expect(rows).toHaveLength(1);
		expect(rows[0].userId).toBe(vecina.id);
	});
});

describe('tipos e instalaciones: cambios', () => {
	it('cambiar el modo del tipo con reservas futuras → 422 INVALID_CONFIG', async () => {
		const { type, facility } = await createRocodromo();
		await call(book, vecina, 'POST', {
			body: { facilityId: facility.id, startsAt: SLOT }
		});
		const res = await call(putType, admin, 'PUT', {
			id: type.id,
			body: { ...typeBody, bookingMode: 'slot' }
		});
		expect(res.status).toBe(422);
		expect((await res.json()).error).toBe('INVALID_CONFIG');
	});

	it('cambiar solo el nombre del tipo es posible', async () => {
		const { type } = await createRocodromo();
		const res = await call(putType, admin, 'PUT', {
			id: type.id,
			body: { ...typeBody, nameGl: 'Rocódromo cuberto' }
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ nameGl: 'Rocódromo cuberto' });
	});

	it('cambiar el modo sin reservas pero con configuración incompatible → 422', async () => {
		const { type } = await createRocodromo();
		const res = await call(putType, admin, 'PUT', {
			id: type.id,
			body: { ...typeBody, bookingMode: 'slot' }
		});
		expect(res.status).toBe(422);
	});

	it('PUT de instalación actualiza campos y revalida', async () => {
		const { type, facility } = await createRocodromo();
		const base = {
			typeId: type.id,
			name: 'Rocódromo reformado',
			capacity: 20,
			slotMinutes: 60,
			priceResidentCents: 100,
			priceNonResidentCents: 300
		};
		const good = await call(putFacility, admin, 'PUT', {
			id: facility.id,
			body: base
		});
		expect(good.status).toBe(200);
		expect(await good.json()).toMatchObject({
			name: 'Rocódromo reformado',
			capacity: 20
		});
		// 90 min no divide los tramos de 10 h
		const bad = await call(putFacility, admin, 'PUT', {
			id: facility.id,
			body: { ...base, slotMinutes: 90 }
		});
		expect(bad.status).toBe(422);
	});
});

describe('empadronamiento', () => {
	it('marcar a una persona como empadronada cambia el precio de su siguiente reserva', async () => {
		const { facility } = await createRocodromo();
		const profile = await db.query.municipalityProfiles.findFirst({
			where: (p, { eq }) => eq(p.id, fx.profileId)
		});
		expect(profile?.isResident).toBe(false);

		const first = await call(book, vecina, 'POST', {
			body: { facilityId: facility.id, startsAt: SLOT }
		});
		expect((await first.json()).priceCents).toBe(400);

		const res = await call(putResidency, admin, 'PUT', {
			id: fx.profileId,
			body: { isResident: true }
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			id: fx.profileId,
			isResident: true
		});

		const next = await call(book, vecina, 'POST', {
			body: { facilityId: facility.id, startsAt: '2026-11-24T19:00:00+01:00' }
		});
		expect(next.status).toBe(201);
		expect((await next.json()).priceCents).toBe(200);
	});
});

describe('persoal', () => {
	type StaffOut = { roleId: string; userId: string; displayName: string; role: string };
	const list = async (slug = 'ribadavila', user: U = admin) =>
		(await (await call(listStaff, user, 'GET', {}, slug)).json()) as StaffOut[];

	it('lista os roles do concello, sen os doutros nin o de deputación', async () => {
		const res = await call(listStaff, admin, 'GET');
		expect(res.status).toBe(200);
		const rows = (await res.json()) as StaffOut[];
		expect(rows.map((r) => [r.displayName, r.role]).sort()).toEqual([
			['Admin Ribadávila', 'admin'],
			['Conserxe Ribadávila', 'conserxe']
		]);
		expect(rows[0].roleId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('un conserje en GET admin/staff recibe 403', async () => {
		expect((await call(listStaff, conserje, 'GET')).status).toBe(403);
	});

	it('engadir un usuario local sen perfil é 404; un uuid descoñecido tamén', async () => {
		const loner = await mkUser('loner', 'Persoa Sen Perfil');
		const res = await call(addStaff, admin, 'POST', {
			body: { userId: loner.id, role: 'conserxe' }
		});
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
		const unknown = await call(addStaff, admin, 'POST', {
			body: { userId: UUID, role: 'conserxe' }
		});
		expect(unknown.status).toBe(404);
		const bad = await call(addStaff, admin, 'POST', {
			body: { userId: loner.id, role: 'deputacion' }
		});
		expect(bad.status).toBe(400);
	});

	it('engadir e quitar un conserje con Cl@ve que xa entrou', async () => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'clave', subject: 'clave-rosalia', displayName: 'Rosalía Castro' })
			.returning();
		// Sin perfil en este concello, no se puede añadir (Ruling 14).
		expect(
			(await call(addStaff, admin, 'POST', { body: { userId: u.id, role: 'conserxe' } })).status
		).toBe(404);
		await mkProfile(u.id);
		const res = await call(addStaff, admin, 'POST', { body: { userId: u.id, role: 'conserxe' } });
		expect(res.status).toBe(201);
		const added = (await res.json()) as StaffOut;
		expect(added).toMatchObject({ userId: u.id, displayName: 'Rosalía Castro', role: 'conserxe' });
		expect((await list()).map((r) => r.roleId)).toContain(added.roleId);
		// Repetir non duplica.
		const again = await call(addStaff, admin, 'POST', {
			body: { userId: u.id, role: 'conserxe' }
		});
		expect(again.status).toBe(201);
		expect(((await again.json()) as StaffOut).roleId).toBe(added.roleId);

		// O admin doutro concello non o pode quitar.
		const foreign = await call(
			removeStaff,
			montemaiorAdmin,
			'DELETE',
			{ id: added.roleId },
			'montemaior-do-rio'
		);
		expect(foreign.status).toBe(404);

		const del = await call(removeStaff, admin, 'DELETE', { id: added.roleId });
		expect(del.status).toBe(204);
		expect(await del.text()).toBe('');
		expect((await list()).map((r) => r.roleId)).not.toContain(added.roleId);
		expect((await call(removeStaff, admin, 'DELETE', { id: added.roleId })).status).toBe(404);
	});

	it('unha persoa local con perfil no concello pódese engadir', async () => {
		const res = await call(addStaff, admin, 'POST', {
			body: { userId: vecina.id, role: 'conserxe' }
		});
		expect(res.status).toBe(201);
		const added = (await res.json()) as StaffOut;
		expect((await call(removeStaff, admin, 'DELETE', { id: added.roleId })).status).toBe(204);
	});

	it('quitar o único admin dá 409 LAST_ADMIN; con dous admins pódese', async () => {
		const own = (await list()).find((r) => r.role === 'admin')!;
		const res = await call(removeStaff, admin, 'DELETE', { id: own.roleId });
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: 'LAST_ADMIN' });

		const [u] = await db
			.insert(users)
			.values({ provider: 'chave365', subject: 'chave-manuel', displayName: 'Celestino Curros' })
			.returning();
		await mkProfile(u.id);
		const second = (await (
			await call(addStaff, admin, 'POST', { body: { userId: u.id, role: 'admin' } })
		).json()) as StaffOut;
		expect((await call(removeStaff, admin, 'DELETE', { id: second.roleId })).status).toBe(204);
		expect((await list()).filter((r) => r.role === 'admin')).toHaveLength(1);
	});

	it('candidatos: só clave ou chave365, por nome sen tildes, máx. 20', async () => {
		const created = await db
			.insert(users)
			.values([
				{ provider: 'clave', subject: 'cand-1', displayName: 'Álvaro Cunqueiro' },
				{ provider: 'chave365', subject: 'cand-2', displayName: 'ALVARO Mutis' },
				{ provider: 'local', subject: 'cand-3', displayName: 'Álvaro Local' },
				{ provider: 'clave', subject: 'cand-4', displayName: 'Álvaro Forasteiro' },
				...Array.from({ length: 25 }, (_, i) => ({
					provider: 'clave' as const,
					subject: `cand-many-${i}`,
					displayName: `Zeta Moitos ${i}`
				}))
			])
			.returning();
		for (const u of created) {
			if (u.subject === 'cand-4') await mkProfile(u.id, fx.otherMunicipalityId);
			else await mkProfile(u.id);
		}
		const res = await call(staffCandidates, admin, 'GET', {
			url: `http://localhost/?q=${encodeURIComponent('álvaro')}`
		});
		expect(res.status).toBe(200);
		const found = (await res.json()) as { userId: string; displayName: string; provider: string }[];
		expect(found.map((c) => c.displayName).sort()).toEqual(['ALVARO Mutis', 'Álvaro Cunqueiro']);
		expect(found.map((c) => c.provider).sort()).toEqual(['chave365', 'clave']);
		const many = await call(staffCandidates, admin, 'GET', { url: 'http://localhost/?q=moitos' });
		expect(((await many.json()) as unknown[]).length).toBe(20);
		const short = await call(staffCandidates, admin, 'GET', { url: 'http://localhost/?q=a' });
		expect(short.status).toBe(400);
		const pct = await call(staffCandidates, admin, 'GET', { url: 'http://localhost/?q=%25%25' });
		expect(await pct.json()).toEqual([]);
	});
});
