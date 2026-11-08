// SPDX-License-Identifier: EUPL-1.2
import { and, isNotNull, lt, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notifications, outboxEmails, sessions } from '../db/schema';

/** Os correos xa rematados non son necesarios pasados trinta días. */
export const OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60_000;
/** Os avisos lidos quedan dispoñibles un ano para a persoa usuaria. */
export const READ_NOTIFICATIONS_RETENTION_MS = 365 * 24 * 60 * 60_000;

/** Só elimina datos efémeros; reservas, monedero e actividade seguen con conservación legal. */
export async function purgeExpiredData(db: Db, now: Date): Promise<void> {
	const outboxBefore = new Date(now.getTime() - OUTBOX_RETENTION_MS);
	const notificationsBefore = new Date(now.getTime() - READ_NOTIFICATIONS_RETENTION_MS);
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
	await db
		.delete(outboxEmails)
		.where(
			and(
				lt(outboxEmails.createdAt, outboxBefore),
				or(isNotNull(outboxEmails.sentAt), isNotNull(outboxEmails.error))
			)
		);
	await db
		.delete(notifications)
		.where(and(isNotNull(notifications.readAt), lt(notifications.readAt, notificationsBefore)));
}
