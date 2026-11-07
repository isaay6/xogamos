// SPDX-License-Identifier: EUPL-1.2
// Reservas afectadas por un cierre o por un cambio de horario. Un único predicado para el recuento
// del aviso previo (409) y para quienes reciben el aviso, de modo que ambos coinciden siempre.
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bookings, type BookingRow } from '../db/schema';
import { localDateOf, localTimeOf, weekdayOf } from '../domain/time';
import type { Hours } from '../domain/types';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Reservas `confirmed` futuras que caen dentro de un cierre `[from, to)`: empiezan antes de que
 * acabe el cierre y terminan después de que empiece (o de ahora, si el cierre ya empezó).
 */
export function findBookingsInClosure(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	closure: { from: Date; to: Date },
	now: Date
): Promise<BookingRow[]> {
	const since = closure.from > now ? closure.from : now;
	return q
		.select()
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.facilityId, facilityId),
				eq(bookings.status, 'confirmed'),
				gt(bookings.endsAt, since),
				lt(bookings.startsAt, closure.to)
			)
		);
}

/** Reservas `confirmed` futuras que quedarían fuera del horario nuevo (día y tramo locales). */
export async function findBookingsOutsideHours(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	hours: Hours[],
	now: Date
): Promise<BookingRow[]> {
	const rows = await q
		.select()
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.facilityId, facilityId),
				eq(bookings.status, 'confirmed'),
				gt(bookings.startsAt, now)
			)
		);
	return rows.filter((b) => {
		const day = localDateOf(b.startsAt);
		const from = localTimeOf(b.startsAt);
		// Una reserva que acaba pasada la medianoche no cabe en ningún tramo (cierran antes de las 24:00).
		const to = localDateOf(b.endsAt) === day ? localTimeOf(b.endsAt) : '24:00';
		const weekday = weekdayOf(day);
		return !hours.some((h) => h.weekday === weekday && h.opens <= from && to <= h.closes);
	});
}
