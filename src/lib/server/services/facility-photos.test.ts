// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from './fixtures';
import { MAX_LOGO_BYTES } from './logo';
import {
	addFacilityPhoto,
	getPublicFacilityPhoto,
	listFacilityPhotos,
	moveFacilityPhoto
} from './facility-photos';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const SVG = new TextEncoder().encode('<svg></svg>');
let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
});

describe('fotos de instalación', () => {
	it('rexeita bytes que non son JPEG, PNG ou WebP e imaxes demasiado grandes', async () => {
		expect(
			await addFacilityPhoto(db, fx.municipalityId, fx.facilityId, SVG, SVG.length, 'Vista', '')
		).toEqual({ ok: false, error: 'UNSUPPORTED_IMAGE' });
		const big = new Uint8Array(MAX_LOGO_BYTES + 1);
		big.set(PNG);
		expect(
			await addFacilityPhoto(db, fx.municipalityId, fx.facilityId, big, big.length, 'Vista', '')
		).toEqual({ ok: false, error: 'PHOTO_TOO_LARGE' });
	});

	it('esixe un texto alternativo en galego', async () => {
		expect(
			await addFacilityPhoto(db, fx.municipalityId, fx.facilityId, PNG, PNG.length, '  ', '')
		).toEqual({ ok: false, error: 'ALT_REQUIRED' });
	});

	it('garda, ordena e só serve a foto no concello e instalación activa correctos', async () => {
		expect(
			await addFacilityPhoto(
				db,
				fx.municipalityId,
				fx.facilityId,
				PNG,
				PNG.length,
				'Pista cuberta',
				''
			)
		).toEqual({ ok: true, value: undefined });
		const second = await addFacilityPhoto(
			db,
			fx.municipalityId,
			fx.facilityId,
			PNG,
			PNG.length,
			'Entrada da pista',
			'Entrada de la pista'
		);
		expect(second.ok).toBe(true);
		const before = await listFacilityPhotos(db, fx.facilityId);
		await moveFacilityPhoto(db, fx.municipalityId, fx.facilityId, before[1].id, -1);
		expect((await listFacilityPhotos(db, fx.facilityId))[0].altGl).toBe('Entrada da pista');
		expect(
			await getPublicFacilityPhoto(db, fx.otherMunicipalityId, fx.facilityId, before[0].id)
		).toBeNull();
		expect(
			await getPublicFacilityPhoto(db, fx.municipalityId, fx.otherFacilityId, before[0].id)
		).toBeNull();
	});
});
