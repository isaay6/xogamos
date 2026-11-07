// SPDX-License-Identifier: EUPL-1.2
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET } from '../../../routes/api/v1/openapi.json/+server';
import { makeEvent } from './test-event';
import type { Db } from '../db/client';

const ROOT = 'src/routes';
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function* walk(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (e.name === '+server.ts') yield p;
	}
}

function routeKeys(): string[] {
	const keys: string[] = [];
	for (const file of walk(join(ROOT, 'api/v1'))) {
		const src = readFileSync(file, 'utf8');
		const path =
			'/' +
			file
				.slice(ROOT.length + 1)
				.replace(/\/\+server\.ts$/, '')
				.replace(/\[([^\]]+)\]/g, '{$1}');
		for (const m of src.matchAll(
			/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g
		)) {
			keys.push(`${m[1]} ${path}`);
		}
	}
	return keys.filter((k) => k !== 'GET /api/v1/openapi.json').sort();
}

async function documentedKeys(): Promise<{ doc: Record<string, unknown>; keys: string[] }> {
	const res = await GET(makeEvent({ db: {} as Db }) as never);
	const doc = (await res.json()) as { paths: Record<string, Record<string, unknown>> };
	const keys = Object.entries(doc.paths).flatMap(([path, ops]) =>
		Object.keys(ops)
			.filter((m) => METHODS.includes(m.toUpperCase()))
			.map((m) => `${m.toUpperCase()} ${path}`)
	);
	return { doc, keys: keys.sort() };
}

describe('documento OpenAPI', () => {
	it('es 3.1 con licencia EUPL-1.2', async () => {
		const { doc } = await documentedKeys();
		expect(String(doc.openapi)).toMatch(/^3\.1\./);
		expect((doc.info as { license: { name: string } }).license.name).toBe('EUPL-1.2');
	});

	it('no hay deriva entre rutas y documento', async () => {
		const { keys } = await documentedKeys();
		expect(routeKeys().length).toBeGreaterThan(0);
		expect(keys).toEqual(routeKeys());
	});

	it('declara 201 en las ocho creaciones y 200 en el resto de éxitos', async () => {
		const { doc } = await documentedKeys();
		const paths = (
			doc as unknown as { paths: Record<string, Record<string, { responses: object }>> }
		).paths;
		const created = [
			'post /api/v1/m/{slug}/bookings',
			'post /api/v1/m/{slug}/staff/bookings',
			'post /api/v1/m/{slug}/staff/people',
			'post /api/v1/m/{slug}/admin/facility-types',
			'post /api/v1/m/{slug}/admin/facilities',
			'post /api/v1/m/{slug}/admin/facilities/{id}/closures',
			'post /api/v1/deputacion/municipalities',
			'post /api/v1/m/{slug}/admin/staff'
		];
		for (const key of created) {
			const [method, path] = key.split(' ');
			const r = paths[path][method].responses as Record<string, unknown>;
			expect(Object.keys(r), key).toContain('201');
			expect(Object.keys(r), key).not.toContain('200');
		}
		const get = paths['/api/v1/me'].get.responses as Record<string, unknown>;
		expect(Object.keys(get)).toContain('200');
	});

	it('el estado declarado coincide con el del manejador (alta de concello)', async () => {
		const { createTestDb } = await import('../db/test-db');
		const { staffRoles, users } = await import('../db/schema');
		const { POST } = await import('../../../routes/api/v1/deputacion/municipalities/+server');
		const db = await createTestDb();
		const [dep] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'dep', displayName: 'Dep' })
			.returning();
		await db
			.insert(staffRoles)
			.values({ userId: dep.id, municipalityId: null, role: 'deputacion' });
		const res = await POST(
			makeEvent({
				db,
				method: 'POST',
				user: { id: dep.id, displayName: 'Dep' },
				body: {
					slug: 'concello-demo',
					name: 'Concello Demo',
					province: 'Lugo',
					primaryColor: '#112233',
					firstAdmin: { provider: 'clave', subject: 'x1', displayName: 'X' }
				}
			}) as never
		);
		const { doc } = await documentedKeys();
		const declared = (
			doc as unknown as {
				paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
			}
		).paths['/api/v1/deputacion/municipalities'].post.responses;
		expect(declared[String(res.status)]).toBeDefined();
		expect(res.status).toBe(201);
	});

	it('define el esquema de seguridad por cookie y la seguridad por operación', async () => {
		const { doc } = await documentedKeys();
		const d = doc as unknown as {
			components: { securitySchemes: Record<string, unknown> };
			paths: Record<string, Record<string, { security: object[] }>>;
		};
		expect(d.components.securitySchemes.sesion).toEqual({
			type: 'apiKey',
			in: 'cookie',
			name: 'sesion'
		});
		expect(d.paths['/api/v1/me'].get.security).toEqual([{ sesion: [] }]);
		expect(d.paths['/api/v1/m/{slug}/facilities'].get.security).toEqual([]);
	});

	it('el 400 documenta issues y el 422 también cuando hay INVALID_CONFIG', async () => {
		const { doc } = await documentedKeys();
		type Op = { responses: Record<string, { content: Record<string, { schema: any }> }> };
		const ops = Object.values(
			(doc as unknown as { paths: Record<string, Record<string, Op>> }).paths
		).flatMap((o) => Object.values(o));
		const r400 = ops.map((o) => o.responses['400']).filter(Boolean);
		expect(r400.length).toBeGreaterThan(0);
		for (const r of r400) {
			const props = r.content['application/json'].schema.properties;
			expect(props.issues.type).toBe('array');
			expect(props.issues.items.required).toEqual(['path', 'message']);
		}
		const cfg = ops
			.map((o) => o.responses['422'])
			.filter(
				(r) =>
					r && r.content['application/json'].schema.properties.error.enum.includes('INVALID_CONFIG')
			);
		expect(cfg.length).toBeGreaterThan(0);
		for (const r of cfg)
			expect(r.content['application/json'].schema.properties.issues).toBeDefined();
	});
});
