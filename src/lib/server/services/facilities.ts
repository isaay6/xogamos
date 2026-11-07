// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { facilities, facilityTypes } from '../db/schema';
import type { SlotAvailability } from '../domain/availability';
import { getAvailability } from './bookings';
import { err, type Result } from './result';

export function listActiveFacilities(db: Db, municipalityId: string) {
	return db
		.select({
			id: facilities.id,
			name: facilities.name,
			units: facilities.units,
			capacity: facilities.capacity,
			slotMinutes: facilities.slotMinutes,
			priceResidentCents: facilities.priceResidentCents,
			priceNonResidentCents: facilities.priceNonResidentCents,
			accessible: facilities.accessible,
			rules: facilities.rules,
			nameGl: facilityTypes.nameGl,
			nameEs: facilityTypes.nameEs,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			bookingMode: facilityTypes.bookingMode
		})
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.where(and(eq(facilities.municipalityId, municipalityId), eq(facilities.active, true)))
		.orderBy(asc(facilities.name));
}

/** Disponibilidad pública: una instalación desactivada no existe para el público. */
export async function getPublicAvailability(
	db: Db,
	municipalityId: string,
	facilityId: string,
	date: string
): Promise<Result<SlotAvailability[], 'NOT_FOUND'>> {
	const [active] = await db
		.select({ id: facilities.id })
		.from(facilities)
		.where(
			and(
				eq(facilities.id, facilityId),
				eq(facilities.municipalityId, municipalityId),
				eq(facilities.active, true)
			)
		);
	if (!active) return err('NOT_FOUND');
	return getAvailability(db, municipalityId, facilityId, date);
}
