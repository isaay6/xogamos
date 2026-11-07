// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bookings, facilities, holidays, openingHours } from '../db/schema';
import { cancelBookingTx, facilityLockQuery } from './bookings';
import { addLocalDays, localDateTimeToUtc } from '../domain/time';
import { writeActivity } from './activity-log';

export const FIXED_HOLIDAYS = [
	['01-01', 'Aninovo'],
	['01-06', 'Reis'],
	['05-01', 'Día do Traballo'],
	['05-17', 'Día das Letras Galegas'],
	['07-25', 'Día Nacional de Galicia'],
	['08-15', 'Asunción'],
	['10-12', 'Festa Nacional'],
	['11-01', 'Todos os Santos'],
	['12-06', 'Constitución'],
	['12-08', 'Inmaculada'],
	['12-25', 'Nadal']
] as const;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function listHolidays(db: Db, municipalityId: string) {
	return db
		.select()
		.from(holidays)
		.where(eq(holidays.municipalityId, municipalityId))
		.orderBy(asc(holidays.date));
}

export async function addHoliday(
	db: Db,
	municipalityId: string,
	date: string,
	name: string,
	mode: 'closed' | 'sunday_hours',
	now: Date = new Date(),
	actorId?: string
) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(holidays)
			.values({ municipalityId, date, name, mode })
			.onConflictDoUpdate({
				target: [holidays.municipalityId, holidays.date],
				set: { name, mode }
			})
			.returning();
		await cancelHolidayBookings(tx, municipalityId, date, name, mode, now);
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'holiday_saved',
				params: { festivo: name }
			});
		return row;
	});
}

export async function addFixedHolidays(
	db: Db,
	municipalityId: string,
	year: number,
	now: Date = new Date(),
	actorId?: string
) {
	for (const [day, name] of FIXED_HOLIDAYS)
		await addHoliday(db, municipalityId, `${year}-${day}`, name, 'closed', now, actorId);
}

export async function removeHoliday(db: Db, municipalityId: string, id: string, actorId?: string) {
	return db.transaction(async (tx) => {
		const [holiday] = await tx
			.delete(holidays)
			.where(and(eq(holidays.id, id), eq(holidays.municipalityId, municipalityId)))
			.returning({ name: holidays.name });
		if (holiday && actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'holiday_deleted',
				params: { festivo: holiday.name }
			});
		return holiday;
	});
}

/**
 * Cancela as reservas futuras que o festivo deixa sen sitio: todas se pecha, e as que non caben
 * no horario de domingo se usa ese horario. As pasadas non se tocan: son historial.
 */
async function cancelHolidayBookings(
	db: Tx,
	municipalityId: string,
	date: string,
	name: string,
	mode: 'closed' | 'sunday_hours',
	now: Date
) {
	const dayStart = localDateTimeToUtc(date, '00:00');
	const from = dayStart > now ? dayStart : now;
	const to = localDateTimeToUtc(addLocalDays(date, 1), '00:00');
	const candidates = await db
		.select({
			id: bookings.id,
			profileId: bookings.profileId,
			facilityId: bookings.facilityId,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt
		})
		.from(bookings)
		.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.status, 'confirmed'),
				eq(facilities.municipalityId, municipalityId),
				gte(bookings.startsAt, from),
				lt(bookings.startsAt, to)
			)
		);
	let rows = candidates;
	if (mode === 'sunday_hours' && rows.length > 0) {
		const sunday = await db
			.select({
				facilityId: openingHours.facilityId,
				opens: openingHours.opens,
				closes: openingHours.closes
			})
			.from(openingHours)
			.where(
				and(
					eq(openingHours.weekday, 6),
					inArray(
						openingHours.facilityId,
						rows.map((r) => r.facilityId)
					)
				)
			);
		const fits = (r: (typeof rows)[number]) =>
			sunday.some(
				(h) =>
					h.facilityId === r.facilityId &&
					localDateTimeToUtc(date, h.opens) <= r.startsAt &&
					r.endsAt <= localDateTimeToUtc(date, h.closes)
			);
		rows = rows.filter((r) => !fits(r));
	}
	// Mesmo bloqueo que a creación de reservas, en orde estable para non bloquearse entre si.
	for (const facilityId of [...new Set(rows.map((r) => r.facilityId))].sort()) {
		await facilityLockQuery(db, municipalityId, facilityId);
	}
	for (const row of rows) {
		const cancelled = await cancelBookingTx(db, {
			municipalityId,
			bookingId: row.id,
			byStaff: true,
			reason: `Festivo: ${name}`,
			holiday: true,
			now
		});
		if (!cancelled.ok) throw new Error(`HOLIDAY_CANCEL_FAILED: ${cancelled.error}`);
	}
}
