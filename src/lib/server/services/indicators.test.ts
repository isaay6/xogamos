// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { bookings, closures, facilities, seasonBookings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { seedFixture, type Fixture } from './fixtures';
import { municipalityIndicators, summarize } from './indicators';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db.insert(bookings).values({
		municipalityId: fx.municipalityId,
		facilityId: fx.facilityId,
		profileId: fx.profileId,
		startsAt: new Date('2026-11-16T10:00:00+01:00'),
		endsAt: new Date('2026-11-16T11:00:00+01:00'),
		status: 'confirmed',
		accessCode: '300001',
		priceCents: 300,
		channel: 'online',
		createdByUserId: fx.userId
	});
});

describe('indicadores: instalacións desactivadas (decisión 2)', () => {
	it('unha instalación desactivada despois de ter reservas no rango aparece nos indicadores', async () => {
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, fx.facilityId));
		const inRange = await municipalityIndicators(db, fx.municipalityId, '2026-11-16', '2026-11-22');
		expect(inRange.byFacility.map((f) => f.facilityId)).toEqual([fx.facilityId]);
		expect(inRange.byFacility[0].bookings).toBe(1);
		// Sen reservas no rango, a desactivada non sae
		const other = await municipalityIndicators(db, fx.municipalityId, '2026-12-01', '2026-12-07');
		expect(other.byFacility).toEqual([]);
	});
});

describe('summarize', () => {
	const fac = (occupancy: number, open: boolean) => ({
		facilityId: crypto.randomUUID(),
		name: 'x',
		occupancy,
		bookings: 0,
		noShows: 0,
		noShowRate: 0,
		underused: false,
		open
	});

	it('a ocupación media non conta as instalacións pechadas todo o período', () => {
		const s = summarize({
			byFacility: [fac(0.6, true), fac(0.2, true), fac(0, false)],
			peakHours: []
		});
		expect(s.occupancy).toBeCloseTo(0.4, 10);
		expect(summarize({ byFacility: [fac(0, false)], peakHours: [] }).occupancy).toBe(0);
	});

	it('sen datos devolve ceros e sen franja punta', () => {
		expect(summarize({ byFacility: [], peakHours: [] })).toEqual({
			occupancy: 0,
			bookings: 0,
			noShowRate: 0,
			peak: null
		});
	});
});

describe('indicadores: as tempadas contan como ocupado (resolución 2)', () => {
	it('a tempada suma minutos á ocupación e horas ao mapa, pero non reservas; nun peche non conta', async () => {
		const db2 = await createTestDb();
		const fx2 = await seedFixture(db2);
		// Luns 16 nov 2026 de 19:00 a 20:30 (só ese luns dentro da semana).
		await db2.insert(seasonBookings).values({
			municipalityId: fx2.municipalityId,
			facilityId: fx2.facilityId,
			entityName: 'CD Ribadávila',
			weekday: 0,
			startsTime: '19:00',
			endsTime: '20:30',
			fromDate: '2026-10-01',
			toDate: '2027-06-30',
			createdBy: fx2.userId
		});
		const week = await municipalityIndicators(db2, fx2.municipalityId, '2026-11-16', '2026-11-22');
		const [f] = week.byFacility;
		// 90 min de 7 días × 13 h abertas.
		expect(f.occupancy).toBe(Math.round((90 / (7 * 13 * 60)) * 1000) / 1000);
		expect(f.bookings).toBe(0);
		expect(week.peakHours).toEqual([
			{ weekday: 0, hour: 19, bookings: 1 },
			{ weekday: 0, hour: 20, bookings: 1 }
		]);
		expect(summarize(week)).toMatchObject({ bookings: 0, peak: { from: 19, to: 21 } });

		// Pechada ese luns: a tempada non ocupa nada.
		await db2.insert(closures).values({
			facilityId: fx2.facilityId,
			startsAt: new Date('2026-11-16T00:00:00+01:00'),
			endsAt: new Date('2026-11-17T00:00:00+01:00'),
			reason: 'Obras'
		});
		const closed = await municipalityIndicators(
			db2,
			fx2.municipalityId,
			'2026-11-16',
			'2026-11-22'
		);
		expect(closed.byFacility[0].occupancy).toBe(0);
		expect(closed.peakHours).toEqual([]);
	});
});
