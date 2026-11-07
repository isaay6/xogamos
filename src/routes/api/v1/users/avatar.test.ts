// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../../lib/server/db/client';
import { staffRoles, users } from '../../../../lib/server/db/schema';
import { createTestDb } from '../../../../lib/server/db/test-db';
import { makeEvent } from '../../../../lib/server/http/test-event';
import { setAvatarPhoto } from '../../../../lib/server/services/avatar';
import { seedFixture, type Fixture } from '../../../../lib/server/services/fixtures';
import { load as loadLayout } from '../../../[slug]/+layout.server';
import { DELETE, GET, PUT } from './[id]/avatar/+server';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let owner: U;
let other: U;
let conserxe: U;
let foreignStaff: U;

const mk = async (subject: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: subject })
		.returning();
	return { id: u.id, displayName: u.displayName };
};
const get = (user: U | null, id: string) => GET(makeEvent({ db, user, params: { id } }) as never);

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	owner = { id: fx.userId, displayName: 'Nerea Veciña' };
	other = await mk('av-other');
	conserxe = await mk('av-cons');
	foreignStaff = await mk('av-foreign');
	await db.insert(staffRoles).values([
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: foreignStaff.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' }
	]);
	await setAvatarPhoto(db, owner.id, PNG, PNG.length);
});

describe('GET /api/v1/users/{id}/avatar', () => {
	it('200 para la propia persona, con caché privada', async () => {
		const res = await get(owner, owner.id);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('cache-control')).toBe('private, no-cache');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
	});

	it('200 para un conserxe de un concello donde tiene perfil', async () => {
		expect((await get(conserxe, owner.id)).status).toBe(200);
	});

	it('404 para otro vecino, personal de otro concello y sin sesión', async () => {
		expect((await get(other, owner.id)).status).toBe(404);
		expect((await get(foreignStaff, owner.id)).status).toBe(404);
		expect((await get(null, owner.id)).status).toBe(404);
	});

	it('404 idéntico para un id inexistente o mal formado', async () => {
		const missing = await get(owner, '00000000-0000-4000-8000-000000000000');
		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual({ error: 'NOT_FOUND' });
		expect((await get(owner, 'no-es-uuid')).status).toBe(404);
	});
});

describe('PUT/DELETE /api/v1/users/{id}/avatar', () => {
	const put = (user: U | null, id: string, bytes: Uint8Array) =>
		PUT(makeEvent({ db, user, method: 'PUT', params: { id }, bytes }) as never);

	it('sube y borra la foto propia', async () => {
		expect((await put(other, other.id, PNG)).status).toBe(204);
		expect((await get(other, other.id)).status).toBe(200);
		const del = await DELETE(
			makeEvent({ db, user: other, method: 'DELETE', params: { id: other.id } }) as never
		);
		expect(del.status).toBe(204);
		expect((await get(other, other.id)).status).toBe(404);
	});

	it('rechaza SVG y más de 256 KB', async () => {
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		expect((await put(other, other.id, svg)).status).toBe(400);
		const big = new Uint8Array(300 * 1024);
		big.set(PNG);
		expect((await put(other, other.id, big)).status).toBe(400);
	});

	const putRaw = (init: RequestInit & { duplex?: 'half' }) => {
		const ev = makeEvent({ db, user: other, method: 'PUT', params: { id: other.id } });
		(ev as { request: Request }).request = new Request('http://localhost/', {
			method: 'PUT',
			...init
		});
		return PUT(ev as never);
	};

	it('rechaza un cuerpo en flujo demasiado grande sin Content-Length', async () => {
		const chunk = new Uint8Array(64 * 1024);
		chunk.set(PNG);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(c) {
				if (sent++ >= 6) c.close();
				else c.enqueue(chunk);
			}
		});
		const res = await putRaw({ body, duplex: 'half' });
		expect(res.status).toBe(400);
	});

	it('rechaza un Content-Length no numérico', async () => {
		const res = await putRaw({ body: PNG as BodyInit, headers: { 'content-length': 'abc' } });
		expect(res.status).toBe(400);
	});

	it('el id de otra persona da 404 y sin sesión 401', async () => {
		expect((await put(other, owner.id, PNG)).status).toBe(404);
		expect((await put(null, owner.id, PNG)).status).toBe(401);
	});
});

describe('payload del layout', () => {
	it('incluye avatar { key, hasPhoto }', async () => {
		const out = (await (loadLayout as never as (e: never) => Promise<Record<string, any>>)(
			makeEvent({ db, user: owner, params: { slug: 'ribadavila' } }) as never
		)) as { user: { avatar: { key: string | null; hasPhoto: boolean } } };
		expect(out.user.avatar).toEqual({ key: null, hasPhoto: true });
	});
});
