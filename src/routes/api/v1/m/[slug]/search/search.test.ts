// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../../../../lib/server/db/client';
import { bookings, facilities } from '../../../../../../lib/server/db/schema';
import { createTestDb } from '../../../../../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../../../../../lib/server/domain/time';
import { makeEvent } from '../../../../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../../../../lib/server/services/fixtures';
import { GET as getSports } from '../sports/+server';
import { GET as getSearch } from './+server';

const NOW = new Date('2026-11-24T08:00:00+01:00');
let db: Db;
let fx: Fixture;
let otherTypeId: string;

const search = (query: string, slug = 'ribadavila') =>
	getSearch(
		makeEvent({
			db,
			now: NOW,
			params: { slug },
			url: `http://localhost/api/v1/m/${slug}/search?${query}`
		}) as never
	);

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [other] = await db
		.select({ typeId: facilities.typeId })
		.from(facilities)
		.where(eq(facilities.id, fx.otherFacilityId));
	otherTypeId = other.typeId;
});

describe('GET /api/v1/m/{slug}/sports', () => {
	it('é público e lista os deportes do concello', async () => {
		const res = await getSports(makeEvent({ db, params: { slug: 'ribadavila' } }) as never);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([
			{
				typeId: fx.typeId,
				nameGl: 'Pista de pádel',
				nameEs: 'Pista de pádel',
				mascot: 'padel',
				color: '#1d4ed8',
				bookingMode: 'slot'
			}
		]);
	});

	it('concello inexistente: 404', async () => {
		const res = await getSports(makeEvent({ db, params: { slug: 'non-existe' } }) as never);
		expect(res.status).toBe(404);
	});
});

describe('GET /api/v1/m/{slug}/search', () => {
	it('devolve días, horas e opcións; sen alternativas se hai opcións', async () => {
		const res = await search(`type=${fx.typeId}&date=2026-11-24&time=19:00`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.days).toHaveLength(15);
		expect(body.hours).toHaveLength(13);
		expect(body.options).toHaveLength(1);
		expect(body.options[0].startsAt).toBe(localDateTimeToUtc('2026-11-24', '19:00').toISOString());
		expect(body.alternatives).toEqual([]);
	});

	it('sen opcións trae alternativas', async () => {
		await db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt: localDateTimeToUtc('2026-11-24', '20:00'),
			endsAt: localDateTimeToUtc('2026-11-24', '21:00'),
			accessCode: '123456',
			priceCents: 300,
			channel: 'online',
			createdByUserId: fx.userId
		});
		const res = await search(`type=${fx.typeId}&date=2026-11-24&time=20:00`);
		const body = await res.json();
		expect(body.options).toEqual([]);
		expect(body.alternatives[0]).toEqual({
			kind: 'same_day',
			typeId: fx.typeId,
			date: '2026-11-24',
			time: '19:00',
			count: 1
		});
	});

	it('sen hora devolve todas as horas do día', async () => {
		const res = await search(`type=${fx.typeId}&date=2026-11-25`);
		expect(res.status).toBe(200);
		expect((await res.json()).options).toHaveLength(13);
	});

	it('tipo de Montemaior baixo ribadavila: 404', async () => {
		const res = await search(`type=${otherTypeId}&date=2026-11-24`);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
	});

	it('tipo sen instalacións activas: 404', async () => {
		const d = await createTestDb();
		const f = await seedFixture(d);
		await d.update(facilities).set({ active: false }).where(eq(facilities.id, f.facilityId));
		const res = await getSearch(
			makeEvent({
				db: d,
				now: NOW,
				params: { slug: 'ribadavila' },
				url: `http://localhost/?type=${f.typeId}&date=2026-11-24`
			}) as never
		);
		expect(res.status).toBe(404);
	});

	it('time=25:00: 400', async () => {
		const res = await search(`type=${fx.typeId}&date=2026-11-24&time=25:00`);
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('VALIDATION_FAILED');
	});

	it('sen type ou data inválida: 400', async () => {
		expect((await search('date=2026-11-24')).status).toBe(400);
		expect((await search(`type=${fx.typeId}&date=2026-02-30`)).status).toBe(400);
	});
});
