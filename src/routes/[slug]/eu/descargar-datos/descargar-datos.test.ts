// SPDX-License-Identifier: EUPL-1.2
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../../lib/server/db/client';
import { createTestDb } from '../../../../lib/server/db/test-db';
import {
	bookings,
	notifications,
	municipalityProfiles,
	users
} from '../../../../lib/server/db/schema';
import { makeEvent } from '../../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../../lib/server/services/fixtures';
import { GET } from './+server';

const NOW = new Date('2026-11-24T10:00:00Z');
let db: Db;
let fx: Fixture;

beforeEach(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db.insert(bookings).values({
		municipalityId: fx.municipalityId,
		facilityId: fx.facilityId,
		profileId: fx.profileId,
		startsAt: new Date('2026-11-25T10:00:00Z'),
		endsAt: new Date('2026-11-25T11:00:00Z'),
		accessCode: '123456',
		priceCents: 300,
		channel: 'online',
		createdByUserId: fx.userId
	});
	await db.insert(notifications).values({
		userId: fx.userId,
		municipalityId: fx.municipalityId,
		kind: 'confirmed',
		params: { facilityName: 'Pista 1' }
	});
});

const get = (user: { id: string; displayName: string }, formato = 'json') =>
	GET(
		makeEvent({
			db,
			now: NOW,
			user,
			params: { slug: 'ribadavila' },
			url: `http://localhost/ribadavila/eu/descargar-datos?formato=${formato}`
		}) as never
	) as Promise<Response>;

describe('descargar os meus datos', () => {
	it('só devolve os datos da persoa que entrou, con perfís, reservas, abonos e avisos', async () => {
		const res = await get({ id: fx.userId, displayName: 'Nerea' });
		expect(res.status).toBe(200);
		expect(res.headers.get('content-disposition')).toContain('os-meus-datos.json');
		const data = await res.json();
		expect(data.identity.displayName).toBe('Nerea Veciña');
		expect(data.profiles).toHaveLength(1);
		expect(data.bookings).toHaveLength(1);
		expect(data.notices).toHaveLength(1);
		expect(data).toHaveProperty('passes');
	});

	it('outra persoa non recibe a exportación da propietaria', async () => {
		const [other] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'other', displayName: 'Outra' })
			.returning();
		await db.insert(municipalityProfiles).values({
			municipalityId: fx.municipalityId,
			userId: other.id,
			isResident: true
		});
		const data = await (await get({ id: other.id, displayName: other.displayName })).json();
		expect(data.identity.displayName).toBe('Outra');
		expect(data.bookings).toHaveLength(0);
		expect(data.notices).toHaveLength(0);
	});

	it('tamén ofrece unha páxina HTML imprimible', async () => {
		const res = await get({ id: fx.userId, displayName: 'Nerea' }, 'html');
		expect(res.headers.get('content-type')).toContain('text/html');
		expect(await res.text()).toContain('<h1>Os meus datos</h1>');
	});
});
