// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from './fixtures';
import { getMunicipalityBySlug } from './municipalities';
import { MAX_LOGO_BYTES, detectImageMime, getLogo, setLogo } from './logo';

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const enc = (s: string) => new TextEncoder().encode(s);

describe('detectImageMime', () => {
	it('reconoce PNG, JPEG y WebP por los bytes mágicos', () => {
		expect(detectImageMime(PNG)).toBe('image/png');
		expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg');
		const webp = new Uint8Array([...enc('RIFF'), 0x10, 0, 0, 0, ...enc('WEBP'), ...enc('VP8 ')]);
		expect(detectImageMime(webp)).toBe('image/webp');
	});
	it('rechaza SVG, HTML y bytes vacíos o cortos', () => {
		expect(detectImageMime(enc('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
		expect(detectImageMime(enc('<!doctype html><p>x'))).toBeNull();
		expect(detectImageMime(new Uint8Array())).toBeNull();
		expect(detectImageMime(enc('RIFF....WAVE'))).toBeNull();
	});
});

describe('setLogo / getLogo', () => {
	let db: Db;
	let fx: Fixture;
	beforeAll(async () => {
		db = await createTestDb();
		fx = await seedFixture(db);
	});

	it('sin escudo devuelve null', async () => {
		expect(await getLogo(db, fx.municipalityId)).toBeNull();
	});
	it('rechaza más de 262 144 bytes', async () => {
		const big = new Uint8Array(MAX_LOGO_BYTES + 1);
		big.set(PNG);
		expect(MAX_LOGO_BYTES).toBe(262_144);
		expect(await setLogo(db, fx.municipalityId, big)).toEqual({
			ok: false,
			error: 'VALIDATION_FAILED'
		});
	});
	it('rechaza un formato no admitido', async () => {
		expect((await setLogo(db, fx.municipalityId, enc('<svg/>'))).ok).toBe(false);
	});
	it('guarda y devuelve bytes y mime; no afecta a otro concello', async () => {
		expect((await setLogo(db, fx.municipalityId, PNG)).ok).toBe(true);
		const got = await getLogo(db, fx.municipalityId);
		expect(got?.mime).toBe('image/png');
		expect([...got!.bytes]).toEqual([...PNG]);
		expect(await getLogo(db, fx.otherMunicipalityId)).toBeNull();
	});
	it('getMunicipalityBySlug no arrastra los bytes: solo hasLogo', async () => {
		const row = await getMunicipalityBySlug(db, 'ribadavila');
		expect(row).not.toHaveProperty('logo');
		expect(row?.hasLogo).toBe(true);
		expect((await getMunicipalityBySlug(db, 'montemaior-do-rio'))?.hasLogo).toBe(false);
	});
});
