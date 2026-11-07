// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import { createSession, invalidateSession, validateSession } from './sessions';

let db: Db;
let userId: string;
const now = new Date('2026-11-24T10:00:00Z');
const DAY = 86_400_000;

beforeAll(async () => {
	db = await createTestDb();
	const [u] = await db
		.insert(users)
		.values({ provider: 'clave', subject: 'T-1', displayName: 'Persoa Proba' })
		.returning();
	userId = u.id;
});

describe('sessions', () => {
	it('crea y valida devolviendo el usuario', async () => {
		const { token, expiresAt } = await createSession(db, userId, now);
		expect(expiresAt.getTime()).toBe(now.getTime() + 30 * DAY);
		const v = await validateSession(db, token, now);
		expect(v?.user).toEqual({ id: userId, displayName: 'Persoa Proba' });
		expect(v?.renewedExpiresAt).toBeNull();
	});

	it('el token no está en claro en la tabla', async () => {
		const { token } = await createSession(db, userId, now);
		const rows = await db.select().from(sessions);
		expect(rows.some((r) => r.id === token)).toBe(false);
		const v = await validateSession(db, token, now);
		expect(v!.sessionId).not.toBe(token);
		expect(v!.sessionId).toMatch(/^[0-9a-f]{64}$/);
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('caducada: null y se borra la fila', async () => {
		const { token } = await createSession(db, userId, now);
		const sessionId = (await validateSession(db, token, now))!.sessionId;
		const later = new Date(now.getTime() + 31 * DAY);
		expect(await validateSession(db, token, later)).toBeNull();
		expect(await db.select().from(sessions).where(eq(sessions.id, sessionId))).toHaveLength(0);
	});

	it('con menos de 15 días renueva a 30', async () => {
		const { token } = await createSession(db, userId, now);
		const later = new Date(now.getTime() + 20 * DAY); // quedan 10
		const v = await validateSession(db, token, later);
		expect(v?.renewedExpiresAt?.getTime()).toBe(later.getTime() + 30 * DAY);
		const [row] = await db.select().from(sessions).where(eq(sessions.id, v!.sessionId));
		expect(row.expiresAt.getTime()).toBe(later.getTime() + 30 * DAY);
	});

	it('invalidateSession deja la sesión sin efecto', async () => {
		const { token } = await createSession(db, userId, now);
		const v = await validateSession(db, token, now);
		await invalidateSession(db, v!.sessionId);
		expect(await validateSession(db, token, now)).toBeNull();
	});

	it('un token desconocido devuelve null', async () => {
		expect(await validateSession(db, 'nope', now)).toBeNull();
	});
});
