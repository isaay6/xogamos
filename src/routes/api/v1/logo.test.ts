// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../lib/server/db/client';
import { staffRoles, users } from '../../../lib/server/db/schema';
import { createTestDb } from '../../../lib/server/db/test-db';
import { makeEvent } from '../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { PUT as putLogo } from './m/[slug]/admin/logo/+server';
import { GET as getLogo } from './m/[slug]/logo/+server';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserje: U;

const mk = async (subject: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: subject })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const put = (user: U | null, bytes: Uint8Array, contentType = 'image/png') =>
	putLogo(
		makeEvent({
			db,
			user,
			method: 'PUT',
			params: { slug: 'ribadavila' },
			bytes,
			contentType
		}) as never
	);
const get = (slug = 'ribadavila') => getLogo(makeEvent({ db, params: { slug } }) as never);

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mk('admin');
	conserje = await mk('conserje');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
});

const putRaw = (init: RequestInit & { duplex?: 'half' }) => {
	const ev = makeEvent({ db, user: admin, method: 'PUT', params: { slug: 'ribadavila' } });
	(ev as { request: Request }).request = new Request('http://localhost/', {
		method: 'PUT',
		...init
	});
	return putLogo(ev as never);
};

describe('logo: límite de tamaño', () => {
	it('un cuerpo en flujo sin Content-Length que pasa de 262144 bytes da 400', async () => {
		let sent = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(c) {
				const chunk = new Uint8Array(65_536);
				if (sent === 0) chunk.set(PNG);
				sent += chunk.length;
				if (sent > 1_000_000) c.close();
				else c.enqueue(chunk);
			}
		});
		const res = await putRaw({ body: stream, duplex: 'half' });
		expect(res.status).toBe(400);
		expect(sent).toBeLessThan(1_000_000);
	});
	it('Content-Length no numérico da 400', async () => {
		const res = await putRaw({ body: PNG as BodyInit, headers: { 'content-length': 'abc' } });
		expect(res.status).toBe(400);
	});
});

describe('logo del concello', () => {
	it('GET sin escudo da 404', async () => {
		expect((await get()).status).toBe(404);
	});
	it('PUT sin sesión 401, conserje 403, SVG 400', async () => {
		expect((await put(null, PNG)).status).toBe(401);
		expect((await put(conserje, PNG)).status).toBe(403);
		const res = await put(admin, SVG, 'image/svg+xml');
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('VALIDATION_FAILED');
	});
	it('PUT de un PNG por el admin da 204 y GET lo sirve con cabeceras seguras', async () => {
		expect((await put(admin, PNG)).status).toBe(204);
		const res = await get();
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...PNG]);
	});
	it('GET de un slug inexistente da 404', async () => {
		expect((await get('nada')).status).toBe(404);
	});
	it('con ?v= de la versión actual se sirve inmutable; sin ella o vieja, caché corta', async () => {
		const withQuery = (query: string) =>
			getLogo(
				makeEvent({
					db,
					params: { slug: 'ribadavila' },
					url: `http://localhost/api/v1/m/ribadavila/logo${query}`
				}) as never
			);
		// Tras un único PUT la versión es 1.
		const current = await withQuery('?v=1');
		expect(current.status).toBe(200);
		expect(current.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect((await withQuery('?v=0')).headers.get('cache-control')).toBe('public, max-age=300');
		expect((await withQuery('?v=x')).headers.get('cache-control')).toBe('public, max-age=300');
		expect((await withQuery('')).headers.get('cache-control')).toBe('public, max-age=300');
	});
});
