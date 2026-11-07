// SPDX-License-Identifier: EUPL-1.2
// Administración v1 (tarefa 2 do persoal): cancelar as reservas dun peche, avisos do concello,
// reactivar instalacións e escudo con versión.
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, municipalities, notifications, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { logoUrl } from '../../logo-url';
import {
	cancelBookingsInClosure,
	createClosure,
	deactivateFacility,
	reactivateFacility
} from './admin';
import { createBooking } from './bookings';
import { seedFixture, type Fixture } from './fixtures';
import { setLogo } from './logo';
import { getMunicipalityBySlug } from './municipalities';
import {
	createMunicipalityNotice,
	deleteMunicipalityNotice,
	listMunicipalityNotices,
	listMunicipalityNoticesAdmin,
	updateMunicipalityNotice
} from './notifications';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const at = (date: string, hhmm: string) => localDateTimeToUtc(date, hhmm);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const DAY = 86_400_000;

let db: Db;
let f: Fixture;
let adminId: string;

beforeAll(async () => {
	db = await createTestDb();
	f = await seedFixture(db);
	const [admin] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'fixture-admin', displayName: 'Admin' })
		.returning();
	adminId = admin.id;
});

const book = async (date: string, hhmm: string) => {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at(date, hhmm),
		channel: 'online',
		createdByUserId: f.userId,
		now: NOW
	});
	if (!r.ok) throw new Error(r.error);
	return r.value;
};

const statusOf = async (id: string) =>
	(await db.select({ s: bookings.status }).from(bookings).where(eq(bookings.id, id)))[0].s;

describe('cancelBookingsInClosure', () => {
	it('cancela la reserva creada por la ruta bloqueada al publicar un cierre', async () => {
		const booking = await book('2026-11-27', '10:00');
		const closure = await createClosure(
			db,
			f.municipalityId,
			f.facilityId,
			{
				startsAt: at('2026-11-27', '10:00'),
				endsAt: at('2026-11-27', '11:00'),
				reason: 'Revisión'
			},
			{ cancelNow: NOW }
		);
		expect(closure.ok).toBe(true);
		const [notice] = await db
			.select()
			.from(notifications)
			.where(
				and(eq(notifications.bookingId, booking.id), eq(notifications.kind, 'cancelled_by_staff'))
			);
		expect(notice).toMatchObject({ userId: f.userId, kind: 'cancelled_by_staff' });
		expect(await statusOf(booking.id)).toBe('cancelled');
	});

	it('cancela exactamente as reservas do peche, co motivo no aviso', async () => {
		const b10 = await book('2026-11-25', '10:00');
		const b11 = await book('2026-11-25', '11:00');
		const b12 = await book('2026-11-25', '12:00');
		const other = await book('2026-11-26', '10:00');
		const closure = await createClosure(db, f.municipalityId, f.facilityId, {
			startsAt: at('2026-11-25', '10:30'),
			endsAt: at('2026-11-25', '12:00'),
			reason: 'Avaría'
		});
		if (!closure.ok) throw new Error(closure.error);

		// Doutro concello ou sen motivo: nada.
		expect(
			await cancelBookingsInClosure(db, f.otherMunicipalityId, closure.value.id, 'Avaría', NOW)
		).toEqual({ ok: false, error: 'NOT_FOUND' });
		expect(
			await cancelBookingsInClosure(db, f.municipalityId, closure.value.id, '  ', NOW)
		).toEqual({ ok: false, error: 'VALIDATION_FAILED' });
		expect(await statusOf(b10.id)).toBe('confirmed');

		const r = await cancelBookingsInClosure(
			db,
			f.municipalityId,
			closure.value.id,
			'Avaría na iluminación',
			NOW
		);
		expect(r).toEqual({ ok: true, value: 2 });
		expect(await statusOf(b10.id)).toBe('cancelled');
		expect(await statusOf(b11.id)).toBe('cancelled');
		expect(await statusOf(b12.id)).toBe('confirmed');
		expect(await statusOf(other.id)).toBe('confirmed');
		const notices = await db
			.select()
			.from(notifications)
			.where(and(eq(notifications.kind, 'cancelled_by_staff'), eq(notifications.userId, f.userId)));
		const closureNotices = notices.filter((n) => n.bookingId === b10.id || n.bookingId === b11.id);
		expect(closureNotices.map((n) => n.bookingId).sort()).toEqual([b10.id, b11.id].sort());
		expect(closureNotices.every((n) => n.params.reason === 'Avaría na iluminación')).toBe(true);

		// Repetir non cancela nada máis.
		expect(
			await cancelBookingsInClosure(db, f.municipalityId, closure.value.id, 'Avaría', NOW)
		).toEqual({ ok: true, value: 0 });
	});
});

describe('avisos do concello (CRUD)', () => {
	it('crea, lista (futuros e caducados), edita e borra só no seu concello', async () => {
		const created = await createMunicipalityNotice(
			db,
			f.municipalityId,
			{ title: 'Obras no pavillón', body: 'Pecha a pista 2.', startsAt: new Date(NOW.getTime()) },
			adminId
		);
		if (!created.ok) throw new Error(created.error);
		const future = await createMunicipalityNotice(
			db,
			f.municipalityId,
			{ title: 'Torneo', body: '', startsAt: new Date(NOW.getTime() + 5 * DAY) },
			adminId
		);
		const expired = await createMunicipalityNotice(
			db,
			f.municipalityId,
			{
				title: 'Vello',
				body: '',
				startsAt: new Date(NOW.getTime() - 10 * DAY),
				endsAt: new Date(NOW.getTime() - 5 * DAY)
			},
			adminId
		);
		expect(future.ok && expired.ok).toBe(true);

		const admin = await listMunicipalityNoticesAdmin(db, f.municipalityId);
		expect(admin.map((n) => n.title).sort()).toEqual(['Obras no pavillón', 'Torneo', 'Vello']);
		expect(await listMunicipalityNoticesAdmin(db, f.otherMunicipalityId)).toEqual([]);
		// Á veciñanza só o vixente.
		const live = await listMunicipalityNotices(db, [f.municipalityId], NOW);
		expect(live.map((n) => n.title)).toEqual(['Obras no pavillón']);

		const id = created.value.id;
		const input = {
			title: 'Obras no pavillón (ampliado)',
			body: 'Pecha a pista 2 toda a semana.',
			startsAt: new Date(NOW.getTime()),
			endsAt: new Date(NOW.getTime() + 7 * DAY)
		};
		expect(await updateMunicipalityNotice(db, f.otherMunicipalityId, id, input)).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		expect(await deleteMunicipalityNotice(db, f.otherMunicipalityId, id)).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		const updated = await updateMunicipalityNotice(db, f.municipalityId, id, input);
		expect(updated.ok && updated.value.title).toBe('Obras no pavillón (ampliado)');
		expect((await deleteMunicipalityNotice(db, f.municipalityId, id)).ok).toBe(true);
		expect(
			(await listMunicipalityNoticesAdmin(db, f.municipalityId)).map((n) => n.id)
		).not.toContain(id);
	});

	it('valida título e datas', async () => {
		const bad = [
			{ title: '  ', body: '', startsAt: NOW },
			{ title: 'x'.repeat(201), body: '', startsAt: NOW },
			{ title: 'Ok', body: '', startsAt: NOW, endsAt: NOW }
		];
		for (const input of bad) {
			expect(await createMunicipalityNotice(db, f.municipalityId, input, adminId)).toEqual({
				ok: false,
				error: 'VALIDATION_FAILED'
			});
		}
	});
});

describe('escudo con versión', () => {
	it('setLogo incrementa a versión e o URL lévaa', async () => {
		expect((await getMunicipalityBySlug(db, 'ribadavila'))?.logoVersion).toBe(0);
		await setLogo(db, f.municipalityId, PNG);
		await setLogo(db, f.municipalityId, PNG);
		const m = await getMunicipalityBySlug(db, 'ribadavila');
		expect(m?.logoVersion).toBe(2);
		expect(logoUrl('ribadavila', m!.logoVersion)).toBe('/api/v1/m/ribadavila/logo?v=2');
		// O outro concello non cambia.
		const [other] = await db
			.select({ v: municipalities.logoVersion })
			.from(municipalities)
			.where(eq(municipalities.id, f.otherMunicipalityId));
		expect(other.v).toBe(0);
	});
});

describe('reactivateFacility', () => {
	it('unha instalación desactivada volve ser reservable', async () => {
		expect(
			(await deactivateFacility(db, f.municipalityId, f.facilityId, { force: true, now: NOW })).ok
		).toBe(true);
		const attempt = () =>
			createBooking(db, {
				municipalityId: f.municipalityId,
				facilityId: f.facilityId,
				profileId: f.profileId,
				startsAt: at('2026-11-27', '09:00'),
				channel: 'online',
				createdByUserId: f.userId,
				now: NOW
			});
		expect(await attempt()).toEqual({ ok: false, error: 'FACILITY_INACTIVE' });
		expect(await reactivateFacility(db, f.otherMunicipalityId, f.facilityId)).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		const r = await reactivateFacility(db, f.municipalityId, f.facilityId);
		expect(r.ok && r.value.active).toBe(true);
		expect((await attempt()).ok).toBe(true);
	});
});
