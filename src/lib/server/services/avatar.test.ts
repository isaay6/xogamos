// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { staffRoles, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { clearAvatarPhoto, getAvatarPhoto, setAvatarKey, setAvatarPhoto } from './avatar';
import { seedFixture, type Fixture } from './fixtures';
import { MAX_LOGO_BYTES } from './logo';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

let db: Db;
let fx: Fixture;
let staffId: string;
let strangerId: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [staff, stranger] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'av-staff', displayName: 'Conserxe' },
			{ provider: 'local', subject: 'av-stranger', displayName: 'Outra' }
		])
		.returning();
	staffId = staff.id;
	strangerId = stranger.id;
	await db
		.insert(staffRoles)
		.values({ userId: staffId, municipalityId: fx.municipalityId, role: 'conserxe' });
});

describe('setAvatarKey', () => {
	it('guarda una clave del catálogo y permite quitarla', async () => {
		await setAvatarKey(db, fx.userId, 'muller-lentes');
		const [u] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(u.avatarKey).toBe('muller-lentes');
		await setAvatarKey(db, fx.userId, null);
		const [v] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(v.avatarKey).toBeNull();
	});
	it('borra la foto: el dibujo escogido es el que se ve', async () => {
		expect((await setAvatarPhoto(db, fx.userId, PNG, PNG.length)).ok).toBe(true);
		await setAvatarKey(db, fx.userId, 'deporte-padel');
		const [u] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(u.avatarKey).toBe('deporte-padel');
		expect(u.avatarPhoto).toBeNull();
		expect(u.avatarMime).toBeNull();
	});
});

describe('setAvatarPhoto', () => {
	it('rechaza SVG con UNSUPPORTED_IMAGE', async () => {
		const r = await setAvatarPhoto(db, fx.userId, SVG, SVG.length);
		expect(r).toEqual({ ok: false, error: 'UNSUPPORTED_IMAGE' });
	});

	it('rechaza más de 256 KB con PHOTO_TOO_LARGE', async () => {
		const big = new Uint8Array(300 * 1024);
		big.set(PNG);
		expect(await setAvatarPhoto(db, fx.userId, big, big.length)).toEqual({
			ok: false,
			error: 'PHOTO_TOO_LARGE'
		});
		// La longitud declarada también cuenta.
		expect(await setAvatarPhoto(db, fx.userId, PNG, MAX_LOGO_BYTES + 1)).toEqual({
			ok: false,
			error: 'PHOTO_TOO_LARGE'
		});
	});

	it('rechaza un cuerpo vacío', async () => {
		expect((await setAvatarPhoto(db, fx.userId, new Uint8Array(), 0)).ok).toBe(false);
	});

	it('guarda un PNG válido y clearAvatarPhoto lo borra', async () => {
		const r = await setAvatarPhoto(db, fx.userId, PNG, PNG.length);
		expect(r.ok).toBe(true);
		const [u] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(u.avatarMime).toBe('image/png');
		await clearAvatarPhoto(db, fx.userId);
		const [v] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(v.avatarPhoto).toBeNull();
		expect(v.avatarMime).toBeNull();
	});
});

describe('getAvatarPhoto', () => {
	beforeAll(async () => {
		await setAvatarPhoto(db, fx.userId, PNG, PNG.length);
	});

	it('el propio usuario la ve', async () => {
		const p = await getAvatarPhoto(db, fx.userId, fx.userId);
		expect(p?.mime).toBe('image/png');
		expect(Array.from(p!.bytes)).toEqual(Array.from(PNG));
	});

	it('el personal de un concello donde tiene perfil la ve', async () => {
		expect(await getAvatarPhoto(db, staffId, fx.userId)).not.toBeNull();
	});

	it('personal de otro concello y otras personas no', async () => {
		expect(await getAvatarPhoto(db, strangerId, fx.userId)).toBeNull();
		await db
			.insert(staffRoles)
			.values({ userId: strangerId, municipalityId: fx.otherMunicipalityId, role: 'admin' });
		// Perfil en Ribadávila, no en Montemaior (el seguimiento aún no creó perfil allí).
		expect(await getAvatarPhoto(db, strangerId, fx.userId)).toBeNull();
	});

	it('la deputación no la ve, con municipio nulo ni con una fila forzada', async () => {
		const [dep] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'av-dep', displayName: 'Deputación' })
			.returning();
		await db
			.insert(staffRoles)
			.values({ userId: dep.id, municipalityId: null, role: 'deputacion' });
		expect(await getAvatarPhoto(db, dep.id, fx.userId)).toBeNull();
		await db
			.insert(staffRoles)
			.values({ userId: dep.id, municipalityId: fx.municipalityId, role: 'deputacion' });
		expect(await getAvatarPhoto(db, dep.id, fx.userId)).toBeNull();
	});

	it('sin foto o usuario inexistente da null', async () => {
		expect(await getAvatarPhoto(db, staffId, staffId)).toBeNull();
		expect(await getAvatarPhoto(db, staffId, '00000000-0000-4000-8000-000000000000')).toBeNull();
	});
});
