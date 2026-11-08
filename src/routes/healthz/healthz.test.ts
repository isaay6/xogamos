// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../lib/server/db/client';
import { createTestDb } from '../../lib/server/db/test-db';
import { makeEvent } from '../../lib/server/http/test-event';
import { GET } from './+server';

let db: Db;

beforeAll(async () => {
	db = await createTestDb();
});

describe('/healthz', () => {
	it('devolve 200 cando a base de datos responde', async () => {
		const response = await GET(makeEvent({ db }) as never);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it('devolve 503 cando a base de datos non está dispoñible', async () => {
		const unavailable = {
			execute: async () => {
				throw new Error('database unavailable');
			}
		} as unknown as Db;
		const response = await GET(makeEvent({ db: unavailable }) as never);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ ok: false });
	});
});
