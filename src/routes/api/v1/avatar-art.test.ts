// SPDX-License-Identifier: EUPL-1.2
// Debuxo do avatar como imaxe (tarefa 8 de v1): a insignia da cabeceira non carga o catálogo en JS.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../../lib/server/db/client';
import { makeEvent } from '../../../lib/server/http/test-event';
import { AVATARS } from '../../../lib/avatars';
import { GET } from './avatars/[key]/+server';

const get = (key: string) =>
	GET(
		makeEvent({
			db: {} as Db,
			params: { key },
			url: `http://localhost/api/v1/avatars/${key}`
		}) as never
	);

describe('GET /api/v1/avatars/{key}', () => {
	it('cada debuxo do catálogo é un SVG autónomo, sen script e con cabeceiras seguras', async () => {
		for (const key of AVATARS) {
			const res = await get(key);
			expect(res.status, key).toBe(200);
			expect(res.headers.get('content-type')).toBe('image/svg+xml');
			expect(res.headers.get('x-content-type-options')).toBe('nosniff');
			expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
			expect(res.headers.get('cache-control')).toContain('public');
			const svg = await res.text();
			expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), key).toBe(true);
			expect(svg).not.toContain('__clip__');
			expect(svg).not.toMatch(/<script|on\w+=/i);
		}
	});

	it('unha clave descoñecida dá 404', async () => {
		for (const key of ['dragon', '../etc', '']) {
			const res = await get(key);
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
		}
	});
});
