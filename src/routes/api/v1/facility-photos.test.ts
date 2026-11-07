// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../lib/server/db/client';
import { createTestDb } from '../../../lib/server/db/test-db';
import { facilities } from '../../../lib/server/db/schema';
import { makeEvent } from '../../../lib/server/http/test-event';
import { addFacilityPhoto, listFacilityPhotos } from '../../../lib/server/services/facility-photos';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { eq } from 'drizzle-orm';
import { GET } from './m/[slug]/facilities/[id]/photos/[photoId]/+server';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
let db: Db;
let fx: Fixture;
let photoId = '';

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await addFacilityPhoto(db, fx.municipalityId, fx.facilityId, PNG, PNG.length, 'Pista', 'Pista');
	photoId = (await listFacilityPhotos(db, fx.facilityId))[0].id;
});

const get = (slug = 'ribadavila', id = fx.facilityId, pid = photoId) =>
	GET(makeEvent({ db, params: { slug, id, photoId: pid } }) as never);

describe('GET foto pública de instalación', () => {
	it('serve unha foto activa con caché e protección de tipo', async () => {
		const res = await get();
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('un slug doutro concello ou unha instalación inactiva dan 404', async () => {
		expect((await get('montemaior-do-rio')).status).toBe(404);
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, fx.facilityId));
		expect((await get()).status).toBe(404);
	});
});
