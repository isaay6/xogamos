// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { waitlistEntries } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { cancelBooking, createBooking } from './bookings';
import { seedFixture } from './fixtures';
import { expireOffers, joinWaitlist, listMyWaitlist } from './waitlist';

const now = new Date('2026-10-21T10:00:00Z');
const at = (time: string) => localDateTimeToUtc('2026-10-22', time);

async function fullSlot() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const booking = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.residentProfileId,
		startsAt: at('18:00'),
		channel: 'online',
		createdByUserId: f.userId,
		now
	});
	if (!booking.ok) throw new Error(booking.error);
	return { db, f, booking: booking.value };
}

describe('waitlist', () => {
	it('só deixa unirse a unha franxa completa e non duplica a espera', async () => {
		const { db, f } = await fullSlot();
		const input = {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('18:00'),
			now
		};
		expect((await joinWaitlist(db, input)).ok).toBe(true);
		const repeated = await joinWaitlist(db, input);
		expect(repeated.ok ? null : repeated.error).toBe('ALREADY_WAITING');
	});

	it('ofrece FIFO ao cancelar e reserva a praza para a persoa ofertada', async () => {
		const { db, f, booking } = await fullSlot();
		const joined = await joinWaitlist(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('18:00'),
			now
		});
		expect(joined.ok).toBe(true);
		const cancelled = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: booking.id,
			byStaff: true,
			reason: 'Mantemento',
			now
		});
		expect(cancelled.ok).toBe(true);
		const [offer] = await db
			.select()
			.from(waitlistEntries)
			.where(eq(waitlistEntries.profileId, f.profileId));
		expect(offer.status).toBe('offered');
		const other = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.residentProfileId,
			startsAt: at('18:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now
		});
		expect(other.ok ? null : other.error).toBe('SLOT_UNAVAILABLE');
		const mine = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('18:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now
		});
		expect(mine.ok).toBe(true);
	});

	it('caduca ofertas de forma perezosa ao consultar', async () => {
		const { db, f } = await fullSlot();
		await db.insert(waitlistEntries).values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('18:00'),
			createdAt: now,
			status: 'offered',
			offeredUntil: new Date(now.getTime() - 1)
		});
		await db.transaction((tx) => expireOffers(tx, now, f.facilityId, at('18:00')));
		const rows = await listMyWaitlist(db, f.profileId, now);
		expect(rows[0].entry.status).toBe('expired');
	});
});
