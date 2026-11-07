// SPDX-License-Identifier: EUPL-1.2
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { facilities } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { GET as listMunicipalities } from './municipalities/+server';
import { GET as listFacilities } from './m/[slug]/facilities/+server';
import { GET as availability } from './m/[slug]/facilities/[id]/availability/+server';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
});

afterEach(async () => {
	await db
		.update(facilities)
		.set({ active: true })
		.where(eq(facilities.municipalityId, fx.municipalityId));
	await db.delete(facilities).where(eq(facilities.name, 'Pista inactiva'));
});

const avail = (slug: string, id: string, date = '2026-11-24') =>
	availability(
		makeEvent({
			db,
			params: { slug, id },
			url: `http://localhost/api/v1/m/${slug}/facilities/${id}/availability?date=${date}`
		}) as never
	);

describe('GET /api/v1/municipalities', () => {
	it('lista los concellos', async () => {
		const res = await listMunicipalities(makeEvent({ db }) as never);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { slug: string }[];
		expect(body.map((m) => m.slug).sort()).toEqual(['montemaior-do-rio', 'ribadavila']);
	});
});

describe('GET /api/v1/m/[slug]/facilities', () => {
	it('solo instalaciones activas del concello', async () => {
		await db.insert(facilities).values({
			municipalityId: fx.municipalityId,
			typeId: (await db.select().from(facilities).where(eq(facilities.id, fx.facilityId)))[0]
				.typeId,
			name: 'Pista inactiva',
			priceResidentCents: 1,
			priceNonResidentCents: 2,
			active: false
		});
		const res = await listFacilities(makeEvent({ db, params: { slug: 'ribadavila' } }) as never);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string; name: string; bookingMode: string }[];
		expect(body.map((f) => f.id)).toEqual([fx.facilityId]);
		expect(body[0].bookingMode).toBe('slot');
	});
	it('slug inexistente da 404', async () => {
		const res = await listFacilities(makeEvent({ db, params: { slug: 'nope' } }) as never);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
	});
});

describe('GET availability', () => {
	it('da 13 franjas', async () => {
		const res = await avail('ribadavila', fx.facilityId);
		expect(res.status).toBe(200);
		expect(((await res.json()) as unknown[]).length).toBe(13);
	});
	it('instalación desactivada da 404 NOT_FOUND', async () => {
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, fx.facilityId));
		const res = await avail('ribadavila', fx.facilityId);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
	});
	it('slug inexistente da 404', async () => {
		expect((await avail('nope', fx.facilityId)).status).toBe(404);
	});
	it('instalación de otro concello da 404', async () => {
		expect((await avail('ribadavila', fx.otherFacilityId)).status).toBe(404);
	});
	it('fecha imposible da 400 VALIDATION_FAILED', async () => {
		const res = await avail('ribadavila', fx.facilityId, '2026-02-30');
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toBe('VALIDATION_FAILED');
	});
	it('fecha ausente da 400', async () => {
		const res = await availability(
			makeEvent({ db, params: { slug: 'ribadavila', id: fx.facilityId } }) as never
		);
		expect(res.status).toBe(400);
	});
	it('id que no es uuid da 400', async () => {
		const res = await avail('ribadavila', 'no-es-uuid');
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toBe('VALIDATION_FAILED');
	});
});
