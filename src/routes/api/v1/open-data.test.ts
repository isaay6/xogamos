// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { facilities, users } from '../../../lib/server/db/schema';
import { makeEvent } from '../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { GET as geojson } from './m/[slug]/open-data/facilities.geojson/+server';
import { GET as jsonld } from './open-data/catalog.jsonld/+server';
import { GET as turtle } from './open-data/catalog.ttl/+server';
import { load as docs } from '../docs/+page.server';
import DocsPage from '../docs/+page.svelte';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db
		.update(facilities)
		.set({ latitude: 42.34, longitude: -7.86 })
		.where(eq(facilities.id, fx.facilityId));
});

const ev = (params: Record<string, string> = {}) =>
	makeEvent({ db, params, url: 'http://localhost/' }) as never;

describe('GeoJSON de instalacións abertas', () => {
	it('publica só as activas con coordenadas e nunca datos persoais', async () => {
		const [person] = await db.select().from(users).where(eq(users.id, fx.userId));
		const res = await geojson(ev({ slug: 'ribadavila' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/geo+json');
		expect(res.headers.get('access-control-allow-origin')).toBe('*');
		const text = await res.text();
		expect(text).not.toContain(person.displayName);
		if (person.email) expect(text).not.toContain(person.email);
		expect(text).not.toContain('facilityId');
		const data = JSON.parse(text);
		expect(data.type).toBe('FeatureCollection');
		expect(data.features).toHaveLength(1);
		expect(data.features[0]).toMatchObject({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [-7.86, 42.34] },
			properties: {
				name: 'Pista 1',
				sport: expect.any(String),
				address: expect.any(String),
				accessible: expect.any(Boolean),
				prices: { residentCents: expect.any(Number), nonResidentCents: expect.any(Number) },
				url: 'http://localhost/ribadavila/reservar'
			}
		});
	});

	it('exclúe unha instalación inactiva ou sen coordenadas', async () => {
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, fx.facilityId));
		expect((await (await geojson(ev({ slug: 'ribadavila' }))).json()).features).toEqual([]);
		await db
			.update(facilities)
			.set({ active: true, latitude: null, longitude: null })
			.where(eq(facilities.id, fx.facilityId));
		expect((await (await geojson(ev({ slug: 'ribadavila' }))).json()).features).toEqual([]);
	});
});

describe('catálogo DCAT-AP-ES', () => {
	it('JSON-LD e Turtle describen distribucións sen persoas', async () => {
		const [person] = await db.select().from(users).where(eq(users.id, fx.userId));
		const json = await jsonld(ev());
		const text = await json.text();
		expect(json.headers.get('content-type')).toContain('application/ld+json');
		expect(text).not.toContain(person.displayName);
		expect(text).not.toContain('email');
		const catalog = JSON.parse(text);
		expect(catalog['@type']).toBe('dcat:Catalog');
		for (const dataset of catalog['dcat:dataset']) {
			expect(dataset).toHaveProperty('dct:publisher');
			expect(dataset).toHaveProperty('dct:spatial');
			expect(dataset['dcat:theme']).toBe('http://datos.gob.es/kos/sector-publico/sector/deporte');
			expect(dataset['dct:language']).toEqual(['gl', 'es']);
			expect(dataset['dcat:distribution'][0]).toHaveProperty('dct:license');
		}
		const ttl = await (await turtle(ev())).text();
		expect(ttl).toContain('@prefix dcat:');
		expect(ttl).toContain('dct:license');
		expect(ttl).not.toContain(person.displayName);
	});
});

describe('documentación lexible', () => {
	it('renderiza os endpoints rexistrados, incluído GeoJSON', () => {
		const data = docs({} as never) as unknown as { endpoints: unknown[] };
		expect(data.endpoints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					method: 'GET',
					path: '/api/v1/m/{slug}/open-data/facilities.geojson'
				})
			])
		);
		const html = render(DocsPage as never, { props: { data } as never }).body;
		expect(html).toContain('Documentación da API');
		expect(html).toContain('/api/v1/m/{slug}/open-data/facilities.geojson');
		expect(html).toContain('/api/v1/openapi.json');
	});
});
