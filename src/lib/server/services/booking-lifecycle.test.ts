// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, facilities, municipalityProfiles, openingHours } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import type { BookingMode } from '../domain/types';
import {
	cancelBooking,
	createBooking,
	facilityLockQuery,
	getAvailability,
	markNoShow,
	rescheduleBooking
} from './bookings';
import { seedFixture, type Fixture } from './fixtures';

const now = new Date('2026-10-21T10:00:00Z');
const DATE = '2026-10-22';
const at = (hhmm: string) => localDateTimeToUtc(DATE, hhmm);
const minutesBefore = (d: Date, min: number) => new Date(d.getTime() - min * 60_000);
const DAY_MS = 24 * 60 * 60_000;

async function setup(opts: { bookingMode?: BookingMode; units?: number } = {}) {
	const db = await createTestDb();
	const f = await seedFixture(db, opts);
	return { db, f };
}

function errorOf<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): E | null {
	return r.ok ? null : r.error;
}

async function book(db: Db, f: Fixture, extra: Partial<Parameters<typeof createBooking>[1]> = {}) {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at('18:00'),
		channel: 'phone',
		createdByUserId: f.userId,
		now,
		...extra
	});
	if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
	return r.value;
}

async function byId(db: Db, id: string) {
	const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
	return row;
}

async function slotFree(db: Db, f: Fixture, startsAt: Date) {
	const r = await getAvailability(db, f.municipalityId, f.facilityId, DATE);
	if (!r.ok) throw new Error(r.error);
	return r.value.find((s) => s.startsAt.getTime() === startsAt.getTime())?.free;
}

describe('facility lock', () => {
	it('emits SELECT … FOR UPDATE', async () => {
		const { db, f } = await setup();
		const { sql } = facilityLockQuery(db, f.municipalityId, f.facilityId).toSQL();
		expect(sql.toLowerCase()).toContain('for update');
		expect(sql).toContain('"municipality_id"');
	});
});

describe('cancelBooking', () => {
	it('cancel in time', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		expect(await slotFree(db, f, at('18:00'))).toBe(false);
		const r = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: false,
			now
		});
		expect(r.ok && r.value.status).toBe('cancelled');
		expect(r.ok && r.value.cancelledAt?.getTime()).toBe(now.getTime());
		expect(await slotFree(db, f, at('18:00'))).toBe(true);
	});

	it('cancel too late', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const late = minutesBefore(at('18:00'), 30);
		const base = {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			now: late
		};
		expect(errorOf(await cancelBooking(db, { ...base, byStaff: false }))).toBe(
			'TOO_LATE_TO_CANCEL'
		);
		expect((await byId(db, b.id)).status).toBe('confirmed');
		const r = await cancelBooking(db, { ...base, byStaff: true, reason: 'Pista mollada' });
		expect(r.ok && r.value.status).toBe('cancelled');
	});

	it('already final', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const input = {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: false,
			now
		};
		expect((await cancelBooking(db, input)).ok).toBe(true);
		expect(errorOf(await cancelBooking(db, input))).toBe('ALREADY_FINAL');
	});

	it('is scoped by municipality', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const r = await cancelBooking(db, {
			municipalityId: f.otherMunicipalityId,
			bookingId: b.id,
			byStaff: true,
			reason: 'Proba',
			now
		});
		expect(errorOf(r)).toBe('NOT_FOUND');
		expect((await byId(db, b.id)).status).toBe('confirmed');
	});
});

describe('rescheduleBooking', () => {
	it('reschedule into occupied keeps original', async () => {
		const { db, f } = await setup();
		const original = await book(db, f);
		await book(db, f, {
			startsAt: at('19:00'),
			profileId: f.residentProfileId
		});
		const r = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: original.id,
			startsAt: at('19:00'),
			now
		});
		expect(errorOf(r)).toBe('SLOT_UNAVAILABLE');
		const after = await byId(db, original.id);
		expect(after.status).toBe('confirmed');
		expect(after.startsAt.getTime()).toBe(original.startsAt.getTime());
		expect(after.cancelledAt).toBeNull();
		expect(await db.select().from(bookings)).toHaveLength(2);
	});

	it('reschedule ok', async () => {
		const { db, f } = await setup();
		const original = await book(db, f);
		const r = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: original.id,
			startsAt: at('20:00'),
			now
		});
		if (!r.ok) throw new Error(r.error);
		const old = await byId(db, original.id);
		expect(old.status).toBe('cancelled');
		expect(old.cancelledAt?.getTime()).toBe(now.getTime());
		expect(r.value.id).not.toBe(original.id);
		expect(r.value.status).toBe('confirmed');
		expect(r.value.startsAt.getTime()).toBe(at('20:00').getTime());
		expect(r.value.channel).toBe('phone');
		expect(r.value.profileId).toBe(original.profileId);
		expect(r.value.createdByUserId).toBe(original.createdByUserId);
		expect(r.value.accessCode).toMatch(/^\d{4}$/);
		expect(await slotFree(db, f, at('18:00'))).toBe(true);
		expect(await slotFree(db, f, at('20:00'))).toBe(false);
	});

	it('ignores the original booking when checking availability', async () => {
		const { db, f } = await setup({ bookingMode: 'day' });
		const original = await book(db, f, { startsAt: at('09:00') });
		// El día completo solo está libre si no cuenta la propia reserva.
		const moved = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: original.id,
			startsAt: at('09:00'),
			now
		});
		expect(moved.ok).toBe(true);
		const { db: db2, f: f2 } = await setup({ bookingMode: 'unit', units: 2 });
		const b = await book(db2, f2, { unitIndex: 1 });
		// Misma franja y misma pista: solo es posible si se excluye la original.
		const same = await rescheduleBooking(db2, {
			municipalityId: f2.municipalityId,
			bookingId: b.id,
			startsAt: at('18:00'),
			now
		});
		expect(same.ok && same.value.unitIndex).toBe(1);
	});

	it('too late and already final', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const base = {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			startsAt: at('20:00')
		};
		expect(
			errorOf(
				await rescheduleBooking(db, {
					...base,
					now: minutesBefore(at('18:00'), 30)
				})
			)
		).toBe('TOO_LATE_TO_CANCEL');
		await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: false,
			now
		});
		expect(errorOf(await rescheduleBooking(db, { ...base, now }))).toBe('ALREADY_FINAL');
	});

	it('is scoped by municipality', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const r = await rescheduleBooking(db, {
			municipalityId: f.otherMunicipalityId,
			bookingId: b.id,
			startsAt: at('20:00'),
			now
		});
		expect(errorOf(r)).toBe('NOT_FOUND');
	});
});

describe('markNoShow', () => {
	it('no-show third time penalizes', async () => {
		const { db, f } = await setup();
		const later = at('21:30');
		const booked = [
			await book(db, f, { startsAt: at('10:00') }),
			await book(db, f, { startsAt: at('11:00') }),
			await book(db, f, { startsAt: at('12:00') })
		];
		for (const b of booked) {
			const r = await markNoShow(db, {
				municipalityId: f.municipalityId,
				bookingId: b.id,
				now: later
			});
			expect(r.ok && r.value.status).toBe('no_show');
		}
		const [profile] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.profileId));
		expect(profile.penaltyUntil?.getTime()).toBe(later.getTime() + 7 * DAY_MS);
		expect(profile.noShowCount).toBe(0);
		const next = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: localDateTimeToUtc('2026-10-23', '18:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now: later
		});
		expect(errorOf(next)).toBe('PENALIZED');
	});

	it('no-show grace: 47 h ok, 49 h too late', async () => {
		const { db, f } = await setup();
		const a = await book(db, f);
		const b = await book(db, f, { startsAt: at('19:00') });
		const end = (d: Date) => new Date(d.getTime() + 60 * 60_000);
		const hoursAfter = (d: Date, h: number) => new Date(end(d).getTime() + h * 3600_000);
		const late = await markNoShow(db, {
			municipalityId: f.municipalityId,
			bookingId: a.id,
			now: hoursAfter(a.startsAt, 49)
		});
		expect(errorOf(late)).toBe('TOO_LATE_FOR_NO_SHOW');
		expect((await byId(db, a.id)).status).toBe('confirmed');
		const ok = await markNoShow(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			now: hoursAfter(b.startsAt, 47)
		});
		expect(ok.ok).toBe(true);
	});

	it('no-show before start', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const r = await markNoShow(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			now: minutesBefore(at('18:00'), 1)
		});
		expect(errorOf(r)).toBe('NOT_STARTED');
	});

	it('only confirmed bookings and scoped by municipality', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const later = at('19:30');
		expect(
			errorOf(
				await markNoShow(db, {
					municipalityId: f.otherMunicipalityId,
					bookingId: b.id,
					now: later
				})
			)
		).toBe('NOT_FOUND');
		await markNoShow(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			now: later
		});
		expect(
			errorOf(
				await markNoShow(db, {
					municipalityId: f.municipalityId,
					bookingId: b.id,
					now: later
				})
			)
		).toBe('ALREADY_FINAL');
		const [profile] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.profileId));
		expect(profile.noShowCount).toBe(1);
	});
});

describe('access code uniqueness across midnight', () => {
	it('rejects a code whose access window overlaps a booking on the previous day', async () => {
		const { db, f } = await setup();
		await db.update(facilities).set({ slotMinutes: 59 }).where(eq(facilities.id, f.facilityId));
		await db.delete(openingHours).where(eq(openingHours.facilityId, f.facilityId));
		await db.insert(openingHours).values([
			{ facilityId: f.facilityId, weekday: 3, opens: '23:00', closes: '23:59' },
			{ facilityId: f.facilityId, weekday: 4, opens: '00:00', closes: '01:00' }
		]);
		const mk = (startsAt: Date) => ({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt,
			channel: 'online' as const,
			createdByUserId: f.userId,
			now
		});
		const first = await createBooking(db, mk(at('23:00')), {
			generateCode: () => '7777'
		});
		const calls: string[] = ['7777', '8888'];
		const second = await createBooking(db, mk(localDateTimeToUtc('2026-10-23', '00:00')), {
			generateCode: () => calls.shift()!
		});
		expect(first.ok && first.value.accessCode).toBe('7777');
		expect(second.ok && second.value.accessCode).toBe('8888');
	});
});
