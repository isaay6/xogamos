// SPDX-License-Identifier: EUPL-1.2
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-db';
import type { Db } from './client';
import { facilities } from './schema';
import { seedFixture, type Fixture } from '../services/fixtures';

let db: Db;
let fx: Fixture;

beforeEach(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
});

describe('restricións de coordenadas das instalacións', () => {
	it('acepta WGS84 e rexeita latitude e lonxitude fóra de rango', async () => {
		await expect(
			db
				.update(facilities)
				.set({ latitude: 42.34, longitude: -7.86 })
				.where(eq(facilities.id, fx.facilityId))
		).resolves.toBeDefined();
		await expect(
			db.update(facilities).set({ latitude: 90.01 }).where(eq(facilities.id, fx.facilityId))
		).rejects.toThrow();
		await expect(
			db.update(facilities).set({ longitude: -180.01 }).where(eq(facilities.id, fx.facilityId))
		).rejects.toThrow();
	});
});
