// SPDX-License-Identifier: EUPL-1.2
// Zona «O meu club» (tanda C): só os responsables entran e só se cancelan reservas do propio club.
import { isActionFailure, isHttpError } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { bookings, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { saveEntity } from '../../lib/server/services/entities';
import { seedFixture, type Fixture } from '../../lib/server/services/fixtures';
import { actions, load } from './club/[entityId]/+page.server';

// Martes 24 nov 2026, 08:00 en Madrid.
const NOW = new Date('2026-11-24T08:00:00+01:00');

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

async function setup() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const [admin] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'fixture-admin', displayName: 'Admin' })
		.returning();
	const entity = await saveEntity(db, f.municipalityId, admin.id, {
		name: 'CD Ribadávila',
		shortName: 'CDR',
		phone: '',
		priceMode: 'free',
		fixedPriceCents: null,
		advanceDays: null,
		maxActiveBookings: null,
		maxConsecutiveSlots: null,
		noShowsCount: true,
		facilityIds: [],
		memberIds: [f.userId]
	});
	return { db, f, entityId: entity!.id, u: { id: f.userId, displayName: 'Nerea' } as SessionUser };
}

/** Reserva insertada a man, do club (`entityId`) ou persoal (`null`). */
async function book(db: Db, f: Fixture, entityId: string | null, hhmm: string) {
	const startsAt = localDateTimeToUtc('2026-11-26', hhmm);
	const [row] = await db
		.insert(bookings)
		.values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			entityId,
			seats: 1,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 60 * 60_000),
			accessCode: '4821',
			priceCents: 0,
			status: 'confirmed',
			channel: 'online',
			createdByUserId: f.userId
		})
		.returning();
	return row.id;
}

function event(
	db: Db,
	user: SessionUser | null,
	entityId: string,
	fields?: Record<string, string>
) {
	const e = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila', entityId },
		url: `http://localhost/ribadavila/club/${entityId}`,
		method: fields ? 'POST' : 'GET'
	});
	if (fields)
		(e as { request: Request }).request = new Request(e.url, {
			method: 'POST',
			body: new URLSearchParams(fields)
		});
	return e;
}

const statusOf = async (db: Db, id: string) =>
	(await db.select().from(bookings).where(eq(bookings.id, id)))[0].status;

describe('O meu club', () => {
	it('quen non é responsable recibe 404; un id que non é uuid tamén', async () => {
		const { db, entityId } = await setup();
		const other = { id: '00000000-0000-4000-8000-000000000000', displayName: 'X' } as SessionUser;
		const a = await outcome(() => call(load, event(db, other, entityId)));
		expect(isHttpError(a.thrown) && a.thrown.status).toBe(404);
		const { u } = await setup();
		const b = await outcome(() => call(load, event(db, u, 'non-e-uuid')));
		expect(isHttpError(b.thrown) && b.thrown.status).toBe(404);
	});

	it('cancela unha reserva do club', async () => {
		const { db, f, entityId, u } = await setup();
		const id = await book(db, f, entityId, '18:00');
		const r = await call(actions.cancelar, event(db, u, entityId, { bookingId: id }));
		expect(isActionFailure(r)).toBe(false);
		expect(await statusOf(db, id)).toBe('cancelled');
	});

	it('non cancela unha reserva que non é do club, aínda que se coñeza o seu id', async () => {
		const { db, f, entityId, u } = await setup();
		const id = await book(db, f, null, '19:00');
		const r = await call(actions.cancelar, event(db, u, entityId, { bookingId: id }));
		expect(isActionFailure(r) && r.status).toBe(404);
		expect(await statusOf(db, id)).toBe('confirmed');
	});
});
