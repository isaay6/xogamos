// SPDX-License-Identifier: EUPL-1.2
import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { tournaments } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture } from '../../lib/server/services/fixtures';
import { actions, load as detailLoad } from './torneos/[id]/+page.server';
import { load as listLoad } from './torneos/+page.server';

const NOW = new Date('2026-11-24T08:00:00.000Z');
const call = <T>(fn: unknown, event: unknown) => (fn as (event: never) => T)(event as never);

describe('torneos', () => {
	it('permite ver a lista e a ficha sen sesión, pero inscribirse redirixe a entrar', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const [tournament] = await db
			.insert(tournaments)
			.values({
				municipalityId: f.municipalityId,
				facilityId: f.facilityId,
				title: 'Torneo aberto',
				sportDescription: 'Pádel',
				startsOn: '2026-12-10',
				endsOn: '2026-12-10',
				format: 'individual',
				maxEntries: 8,
				signupDeadline: new Date('2026-12-01T12:00:00.000Z'),
				createdBy: f.userId
			})
			.returning();
		const event = makeEvent({
			db,
			now: NOW,
			user: null,
			params: { slug: 'ribadavila', id: tournament.id },
			url: `http://localhost/ribadavila/torneos/${tournament.id}`
		});
		expect(((await call(listLoad, event)) as { rows: unknown[] }).rows).toHaveLength(1);
		expect(((await call(detailLoad, event)) as { row: unknown }).row).toBeTruthy();
		(event as { request: Request }).request = new Request(event.url, {
			method: 'POST',
			body: new URLSearchParams()
		});
		let redirected: unknown;
		try {
			await call(actions.inscribirme, event);
		} catch (cause) {
			redirected = cause;
		}
		expect(isRedirect(redirected)).toBe(true);
	});
});
