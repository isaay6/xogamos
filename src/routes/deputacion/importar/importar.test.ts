// SPDX-License-Identifier: EUPL-1.2
import { beforeEach, describe, expect, it } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { staffRoles, users } from '../../../lib/server/db/schema';
import { makeEvent } from '../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { exportMunicipality } from '../../../lib/server/services/exports';
import { actions } from './+page.server';

let db: Db;
let fx: Fixture;
let deputy: { id: string; displayName: string };

beforeEach(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [user] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'deputy-import', displayName: 'Deputación' })
		.returning();
	deputy = { id: user.id, displayName: user.displayName };
	await db.insert(staffRoles).values({ userId: user.id, municipalityId: null, role: 'deputacion' });
});

async function call(user: typeof deputy | null, json: unknown) {
	const event = makeEvent({
		db,
		user,
		method: 'POST',
		url: 'http://localhost/deputacion/importar'
	});
	const body = new FormData();
	body.set('name', 'Concello importado');
	body.set('slug', 'concello-importado');
	body.set('file', new File([JSON.stringify(json)], 'config.json', { type: 'application/json' }));
	Object.defineProperty(event, 'request', {
		value: new Request(event.url, { method: 'POST', body })
	});
	return (actions.default as (event: never) => unknown)(event as never);
}

describe('importación desde Deputación', () => {
	it('só permite á Deputación subir unha configuración', async () => {
		const json = await exportMunicipality(db, fx.municipalityId);
		await expect(call(null, json)).rejects.toSatisfy((error: unknown) =>
			isRedirect(error) ? error.status === 303 : false
		);
		await expect(call({ id: fx.userId, displayName: 'Veciña' }, json)).rejects.toSatisfy(
			(error: unknown) => (isHttpError(error) ? error.status === 403 : false)
		);
	});

	it('coa autorización crea o concello e redirixe ao panel', async () => {
		const json = await exportMunicipality(db, fx.municipalityId);
		await expect(call(deputy, json)).rejects.toSatisfy(
			(error: unknown) =>
				isRedirect(error) && error.location === '/deputacion?novo=concello-importado'
		);
	});
});
