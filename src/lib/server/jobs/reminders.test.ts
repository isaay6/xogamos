// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, notifications, tournamentEntries, tournaments } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { createBooking } from '../services/bookings';
import { seedFixture, type Fixture } from '../services/fixtures';
import { runReminders } from './reminders';

// Jueves 5 nov 2026, 20:00 locales (CET, UTC+1).
const NOW = localDateTimeToUtc('2026-11-05', '20:00');
const booked = new Date('2026-11-01T10:00:00Z');

let db: Db;
let f: Fixture;
const ids: Record<string, string> = {};

beforeAll(async () => {
	db = await createTestDb();
	f = await seedFixture(db);
	// 00:30 local no cae en las franjas del fixture (09:00–22:00): se inserta directo.
	const mk = async (key: string, date: string, hhmm: string) => {
		const r = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: localDateTimeToUtc(date, hhmm),
			channel: 'online',
			createdByUserId: f.userId,
			now: booked
		});
		if (!r.ok) throw new Error(`${key}: ${r.error}`);
		ids[key] = r.value.id;
	};
	await mk('today', '2026-11-05', '21:00');
	await mk('tomorrowMorning', '2026-11-06', '09:00');
	await mk('tomorrowNight', '2026-11-06', '21:00');
	await mk('dayAfter', '2026-11-07', '10:00');
	const start = localDateTimeToUtc('2026-11-06', '00:30');
	const [late] = await db
		.insert(bookings)
		.values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: start,
			endsAt: new Date(start.getTime() + 3_600_000),
			accessCode: '4321',
			createdAt: booked,
			priceCents: 300,
			channel: 'online',
			createdByUserId: f.userId
		})
		.returning();
	ids.midnight = late.id;
	// Cancelada mañá: no recibe recordatorio.
	await mk('cancelledTomorrow', '2026-11-06', '15:00');
	await db
		.update(bookings)
		.set({ status: 'cancelled' })
		.where(eq(bookings.id, ids.cancelledTomorrow));
});

const reminders = () =>
	db
		.select({ bookingId: notifications.bookingId, params: notifications.params })
		.from(notifications)
		.where(eq(notifications.kind, 'reminder'));

describe('runReminders', () => {
	it('crea lembranzas para as reservas de mañá local (incluída a das 00:30), e só esas', async () => {
		expect(await runReminders(db, NOW)).toBe(3);
		const rows = await reminders();
		expect(rows.map((r) => r.bookingId).sort()).toEqual(
			[ids.tomorrowMorning, ids.tomorrowNight, ids.midnight].sort()
		);
		const night = rows.find((r) => r.bookingId === ids.midnight)!;
		expect(night.params).toMatchObject({ date: '2026-11-06', time: '00:30' });
	});

	it('é idempotente: repetir ou reiniciar non crea unha segunda', async () => {
		expect(await runReminders(db, NOW)).toBe(0);
		expect(await runReminders(db, new Date(NOW.getTime() + 600_000))).toBe(0);
		expect(await reminders()).toHaveLength(3);
	});

	it('cambio de hora: o día de mañá con 25 h; 25 out 23:30 si, 26 out 00:15 non', async () => {
		const mkDirect = async (
			date: string,
			hhmm: string,
			createdAt = new Date('2026-10-01T10:00:00Z')
		) => {
			const start = localDateTimeToUtc(date, hhmm);
			const [row] = await db
				.insert(bookings)
				.values({
					municipalityId: f.municipalityId,
					facilityId: f.facilityId,
					profileId: f.profileId,
					startsAt: start,
					endsAt: new Date(start.getTime() + 15 * 60_000),
					accessCode: '5555',
					priceCents: 300,
					channel: 'online',
					createdByUserId: f.userId,
					createdAt
				})
				.returning();
			return row.id;
		};
		const inDay = await mkDirect('2026-10-25', '23:30');
		const outDay = await mkDirect('2026-10-26', '00:15');
		expect(await runReminders(db, localDateTimeToUtc('2026-10-24', '20:00'))).toBe(1);
		const rows = await reminders();
		expect(rows.some((r) => r.bookingId === inDay)).toBe(true);
		expect(rows.some((r) => r.bookingId === outDay)).toBe(false);
	});

	it('non avisa unha reserva feita hai menos de 60 min; si cando pasa a hora', async () => {
		const start = localDateTimeToUtc('2026-11-20', '10:00');
		const created = new Date(localDateTimeToUtc('2026-11-19', '20:00').getTime() - 30 * 60_000);
		const [row] = await db
			.insert(bookings)
			.values({
				municipalityId: f.municipalityId,
				facilityId: f.facilityId,
				profileId: f.profileId,
				startsAt: start,
				endsAt: new Date(start.getTime() + 3_600_000),
				accessCode: '6666',
				priceCents: 300,
				channel: 'online',
				createdByUserId: f.userId,
				createdAt: created
			})
			.returning();
		const now = localDateTimeToUtc('2026-11-19', '20:00');
		expect(await runReminders(db, now)).toBe(0);
		expect(await runReminders(db, new Date(now.getTime() + 31 * 60_000))).toBe(1);
		const rows = await reminders();
		expect(rows.some((r) => r.bookingId === row.id)).toBe(true);
	});

	it('dúas execucións só crean un recordatorio de torneo', async () => {
		const tomorrow = '2026-11-06';
		const [tournament] = await db
			.insert(tournaments)
			.values({
				municipalityId: f.municipalityId,
				facilityId: f.facilityId,
				title: 'Copa de proba',
				sportDescription: 'Pádel',
				startsOn: tomorrow,
				endsOn: tomorrow,
				format: 'individual',
				maxEntries: 4,
				signupDeadline: new Date('2026-11-05T12:00:00Z'),
				createdBy: f.userId
			})
			.returning();
		await db.insert(tournamentEntries).values({ tournamentId: tournament.id, userId: f.userId });
		const results = await Promise.all([runReminders(db, NOW), runReminders(db, NOW)]);
		expect(results.reduce((total, value) => total + value, 0)).toBe(1);
		expect(
			await db.select().from(notifications).where(eq(notifications.tournamentId, tournament.id))
		).toHaveLength(1);
	});
});
