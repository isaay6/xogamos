// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { outboxEmails } from '../db/schema';

export type MailTransport = {
	send(to: string, subject: string, body: string): Promise<void>;
};

/**
 * Transporte SMTP con nodemailer, solo si hay `SMTP_URL`. Sin ella devuelve null: no se envía
 * nada y las filas se quedan en `outbox_emails` (visibles en la demo).
 */
export async function createMailTransport(
	smtpUrl: string | undefined,
	from: string | undefined
): Promise<MailTransport | null> {
	if (!smtpUrl) return null;
	const { createTransport } = await import('nodemailer');
	const transporter = createTransport(smtpUrl);
	const sender = from || 'avisos@localhost';
	return {
		async send(to, subject, body) {
			await transporter.sendMail({ from: sender, to, subject, text: body });
		}
	};
}

/** Reclamos más viejos que esto se consideran abandonados (el proceso murió a media tanda). */
const CLAIM_TTL_MS = 5 * 60_000;

/** Rechazo definitivo del servidor (5xx) o sobre inválido: reintentar no sirve. */
export function isPermanentMailError(e: unknown): boolean {
	if (typeof e !== 'object' || e === null) return false;
	const { responseCode, code } = e as { responseCode?: unknown; code?: unknown };
	if (code === 'EENVELOPE') return true;
	return typeof responseCode === 'number' && responseCode >= 500 && responseCode < 600;
}

/**
 * Envía hasta `limit` correos pendientes del buzón sin mantener ninguna transacción ni bloqueo
 * durante el envío: primero se reclaman las filas (un UPDATE corto con `skip locked`) y cada una
 * se marca como enviada en su propia sentencia. Solo un rechazo permanente (5xx, EENVELOPE) guarda
 * `error`; un fallo transitorio (conexión, tiempo) libera las filas y detiene la tanda, y se
 * reintentan en la siguiente pasada. Devuelve cuántos salieron.
 */
export async function sendPending(db: Db, transport: MailTransport, limit = 20): Promise<number> {
	const now = new Date();
	const stale = new Date(now.getTime() - CLAIM_TTL_MS);
	const claimed = await db
		.update(outboxEmails)
		.set({ claimedAt: now })
		.where(
			inArray(
				outboxEmails.id,
				db
					.select({ id: outboxEmails.id })
					.from(outboxEmails)
					.where(
						and(
							isNull(outboxEmails.sentAt),
							isNull(outboxEmails.error),
							or(isNull(outboxEmails.claimedAt), lt(outboxEmails.claimedAt, stale))
						)
					)
					.orderBy(asc(outboxEmails.createdAt), asc(outboxEmails.id))
					.limit(limit)
					.for('update', { skipLocked: true })
			)
		)
		.returning();
	claimed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));

	let sent = 0;
	for (let i = 0; i < claimed.length; i++) {
		const mail = claimed[i];
		try {
			await transport.send(mail.toAddress, mail.subject, mail.body);
		} catch (e) {
			if (isPermanentMailError(e)) {
				const message = e instanceof Error ? e.message : String(e);
				await db
					.update(outboxEmails)
					.set({ error: message.slice(0, 500), claimedAt: null })
					.where(eq(outboxEmails.id, mail.id));
				continue;
			}
			// Transitorio: esta y las que faltan quedan pendientes; se para la tanda.
			await db
				.update(outboxEmails)
				.set({ claimedAt: null })
				.where(
					inArray(
						outboxEmails.id,
						claimed.slice(i).map((m) => m.id)
					)
				);
			return sent;
		}
		await db
			.update(outboxEmails)
			.set({ sentAt: new Date(), claimedAt: null })
			.where(eq(outboxEmails.id, mail.id));
		sent++;
	}
	return sent;
}
