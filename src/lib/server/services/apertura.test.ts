// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import { facilities, notifications, staffRoles, users } from '../db/schema';
import { localDateTimeToUtc } from '../domain/time';
import { cancelBooking, createBooking } from './bookings';
import { seedFixture } from './fixtures';

const NOW = new Date('2026-11-24T10:00:00+01:00');
const at = (date: string) => localDateTimeToUtc(date, '18:00');

async function setup() {
	const db = await createTestDb();
	const fixture = await seedFixture(db);
	const [opener, other] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'opener', displayName: 'Iria Apertura' },
			{ provider: 'local', subject: 'other', displayName: 'Telmo Persoal' }
		])
		.returning();
	await db.insert(staffRoles).values([
		{ userId: opener.id, municipalityId: fixture.municipalityId, role: 'apertura' },
		{ userId: other.id, municipalityId: fixture.municipalityId, role: 'conserxe' }
	]);
	return { db, fixture, opener, other };
}

const openingNotices = (db: Awaited<ReturnType<typeof createTestDb>>, userId: string) =>
	db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.kind, 'opening')));

describe('avisos de apertura', () => {
	it('avisa ao abrir e cancelar unha reserva de hoxe ou mañá, sen duplicados', async () => {
		const { db, fixture, opener } = await setup();
		await db
			.update(facilities)
			.set({ needsOpening: true })
			.where(eq(facilities.id, fixture.facilityId));
		const created = await createBooking(db, {
			municipalityId: fixture.municipalityId,
			facilityId: fixture.facilityId,
			profileId: fixture.profileId,
			startsAt: at('2026-11-24'),
			channel: 'online',
			createdByUserId: fixture.userId,
			now: NOW
		});
		if (!created.ok) throw new Error(created.error);
		expect(await openingNotices(db, opener.id)).toHaveLength(1);
		const repeated = await createBooking(db, {
			municipalityId: fixture.municipalityId,
			facilityId: fixture.facilityId,
			profileId: fixture.profileId,
			startsAt: at('2026-11-24'),
			channel: 'online',
			createdByUserId: fixture.userId,
			now: NOW
		});
		expect(repeated.ok).toBe(false);
		expect(await openingNotices(db, opener.id)).toHaveLength(1);
		const cancelled = await cancelBooking(db, {
			municipalityId: fixture.municipalityId,
			bookingId: created.value.id,
			byStaff: false,
			now: NOW
		});
		expect(cancelled.ok).toBe(true);
		expect(await openingNotices(db, opener.id)).toHaveLength(2);
	});

	it('non avisa pasado mañá, sen apertura, nin a persoal doutro rol', async () => {
		const { db, fixture, opener, other } = await setup();
		await db
			.update(facilities)
			.set({ needsOpening: true })
			.where(eq(facilities.id, fixture.facilityId));
		const late = await createBooking(db, {
			municipalityId: fixture.municipalityId,
			facilityId: fixture.facilityId,
			profileId: fixture.profileId,
			startsAt: at('2026-11-26'),
			channel: 'online',
			createdByUserId: fixture.userId,
			now: NOW
		});
		expect(late.ok).toBe(true);
		await db
			.update(facilities)
			.set({ needsOpening: false })
			.where(eq(facilities.id, fixture.facilityId));
		const closed = await createBooking(db, {
			municipalityId: fixture.municipalityId,
			facilityId: fixture.facilityId,
			profileId: fixture.profileId,
			startsAt: at('2026-11-25'),
			channel: 'online',
			createdByUserId: fixture.userId,
			now: NOW
		});
		expect(closed.ok).toBe(true);
		expect(await openingNotices(db, opener.id)).toHaveLength(0);
		expect(await openingNotices(db, other.id)).toHaveLength(0);
	});
});
