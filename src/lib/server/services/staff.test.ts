// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { facilities } from '../db/schema';
import { seedFixture, type Fixture } from './fixtures';
import { getAgenda } from './staff';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db.insert(facilities).values({
		municipalityId: fx.municipalityId,
		typeId: fx.typeId,
		name: 'Pista cerrada',
		active: false,
		priceResidentCents: 300,
		priceNonResidentCents: 600
	});
});

describe('getAgenda', () => {
	it('lista toda instalación activa del concello aunque no tenga reservas, y solo esas', async () => {
		const agenda = await getAgenda(db, fx.municipalityId, '2026-11-24');
		expect(agenda.map((f) => f.facilityName)).toEqual(['Pista 1']);
		expect(agenda[0]).toMatchObject({
			facilityId: fx.facilityId,
			mascot: 'padel',
			bookingMode: 'slot',
			units: 1,
			bookings: []
		});
		const other = await getAgenda(db, fx.otherMunicipalityId, '2026-11-24');
		expect(other.map((f) => f.facilityName)).toEqual(['Pista central']);
	});
});
