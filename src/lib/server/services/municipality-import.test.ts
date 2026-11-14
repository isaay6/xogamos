// SPDX-License-Identifier: EUPL-1.2
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { facilities, holidays } from '../db/schema';
import { seedFixture, type Fixture } from './fixtures';
import { exportMunicipality } from './exports';
import { importMunicipalityConfig } from './municipality-import';

const NOW = new Date('2026-11-20T10:00:00Z');
let db: Db;
let fx: Fixture;

beforeEach(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db
		.update(facilities)
		.set({ latitude: 42.34, longitude: -7.86 })
		.where(eq(facilities.id, fx.facilityId));
	await db
		.insert(holidays)
		.values({
			municipalityId: fx.municipalityId,
			date: '2026-12-25',
			name: 'Nadal',
			mode: 'closed'
		});
});

describe('importMunicipalityConfig', () => {
	it('exporta, importa nun concello novo e conserva só a configuración remapeada', async () => {
		const exported = await exportMunicipality(db, fx.municipalityId, NOW);
		const created = await importMunicipalityConfig(db, exported, {
			slug: 'ribadavila-importada',
			name: 'Ribadávila importada',
			now: NOW
		});
		const imported = await exportMunicipality(db, created.id, NOW);
		expect(imported.municipality).toMatchObject({
			slug: 'ribadavila-importada',
			name: 'Ribadávila importada',
			province: exported.municipality.province,
			primaryColor: exported.municipality.primaryColor
		});
		expect(imported.facilityTypes.map((item) => item.nameGl)).toEqual(
			exported.facilityTypes.map((item) => item.nameGl)
		);
		expect(imported.facilities).toHaveLength(exported.facilities.length);
		expect(imported.facilities[0]).toMatchObject({
			name: exported.facilities[0].name,
			latitude: 42.34,
			longitude: -7.86
		});
		expect(imported.openingHours).toHaveLength(exported.openingHours.length);
		expect(imported.holidays.map((item) => item.date)).toContain('2026-12-25');
		expect(imported.profiles).toEqual([]);
		expect(imported.staffRoles).toEqual([]);
		expect(imported.bookings).toEqual([]);
		for (const facility of imported.facilities) expect(facility.municipalityId).toBe(created.id);
	});

	it('rexeita un documento que non é unha exportación v1 sen escribir nada', async () => {
		await expect(
			importMunicipalityConfig(
				db,
				{ format: 'other', version: 2 },
				{
					slug: 'invalido',
					name: 'Inválido',
					now: NOW
				}
			)
		).rejects.toThrow();
	});
});
