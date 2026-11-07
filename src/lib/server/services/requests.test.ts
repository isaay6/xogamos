// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { bookings, closures, notifications, requests, seasonBookings, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { createBooking } from './bookings';
import { seedFixture } from './fixtures';
import {
	approveRequest,
	askMoreInfo,
	createRequest,
	rejectRequest,
	resendRequest,
	withdrawRequest
} from './requests';
import { hoursForDay } from './search';
import { closuresToday } from './closure-status';
import { saveEntity } from './entities';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const eventInput = (facilityId: string) => ({
	kind: 'evento' as const,
	facilityId,
	fromDate: '2026-11-24',
	toDate: '2026-11-24',
	startsTime: '18:00',
	endsTime: '20:00',
	title: 'Torneo de Nadal',
	phone: '600000000'
});

describe('solicitudes', () => {
	it('crea, retira e avisa o cambio de estado', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		expect(made.ok).toBe(true);
		const withdrawn = await withdrawRequest(
			db,
			f.municipalityId,
			f.userId,
			made.ok ? made.value.id : ''
		);
		expect(withdrawn.ok).toBe(true);
		expect(await db.select().from(notifications)).toHaveLength(1);
	});

	it('aproba unha tempada e crea as súas franxas', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const [admin] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'request-admin', displayName: 'Admin' })
			.returning();
		const entity = await saveEntity(db, f.municipalityId, admin.id, {
			name: 'CD Solicitudes',
			shortName: 'CDS',
			phone: '600000001',
			priceMode: null,
			fixedPriceCents: null,
			advanceDays: null,
			maxActiveBookings: null,
			maxConsecutiveSlots: null,
			noShowsCount: true,
			facilityIds: [],
			memberIds: [f.userId]
		});
		const made = await createRequest(db, f.municipalityId, f.userId, {
			...eventInput(f.facilityId),
			kind: 'tempada',
			weekdays: [1],
			entityId: entity!.id
		});
		const approved = await approveRequest(
			db,
			f.municipalityId,
			f.userId,
			made.ok ? made.value.id : '',
			{ now: NOW }
		);
		expect(approved.ok).toBe(true);
		expect((await db.select().from(seasonBookings))[0]?.entityId).toBe(entity!.id);
	});

	it('un evento con conflito require cancelar explicitamente e deixa un bloque de evento', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: localDateTimeToUtc('2026-11-24', '18:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now: NOW
		});
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		const no = await approveRequest(db, f.municipalityId, f.userId, made.ok ? made.value.id : '', {
			now: NOW
		});
		expect(no).toEqual({ ok: false, error: 'CONFLICTS' });
		const yes = await approveRequest(db, f.municipalityId, f.userId, made.ok ? made.value.id : '', {
			now: NOW,
			cancelAffected: true
		});
		expect(yes.ok).toBe(true);
		expect((await db.select().from(bookings))[0]?.status).toBe('cancelled');
		expect((await db.select().from(closures))[0]).toMatchObject({
			kind: 'evento',
			title: 'Torneo de Nadal'
		});
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, '2026-11-24', NOW);
		expect(hours.find((hour) => hour.time === '18:00')?.closed?.reason).toContain(
			'Evento: Torneo de Nadal'
		);
	});

	it('non rexeita sen motivo e illa outro concello', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		expect(
			await rejectRequest(db, f.municipalityId, f.userId, made.ok ? made.value.id : '', '', NOW)
		).toEqual({ ok: false, error: 'VALIDATION_FAILED' });
		expect(await db.select().from(requests)).toHaveLength(1);
		expect(
			await withdrawRequest(db, f.otherMunicipalityId, f.userId, made.ok ? made.value.id : '')
		).toEqual({ ok: false, error: 'NOT_FOUND' });
	});

	it('pide máis datos e permite reenviar a solicitude', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		const id = made.ok ? made.value.id : '';
		expect(
			await askMoreInfo(db, f.municipalityId, f.userId, id, 'Indica as persoas', NOW)
		).toMatchObject({ ok: true });
		expect(
			await resendRequest(db, f.municipalityId, f.userId, id, eventInput(f.facilityId))
		).toMatchObject({ ok: true });
		expect((await db.select().from(requests))[0]?.status).toBe('pendente');
	});

	it('ao reenviar comproba de novo a persoa, a entidade e a instalación', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		const id = made.ok ? made.value.id : '';
		await askMoreInfo(db, f.municipalityId, f.userId, id, 'Indica as persoas', NOW);
		const [other] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'other-requester', displayName: 'Outra persoa' })
			.returning();
		expect(
			await resendRequest(db, f.municipalityId, other.id, id, eventInput(f.facilityId))
		).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		expect(
			await resendRequest(db, f.municipalityId, f.userId, id, eventInput(f.otherFacilityId))
		).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		const [admin] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'request-entity-admin', displayName: 'Admin' })
			.returning();
		const entity = await saveEntity(db, f.municipalityId, admin.id, {
			name: 'Club alleo',
			shortName: 'CA',
			phone: '600000001',
			priceMode: null,
			fixedPriceCents: null,
			advanceDays: null,
			maxActiveBookings: null,
			maxConsecutiveSlots: null,
			noShowsCount: true,
			facilityIds: [],
			memberIds: []
		});
		expect(
			await resendRequest(db, f.municipalityId, f.userId, id, {
				...eventInput(f.facilityId),
				entityId: entity!.id
			})
		).toEqual({ ok: false, error: 'NOT_FOUND' });
		expect((await db.select().from(requests))[0]?.status).toBe('mais_datos');
	});

	it('un evento non converte a instalación nun peche de todo o día', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const made = await createRequest(db, f.municipalityId, f.userId, eventInput(f.facilityId));
		await approveRequest(db, f.municipalityId, f.userId, made.ok ? made.value.id : '', {
			now: NOW
		});
		expect(await closuresToday(db, [f.facilityId], '2026-11-24')).toEqual(new Map());
	});
});
