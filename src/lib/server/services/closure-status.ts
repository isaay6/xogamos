// SPDX-License-Identifier: EUPL-1.2
// Estado breve dos peches que cobren un día local, compartido polas listas.
import { and, eq, inArray, lt, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { closures } from '../db/schema';
import { addLocalDays } from '../domain/time';
import { localDayBounds } from './bookings';

export type ClosureToday = { startsOn: string; endsOn: string };

/** Peches activos nalgunha parte do día, co último día pechado inclusive. */
export async function closuresToday(db: Db, facilityIds: string[], date: string) {
	if (facilityIds.length === 0) return new Map<string, ClosureToday>();
	const { dayStart, dayEnd } = localDayBounds(date);
	const rows = await db
		.select({
			facilityId: closures.facilityId,
			startsAt: closures.startsAt,
			endsAt: closures.endsAt
		})
		.from(closures)
		.where(
			and(
				inArray(closures.facilityId, facilityIds),
				eq(closures.kind, 'peche'),
				lt(closures.startsAt, dayEnd),
				gt(closures.endsAt, dayStart)
			)
		);
	return new Map(
		rows.map((row) => [
			row.facilityId,
			{
				startsOn: date,
				endsOn: addLocalDays(
					date,
					Math.max(0, Math.ceil((row.endsAt.getTime() - dayStart.getTime()) / 86_400_000) - 1)
				)
			}
		])
	);
}
