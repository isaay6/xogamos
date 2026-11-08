// SPDX-License-Identifier: EUPL-1.2
import type { Db } from '../db/client';
import { createMailTransport, sendPending } from '../services/mailer';
import { runReminders } from './reminders';
import { purgeExpiredData } from './retention';

export const JOBS_INTERVAL_MS = 10 * 60_000;
export const RETENTION_INTERVAL_MS = 24 * 60 * 60_000;

let started = false;

/**
 * Lembranzas del día anterior y envío del buzón: una pasada al arrancar y otra cada 10 min.
 * Una sola vez por proceso y nunca bajo Vitest. Un fallo se registra (sin datos personales) y
 * no tumba el proceso. Sin `SMTP_URL` no se envía nada: las filas quedan en `outbox_emails`.
 */
export function startBackgroundJobs(db: Db, env: { smtpUrl?: string; mailFrom?: string }): boolean {
	if (started || process.env.VITEST) return false;
	started = true;
	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await runReminders(db, new Date());
			const transport = await createMailTransport(env.smtpUrl, env.mailFrom);
			if (transport) await sendPending(db, transport);
		} catch (e) {
			console.error('[avisos] fallo en el trabajo periódico:', e instanceof Error ? e.message : e);
		} finally {
			running = false;
		}
	};
	void tick();
	setInterval(tick, JOBS_INTERVAL_MS).unref();
	const retention = async () => {
		try {
			await purgeExpiredData(db, new Date());
		} catch (e) {
			console.error('[retención] fallo en el trabajo diario:', e instanceof Error ? e.message : e);
		}
	};
	void retention();
	setInterval(retention, RETENTION_INTERVAL_MS).unref();
	return true;
}
