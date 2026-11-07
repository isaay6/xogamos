// SPDX-License-Identifier: EUPL-1.2
import { and, eq, gte, isNull, lt, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bookings, facilities, notifications, tournamentEntries, tournaments } from '../db/schema';
import { addLocalDays, localDateOf } from '../domain/time';
import { localDayBounds } from '../services/bookings';
import { notifyOnce, notifyBooking } from '../services/notifications';

/** Las reservas hechas hace menos de esto no reciben lembranza todavía. */
const MIN_BOOKING_AGE_MS = 60 * 60_000;

/**
 * Crea una «lembranza» para cada reserva confirmada cuyo día local de inicio es mañana (día
 * local de `now` + 1, en Europe/Madrid; las 00:30 locales cuentan en su día, no en el UTC).
 * Idempotente: el índice único (reserva, 'reminder') evita la segunda, también tras un reinicio.
 * Devuelve cuántas creó. Cada aviso lleva el concello de su propia reserva.
 */
export async function runReminders(db: Db, now: Date): Promise<number> {
	const { dayStart, dayEnd } = localDayBounds(addLocalDays(localDateOf(now), 1));
	const recent = new Date(now.getTime() - MIN_BOOKING_AGE_MS);
	const due = await db
		.select()
		.from(bookings)
		.where(
			and(
				eq(bookings.status, 'confirmed'),
				gte(bookings.startsAt, dayStart),
				lt(bookings.startsAt, dayEnd),
				// Una reserva recién hecha ya tiene su aviso de confirmación: sin lembranza inmediata.
				lte(bookings.createdAt, recent),
				sql`not exists (select 1 from ${notifications} n where n.booking_id = ${bookings.id} and n.kind = 'reminder')`
			)
		);
	let created = 0;
	for (const booking of due) {
		// Una transacción por reserva: un fallo no deshace las demás.
		const made = await db.transaction((tx) => notifyBooking(tx, booking, 'reminder'));
		if (made) created++;
	}
	const tomorrow = addLocalDays(localDateOf(now), 1);
	const tournamentDue = await db
		.select({ entry: tournamentEntries, tournament: tournaments, facilityName: facilities.name })
		.from(tournamentEntries)
		.innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
		.innerJoin(facilities, eq(facilities.id, tournaments.facilityId))
		.where(
			and(
				eq(tournaments.status, 'publicado'),
				eq(tournaments.startsOn, tomorrow),
				isNull(tournamentEntries.cancelledAt)
			)
		);
	for (const row of tournamentDue) {
		const made = await db.transaction((tx) =>
			notifyOnce(tx, {
				userId: row.entry.userId,
				municipalityId: row.tournament.municipalityId,
				kind: 'tournament_reminder',
				tournamentId: row.tournament.id,
				params: {
					tournamentId: row.tournament.id,
					tournamentTitle: row.tournament.title,
					facilityName: row.facilityName
				}
			})
		);
		if (made) created++;
	}
	return created;
}
