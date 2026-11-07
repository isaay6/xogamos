// SPDX-License-Identifier: EUPL-1.2
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import type { SessionUser } from '../auth/types';

export const SESSION_COOKIE = 'sesion';
export const SESSION_DAYS = 30;
export const RENEW_BELOW_DAYS = 15;

const MS_DAY = 86_400_000;

/** Solo se guarda este hash; el token en claro vive únicamente en la cookie. */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
	db: Db,
	userId: string,
	now: Date
): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now.getTime() + SESSION_DAYS * MS_DAY);
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: now });
	return { token, expiresAt };
}

export async function validateSession(
	db: Db,
	token: string,
	now: Date
): Promise<{
	user: SessionUser;
	sessionId: string;
	renewedExpiresAt: Date | null;
} | null> {
	const sessionId = hashToken(token);
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			id: users.id,
			displayName: users.displayName
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, sessionId));
	if (!row) return null;
	if (row.expiresAt.getTime() <= now.getTime()) {
		await invalidateSession(db, sessionId);
		return null;
	}
	let renewedExpiresAt: Date | null = null;
	if (row.expiresAt.getTime() - now.getTime() < RENEW_BELOW_DAYS * MS_DAY) {
		renewedExpiresAt = new Date(now.getTime() + SESSION_DAYS * MS_DAY);
		await db
			.update(sessions)
			.set({ expiresAt: renewedExpiresAt })
			.where(eq(sessions.id, sessionId));
	}
	return {
		user: { id: row.id, displayName: row.displayName },
		sessionId,
		renewedExpiresAt
	};
}

export async function invalidateSession(db: Db, sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Opciones de la cookie de sesión: httpOnly, Lax, Path=/, Secure salvo en desarrollo. */
export function sessionCookieOptions(expires: Date, secure: boolean) {
	return {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure,
		expires
	} as const;
}
