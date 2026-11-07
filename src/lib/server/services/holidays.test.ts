// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookings, notifications, openingHours } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { seedFixture } from './fixtures';
import { addHoliday, addFixedHolidays, listHolidays, removeHoliday } from './holidays';

describe('festivos', () => {
	it('carga os once festivos fixos e pódense quitar', async () => {
		const db = await createTestDb();
		const fixture = await seedFixture(db);
		await addFixedHolidays(db, fixture.municipalityId, 2026);
		const rows = await listHolidays(db, fixture.municipalityId);
		expect(rows).toHaveLength(11);
		expect(rows[0]).toMatchObject({ date: '2026-01-01', name: 'Aninovo', mode: 'closed' });
		await removeHoliday(db, fixture.municipalityId, rows[0].id);
		expect(await listHolidays(db, fixture.municipalityId)).toHaveLength(10);
	});

	it('un novo festivo pechado cancela as reservas e deixa un aviso de peche', async () => {
		const db = await createTestDb();
		const fixture = await seedFixture(db);
		const startsAt = localDateTimeToUtc('2026-11-25', '10:00');
		const [booking] = await db
			.insert(bookings)
			.values({
				municipalityId: fixture.municipalityId,
				facilityId: fixture.facilityId,
				profileId: fixture.profileId,
				startsAt,
				endsAt: new Date(startsAt.getTime() + 3_600_000),
				accessCode: '1234',
				priceCents: 0,
				channel: 'online',
				createdByUserId: fixture.userId
			})
			.returning();
		await addHoliday(db, fixture.municipalityId, '2026-11-25', 'Santa Catarina', 'closed');
		const [cancelled] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
		expect(cancelled.status).toBe('cancelled');
		expect(cancelled.cancelledAt).not.toBeNull();
		const notices = await db
			.select()
			.from(notifications)
			.where(eq(notifications.bookingId, booking.id));
		expect(notices).toHaveLength(1);
		// Cancela polo camiño común do persoal: así tamén devolve o pagado co monedero.
		expect(notices[0]).toMatchObject({
			kind: 'cancelled_by_staff',
			params: { reason: 'Festivo: Santa Catarina' }
		});
	});
	async function bookAt(
		db: Awaited<ReturnType<typeof createTestDb>>,
		fixture: Awaited<ReturnType<typeof seedFixture>>,
		date: string,
		time: string,
		code: string
	) {
		const startsAt = localDateTimeToUtc(date, time);
		const [row] = await db
			.insert(bookings)
			.values({
				municipalityId: fixture.municipalityId,
				facilityId: fixture.facilityId,
				profileId: fixture.profileId,
				startsAt,
				endsAt: new Date(startsAt.getTime() + 3_600_000),
				accessCode: code,
				priceCents: 0,
				channel: 'online',
				createdByUserId: fixture.userId
			})
			.returning();
		return row;
	}

	const statusOf = async (db: Awaited<ReturnType<typeof createTestDb>>, id: string) =>
		(await db.select().from(bookings).where(eq(bookings.id, id)))[0].status;

	it('un festivo pasado non toca o historial', async () => {
		const db = await createTestDb();
		const fixture = await seedFixture(db);
		const old = await bookAt(db, fixture, '2026-10-12', '10:00', '4321');
		const now = localDateTimeToUtc('2026-10-29', '12:00');
		await addHoliday(db, fixture.municipalityId, '2026-10-12', 'Festa Nacional', 'closed', now);
		expect(await statusOf(db, old.id)).toBe('confirmed');
	});

	it('co horario de domingo só se cancelan as reservas que non caben nel', async () => {
		const db = await createTestDb();
		const fixture = await seedFixture(db);
		await db.delete(openingHours).where(eq(openingHours.facilityId, fixture.facilityId));
		await db
			.insert(openingHours)
			.values({ facilityId: fixture.facilityId, weekday: 6, opens: '10:00', closes: '14:00' });
		const inside = await bookAt(db, fixture, '2026-11-25', '11:00', '1111');
		const outside = await bookAt(db, fixture, '2026-11-25', '18:00', '2222');
		const now = localDateTimeToUtc('2026-10-29', '12:00');
		await addHoliday(
			db,
			fixture.municipalityId,
			'2026-11-25',
			'Santa Catarina',
			'sunday_hours',
			now
		);
		expect(await statusOf(db, inside.id)).toBe('confirmed');
		expect(await statusOf(db, outside.id)).toBe('cancelled');
	});
});
