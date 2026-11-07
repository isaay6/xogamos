// SPDX-License-Identifier: EUPL-1.2
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { staffRoles, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from '../services/fixtures';
import { requirePageStaff, requirePageUser } from './page-guards';
import { makeEvent } from './test-event';

let db: Db;
let fx: Fixture;
let conserxeMonte: string;
let adminRiba: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [c, a] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'pg-conserxe', displayName: 'Conserxe Monte' },
			{ provider: 'local', subject: 'pg-admin', displayName: 'Admin Riba' }
		])
		.returning();
	conserxeMonte = c.id;
	adminRiba = a.id;
	await db.insert(staffRoles).values([
		{ userId: c.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' },
		{ userId: a.id, municipalityId: fx.municipalityId, role: 'admin' }
	]);
});

const ev = (userId: string | null, url = 'http://localhost/ribadavila/reservas') =>
	makeEvent({
		db,
		url,
		params: { slug: 'ribadavila' },
		user: userId ? { id: userId, displayName: 'X' } : null
	});

function thrown(fn: () => unknown): unknown {
	try {
		fn();
	} catch (e) {
		return e;
	}
	throw new Error('non lanzou');
}

async function rejected(p: Promise<unknown>): Promise<unknown> {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('non lanzou');
}

describe('requirePageUser', () => {
	it('sen sesión redirixe a entrar con redirectTo', () => {
		const e = thrown(() => requirePageUser(ev(null)));
		expect(isRedirect(e)).toBe(true);
		expect(e).toMatchObject({
			status: 303,
			location: '/ribadavila/entrar?redirectTo=%2Fribadavila%2Freservas'
		});
	});

	it('conserva a consulta na volta', () => {
		const e = thrown(() =>
			requirePageUser(ev(null, 'http://localhost/ribadavila/reservar?dia=2026-10-22'))
		);
		expect(e).toMatchObject({
			location: '/ribadavila/entrar?redirectTo=%2Fribadavila%2Freservar%3Fdia%3D2026-10-22'
		});
	});

	it('con sesión devolve o usuario', () => {
		expect(requirePageUser(ev(fx.userId))).toEqual({ id: fx.userId, displayName: 'X' });
	});
});

describe('requirePageStaff', () => {
	it('sen sesión redirixe a entrar', async () => {
		const e = await rejected(requirePageStaff(ev(null), fx.municipalityId, ['conserxe']));
		expect(isRedirect(e)).toBe(true);
		expect(e).toMatchObject({ status: 303 });
	});

	it('unha veciña sen rol recibe 403', async () => {
		const e = await rejected(requirePageStaff(ev(fx.userId), fx.municipalityId, ['conserxe']));
		expect(isHttpError(e, 403)).toBe(true);
	});

	it('un conserxe de Montemaior en Ribadávila recibe 403', async () => {
		const e = await rejected(requirePageStaff(ev(conserxeMonte), fx.municipalityId, ['conserxe']));
		expect(isHttpError(e, 403)).toBe(true);
	});

	it('un admin cumpre o requisito de conserxe', async () => {
		const u = await requirePageStaff(ev(adminRiba), fx.municipalityId, ['conserxe']);
		expect(u.id).toBe(adminRiba);
	});
});
