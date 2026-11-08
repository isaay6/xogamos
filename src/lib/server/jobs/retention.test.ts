// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { notifications, outboxEmails, sessions, users } from '../db/schema';
import { purgeExpiredData } from './retention';

describe('purgeExpiredData', () => {
	it('borra só sesións, correos e avisos que xa caducaron', async () => {
		const db = await createTestDb();
		const now = new Date('2026-11-08T12:00:00.000Z');
		const old = new Date('2025-01-01T12:00:00.000Z');
		const recent = new Date('2026-11-01T12:00:00.000Z');
		const [user] = await db
			.insert(users)
			.values({ provider: 'clave', subject: 'retention', displayName: 'Retención' })
			.returning();
		await db.insert(sessions).values([
			{ id: 'expired', userId: user.id, expiresAt: old, createdAt: old },
			{
				id: 'active',
				userId: user.id,
				expiresAt: new Date('2026-12-01T12:00:00.000Z'),
				createdAt: old
			}
		]);
		const [oldSent, oldPending, recentFailed] = await db
			.insert(outboxEmails)
			.values([
				{ toAddress: 'a@example.gal', subject: 'old sent', body: '', createdAt: old, sentAt: old },
				{ toAddress: 'b@example.gal', subject: 'old pending', body: '', createdAt: old },
				{
					toAddress: 'c@example.gal',
					subject: 'recent failed',
					body: '',
					createdAt: recent,
					error: 'bad address'
				}
			])
			.returning();
		const [oldRead, recentRead, unread] = await db
			.insert(notifications)
			.values([
				{ userId: user.id, kind: 'confirmed', readAt: old, createdAt: old },
				{ userId: user.id, kind: 'changed', readAt: recent, createdAt: old },
				{ userId: user.id, kind: 'closure', createdAt: old }
			])
			.returning();

		await purgeExpiredData(db, now);

		expect(await db.select().from(sessions).where(eq(sessions.id, 'expired'))).toHaveLength(0);
		expect(await db.select().from(sessions).where(eq(sessions.id, 'active'))).toHaveLength(1);
		expect(
			await db.select().from(outboxEmails).where(eq(outboxEmails.id, oldSent.id))
		).toHaveLength(0);
		expect(
			await db.select().from(outboxEmails).where(eq(outboxEmails.id, oldPending.id))
		).toHaveLength(1);
		expect(
			await db.select().from(outboxEmails).where(eq(outboxEmails.id, recentFailed.id))
		).toHaveLength(1);
		expect(
			await db.select().from(notifications).where(eq(notifications.id, oldRead.id))
		).toHaveLength(0);
		expect(
			await db.select().from(notifications).where(eq(notifications.id, recentRead.id))
		).toHaveLength(1);
		expect(
			await db.select().from(notifications).where(eq(notifications.id, unread.id))
		).toHaveLength(1);
	});
});
