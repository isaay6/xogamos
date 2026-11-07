// SPDX-License-Identifier: EUPL-1.2
// «Crear» cando o servizo rexeita a configuración: volve ao último paso cos problemas.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { staffRoles, users } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';

// Os pasos validan o mesmo que o servizo, así que o rexeitamento simúlase.
vi.mock('../../../lib/server/services/admin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../lib/server/services/admin')>()),
	createFacilityWithType: vi.fn(async () => ({
		ok: false,
		error: 'INVALID_CONFIG',
		issues: [{ path: '', message: 'Unit mode requires units >= 2' }]
	}))
}));

const { actions, load } = await import('./instalacions/asistente/+page.server');
const { default: AsisPage } = await import('./instalacions/asistente/+page.svelte');

let db: Db;
let fx: Fixture;
let admin: { id: string; displayName: string };

const ev = (form?: Record<string, string>) => {
	const event = makeEvent({
		db,
		user: admin,
		params: { slug: 'ribadavila' },
		url: 'http://localhost/ribadavila/admin/instalacions/asistente',
		method: form ? 'POST' : 'GET'
	});
	if (form) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(form)) fd.set(k, v);
		Object.defineProperty(event, 'request', {
			value: new Request(event.url, { method: 'POST', body: fd })
		});
	}
	return event as never;
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'adm', displayName: 'Rebeca Dorrío' })
		.returning();
	admin = { id: u.id, displayName: u.displayName };
	await db
		.insert(staffRoles)
		.values({ userId: u.id, municipalityId: fx.municipalityId, role: 'admin' });
});

describe('crear rexeitado polo servizo', () => {
	it('400 no paso 6 co erro, os problemas e os valores; a páxina amósaos', async () => {
		const s0 = (await actions.paso(ev({ paso: '0', ir: '1', modelo: 'padel' }))) as {
			values: Record<string, string>;
		};
		const values = { ...s0.values, nome: 'Pádel', edificio: 'novo', lugar: 'Pistas' };
		const res = await actions.crear(ev({ ...values, paso: '6' }));
		expect(res).toMatchObject({
			status: 400,
			data: {
				paso: 6,
				error: 'INVALID_CONFIG',
				issues: [{ message: 'Unit mode requires units >= 2' }],
				values: { nome: 'Pádel', modelo: 'padel' }
			}
		});
		const html = render(AsisPage, {
			props: {
				data: {
					locale: 'gl',
					municipality: { slug: 'ribadavila', name: 'Ribadávila', hasLogo: false },
					...(await load(ev()))
				} as never,
				form: (res as { data: unknown }).data as never,
				params: {} as never
			}
		}).body;
		expect(html).toContain('role="alert"');
		expect(html).toContain('Unit mode requires units');
		expect(html).toContain('Todo ben?');
	});
});
