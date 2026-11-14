// SPDX-License-Identifier: EUPL-1.2
// Datos de una instalación para «Confirmar» y «Xa é túa!»: instalación, tipo y normas del concello.
import { and, eq } from 'drizzle-orm';
import type { Mascot } from '../../mascots';
import type { Db } from '../db/client';
import { facilities, facilityTypes, municipalities, type BookingRow } from '../db/schema';
import type { SlotAvailability } from '../domain/availability';
import { addLocalDays } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { getAvailability, localDateOf } from './bookings';

export type FacilityContext = {
	facilityId: string;
	facilityName: string;
	location: string;
	address: string;
	latitude: number | null;
	longitude: number | null;
	/** Normas propias de la instalación (texto llano, puede estar vacío). */
	rules: string;
	/** Indicación de acceso en galego e, opcionalmente, castelán. */
	accessInfo: string;
	accessInfoEs: string | null;
	active: boolean;
	priceResidentCents: number;
	priceNonResidentCents: number;
	priceSocialCents: number | null;
	typeId: string;
	nameGl: string;
	nameEs: string;
	mascot: Mascot;
	color: string;
	bookingMode: BookingMode;
	cancellationDeadlineMinutes: number;
	stepFreeAccess: 'yes' | 'no' | 'partial' | null;
	adaptedToilet: boolean | null;
	adaptedChangingRoom: boolean | null;
	accessibleParkingNearby: boolean | null;
	hearingLoop: boolean | null;
	supportContact: string | null;
	accessibilityNotes: string | null;
	accessibilityCheckedAt: string | null;
};

/** Instalación del concello con su tipo y el plazo de cancelación; `null` si no es del concello. */
export async function getFacilityContext(
	db: Db,
	municipalityId: string,
	facilityId: string
): Promise<FacilityContext | null> {
	const [row] = await db
		.select({
			facilityId: facilities.id,
			facilityName: facilities.name,
			location: facilities.location,
			address: facilities.address,
			latitude: facilities.latitude,
			longitude: facilities.longitude,
			rules: facilities.rules,
			accessInfo: facilities.accessInfo,
			accessInfoEs: facilities.accessInfoEs,
			active: facilities.active,
			priceResidentCents: facilities.priceResidentCents,
			priceNonResidentCents: facilities.priceNonResidentCents,
			priceSocialCents: facilities.priceSocialCents,
			typeId: facilityTypes.id,
			nameGl: facilityTypes.nameGl,
			nameEs: facilityTypes.nameEs,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			bookingMode: facilityTypes.bookingMode,
			cancellationDeadlineMinutes: municipalities.cancellationDeadlineMinutes,
			stepFreeAccess: facilities.stepFreeAccess,
			adaptedToilet: facilities.adaptedToilet,
			adaptedChangingRoom: facilities.adaptedChangingRoom,
			accessibleParkingNearby: facilities.accessibleParkingNearby,
			hearingLoop: facilities.hearingLoop,
			supportContact: facilities.supportContact,
			accessibilityNotes: facilities.accessibilityNotes,
			accessibilityCheckedAt: facilities.accessibilityCheckedAt
		})
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
		.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)));
	return row ?? null;
}

/** Días de antelación con que se puede reservar en el concello (misma ventana que `dayStrip`). */
export async function getMaxDaysAhead(db: Db, municipalityId: string): Promise<number> {
	const [row] = await db
		.select({ maxDaysAhead: municipalities.maxDaysAhead })
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	return row?.maxDaysAhead ?? 0;
}

export type RescheduleSlot = { startsAt: Date; free: boolean; remainingSeats: number };

/**
 * Franjas de un día de la misma instalación a las que se puede mover `booking`: libres, sin
 * empezar, dentro de la ventana y con sitio para su unidad o sus plazas. La franja propia cuenta
 * como ocupada (moverla a sí misma no tiene sentido).
 */
export async function rescheduleSlots(
	db: Db,
	municipalityId: string,
	booking: Pick<BookingRow, 'facilityId' | 'unitIndex' | 'seats'>,
	date: string,
	now: Date,
	maxDaysAhead: number
): Promise<RescheduleSlot[]> {
	const day = await getAvailability(db, municipalityId, booking.facilityId, date);
	if (!day.ok) return [];
	const lastDate = addLocalDays(localDateOf(now), maxDaysAhead);
	const fits = (s: SlotAvailability) =>
		s.free &&
		(booking.unitIndex === null || s.freeUnits.includes(booking.unitIndex)) &&
		s.remainingSeats >= booking.seats;
	return day.value.map((s) => ({
		startsAt: s.startsAt,
		free: fits(s) && s.startsAt.getTime() > now.getTime() && localDateOf(s.startsAt) <= lastDate,
		remainingSeats: s.remainingSeats
	}));
}
