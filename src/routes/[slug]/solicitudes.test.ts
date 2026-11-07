// SPDX-License-Identifier: EUPL-1.2
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import { createTestDb } from '../../lib/server/db/test-db';
import { requests, users } from '../../lib/server/db/schema';
import { makeEvent } from '../../lib/server/http/test-event';
import { saveEntity } from '../../lib/server/services/entities';
import { seedFixture } from '../../lib/server/services/fixtures';
import { actions, load } from './solicitudes/+page.server';
import { actions as newActions } from './solicitudes/nova/+page.server';

const NOW = new Date('2026-11-24T08:00:00+01:00');
const call = <T>(fn: unknown, event: unknown) => (fn as (event: never) => T)(event as never);

async function setup() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	return { db, f, user: { id: f.userId, displayName: 'Nerea' } as SessionUser };
}

function event(
	db: Awaited<ReturnType<typeof createTestDb>>,
	user: SessionUser | null,
	fields?: Record<string, string>
) {
	const e = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila' },
		url: 'http://localhost/ribadavila/solicitudes',
		method: fields ? 'POST' : 'GET'
	});
	if (fields)
		(e as { request: Request }).request = new Request(e.url, {
			method: 'POST',
			body: new URLSearchParams(fields)
		});
	return e;
}

const fields = (facilityId: string, extra: Record<string, string> = {}) => ({
	kind: 'evento',
	facilityId,
	fromDate: '2026-12-01',
	toDate: '2026-12-02',
	startsTime: '18:00',
	endsTime: '20:00',
	title: 'Proba',
	phone: '600000000',
	...extra
});

describe('solicitudes', () => {
	it('sen sesión redirixe', async () => {
		const { db } = await setup();
		try {
			await call(load, event(db, null));
		} catch (cause) {
			expect(isRedirect(cause)).toBe(true);
		}
	});

	it('crea e retira unha solicitude propia', async () => {
		const { db, f, user } = await setup();
		// Ao gardar volve á lista: a acción remata cunha redirección 303.
		let redirected: unknown;
		try {
			await call(newActions.gardar, event(db, user, fields(f.facilityId)));
		} catch (cause) {
			redirected = cause;
		}
		expect(isRedirect(redirected) && redirected.location).toBe('/ribadavila/solicitudes');
		const [request] = await db.select().from(requests);
		const withdrawn = await call(actions.retirar, event(db, user, { id: request.id }));
		expect(isActionFailure(withdrawn)).toBe(false);
		expect((await db.select().from(requests).where(eq(requests.id, request.id)))[0].status).toBe(
			'retirada'
		);
	});

	it('non permite presentar como un club alleo', async () => {
		const { db, f, user } = await setup();
		const [admin] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'admin', displayName: 'Admin' })
			.returning();
		const club = await saveEntity(db, f.municipalityId, admin.id, {
			name: 'Club alleo',
			shortName: 'CA',
			phone: '',
			priceMode: null,
			fixedPriceCents: null,
			advanceDays: null,
			maxActiveBookings: null,
			maxConsecutiveSlots: null,
			noShowsCount: true,
			facilityIds: [],
			memberIds: []
		});
		const result = await call(
			newActions.gardar,
			event(db, user, fields(f.facilityId, { entityId: club!.id }))
		);
		expect(isActionFailure(result) && result.status).toBe(404);
	});

	it('non retira a solicitude doutra persoa', async () => {
		const { db, f, user } = await setup();
		const [other] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'other', displayName: 'Outra' })
			.returning();
		const [request] = await db
			.insert(requests)
			.values({
				municipalityId: f.municipalityId,
				userId: other.id,
				kind: 'evento',
				facilityId: f.facilityId,
				fromDate: '2026-12-01',
				toDate: '2026-12-02',
				startsTime: '18:00',
				endsTime: '20:00',
				title: 'Allea',
				phone: '600000000'
			})
			.returning();
		const result = await call(actions.retirar, event(db, user, { id: request.id }));
		expect(isActionFailure(result) && result.status).toBe(404);
	});
});
