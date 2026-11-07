// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	entities,
	entityMembers,
	facilities,
	openingHours,
	municipalityProfiles
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { createBooking, getAvailability, lookupAccessCode, rescheduleBooking } from './bookings';
import { signBookingQr } from '../domain/booking-qr';
import { FIXTURE_PRICES, seedFixture, type Fixture } from './fixtures';

const now = new Date('2026-10-21T10:00:00Z');
const DATE = '2026-10-22';
const at = (hhmm: string) => localDateTimeToUtc(DATE, hhmm);

async function setup(opts: { bookingMode?: BookingMode; units?: number; capacity?: number } = {}) {
	const db = await createTestDb();
	const f = await seedFixture(db, opts);
	return { db, f };
}

const input = (f: Fixture, extra: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
	municipalityId: f.municipalityId,
	facilityId: f.facilityId,
	profileId: f.profileId,
	startsAt: at('18:00'),
	channel: 'online' as const,
	createdByUserId: f.userId,
	now,
	...extra
});

function errorOf<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): E | null {
	return r.ok ? null : r.error;
}

async function book(db: Db, f: Fixture, extra: Partial<Parameters<typeof createBooking>[1]> = {}) {
	const r = await createBooking(db, input(f, extra));
	if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
	return r.value;
}

describe('createBooking', () => {
	it('creates booking', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		expect(b.status).toBe('confirmed');
		expect(b.accessCode).toMatch(/^\d{4}$/);
		expect(b.priceCents).toBe(FIXTURE_PRICES.priceNonResidentCents);
		expect(b.startsAt.toISOString()).toBe('2026-10-22T16:00:00.000Z');
		expect(b.endsAt.toISOString()).toBe(at('19:00').toISOString());
		expect(b.municipalityId).toBe(f.municipalityId);
		expect(b.seats).toBe(1);
		expect(b.channel).toBe('online');
		expect(b.createdByUserId).toBe(f.userId);
		expect(b.createdAt.toISOString()).toBe(now.toISOString());
	});

	it('charges the resident price to a resident profile', async () => {
		const { db, f } = await setup();
		const b = await book(db, f, { profileId: f.residentProfileId });
		expect(b.priceCents).toBe(FIXTURE_PRICES.priceResidentCents);
	});

	it('rejects double booking', async () => {
		const { db, f } = await setup();
		await book(db, f);
		const r = await createBooking(db, input(f, { profileId: f.residentProfileId }));
		expect(errorOf(r)).toBe('SLOT_UNAVAILABLE');
	});

	it('cancelled bookings do not block the slot', async () => {
		const { db, f } = await setup();
		const first = await book(db, f);
		await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, first.id));
		expect((await createBooking(db, input(f))).ok).toBe(true);
	});

	it('concurrent bookings', async () => {
		const { db, f } = await setup();
		const results = await Promise.all([
			createBooking(db, input(f)),
			createBooking(db, input(f, { profileId: f.residentProfileId }))
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(results.map(errorOf).filter((e) => e !== null)).toEqual(['SLOT_UNAVAILABLE']);
		const rows = await db.select().from(bookings).where(eq(bookings.facilityId, f.facilityId));
		expect(rows).toHaveLength(1);
	});

	it('not aligned', async () => {
		const { db, f } = await setup();
		const r = await createBooking(db, input(f, { startsAt: at('18:30') }));
		expect(errorOf(r)).toBe('NOT_ALIGNED');
	});

	it('outside opening hours is not aligned', async () => {
		const { db, f } = await setup();
		const r = await createBooking(db, input(f, { startsAt: at('22:00') }));
		expect(errorOf(r)).toBe('NOT_ALIGNED');
	});

	it('closure overlap', async () => {
		const { db, f } = await setup();
		await db
			.insert(closures)
			.values({ facilityId: f.facilityId, startsAt: at('18:00'), endsAt: at('19:00') });
		const r = await createBooking(db, input(f));
		expect(errorOf(r)).toBe('NOT_ALIGNED');
	});

	it('closure partially overlapping two slots blocks both', async () => {
		const { db, f } = await setup();
		await db
			.insert(closures)
			.values({ facilityId: f.facilityId, startsAt: at('18:30'), endsAt: at('19:30') });
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('18:00') })))).toBe(
			'NOT_ALIGNED'
		);
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('19:00') })))).toBe(
			'NOT_ALIGNED'
		);
	});

	// Reserva de 90 min insertada directamente (como si slotMinutes hubiera cambiado).
	const insertLongBooking = (db: Db, f: Fixture, unitIndex: number | null = null) =>
		db.insert(bookings).values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.residentProfileId,
			unitIndex,
			startsAt: at('18:00'),
			endsAt: at('19:30'),
			accessCode: '9999',
			priceCents: 0,
			channel: 'desk',
			createdByUserId: f.userId
		});

	it('booking partially overlapping an existing longer booking is rejected', async () => {
		const { db, f } = await setup();
		await insertLongBooking(db, f);
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('19:00') })))).toBe(
			'SLOT_UNAVAILABLE'
		);
	});

	it('unit partially overlapping an existing longer booking is unavailable', async () => {
		const { db, f } = await setup({ bookingMode: 'unit', units: 4 });
		await insertLongBooking(db, f, 1);
		expect(
			errorOf(await createBooking(db, input(f, { startsAt: at('19:00'), unitIndex: 1 })))
		).toBe('UNIT_UNAVAILABLE');
		const other = await book(db, f, { startsAt: at('19:00'), unitIndex: 2 });
		expect(other.unitIndex).toBe(2);
	});

	it('unit mode', async () => {
		const { db, f } = await setup({ bookingMode: 'unit', units: 4 });
		expect(errorOf(await createBooking(db, input(f)))).toBe('UNIT_REQUIRED');
		const first = await book(db, f, { unitIndex: 1 });
		expect(first.unitIndex).toBe(1);
		expect(first.seats).toBe(1);
		expect(errorOf(await createBooking(db, input(f, { unitIndex: 1 })))).toBe('UNIT_UNAVAILABLE');
		expect(errorOf(await createBooking(db, input(f, { unitIndex: 4 })))).toBe('UNIT_UNAVAILABLE');
		const second = await book(db, f, { unitIndex: 2 });
		expect(second.unitIndex).toBe(2);
	});

	it('capacity mode', async () => {
		const { db, f } = await setup({ bookingMode: 'capacity', capacity: 3 });
		const b = await book(db, f, { seats: 2 });
		expect(b.seats).toBe(2);
		expect(b.priceCents).toBe(FIXTURE_PRICES.priceNonResidentCents * 2);
		const r = await createBooking(db, input(f, { seats: 2, profileId: f.residentProfileId }));
		expect(errorOf(r)).toBe('CAPACITY_EXCEEDED');
		await book(db, f, { seats: 1 });
		expect(errorOf(await createBooking(db, input(f, { seats: 1 })))).toBe('CAPACITY_EXCEEDED');
	});

	it('slot mode always stores one seat', async () => {
		const { db, f } = await setup();
		const b = await book(db, f, { seats: 5 });
		expect(b.seats).toBe(1);
		expect(b.priceCents).toBe(FIXTURE_PRICES.priceNonResidentCents);
	});

	it('day mode books the whole opening span', async () => {
		const { db, f } = await setup({ bookingMode: 'day' });
		const b = await book(db, f, { startsAt: at('09:00') });
		expect(b.endsAt.toISOString()).toBe(at('22:00').toISOString());
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('18:00') })))).toBe(
			'NOT_ALIGNED'
		);
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('09:00') })))).toBe(
			'SLOT_UNAVAILABLE'
		);
	});

	it('penalized', async () => {
		const { db, f } = await setup();
		await db
			.update(municipalityProfiles)
			.set({ penaltyUntil: new Date('2026-10-25T00:00:00Z') })
			.where(eq(municipalityProfiles.id, f.profileId));
		expect(errorOf(await createBooking(db, input(f)))).toBe('PENALIZED');
	});

	it('expired penalty does not block', async () => {
		const { db, f } = await setup();
		await db
			.update(municipalityProfiles)
			.set({ penaltyUntil: new Date('2026-10-20T00:00:00Z') })
			.where(eq(municipalityProfiles.id, f.profileId));
		expect((await createBooking(db, input(f))).ok).toBe(true);
	});

	it('tenant isolation', async () => {
		const { db, f } = await setup();
		const r = await createBooking(db, input(f, { municipalityId: f.otherMunicipalityId }));
		expect(errorOf(r)).toBe('NOT_FOUND');
	});

	it('profile from another municipality is not found', async () => {
		const { db, f } = await setup();
		const [other] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: f.otherMunicipalityId, userId: f.userId })
			.returning();
		expect(errorOf(await createBooking(db, input(f, { profileId: other.id })))).toBe('NOT_FOUND');
	});

	it('inactive facility', async () => {
		const { db, f } = await setup();
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, f.facilityId));
		expect(errorOf(await createBooking(db, input(f)))).toBe('FACILITY_INACTIVE');
	});

	it('booking window', async () => {
		const { db, f } = await setup();
		const past = new Date('2026-10-21T09:00:00Z');
		expect(errorOf(await createBooking(db, input(f, { startsAt: past })))).toBe('IN_PAST');
		const far = localDateTimeToUtc('2026-11-20', '18:00');
		expect(errorOf(await createBooking(db, input(f, { startsAt: far })))).toBe('TOO_FAR_AHEAD');
	});

	it('checks window before penalty and penalty before alignment', async () => {
		const { db, f } = await setup();
		await db
			.update(municipalityProfiles)
			.set({ penaltyUntil: new Date('2026-12-01T00:00:00Z') })
			.where(eq(municipalityProfiles.id, f.profileId));
		const past = new Date('2026-10-21T09:30:00Z');
		expect(errorOf(await createBooking(db, input(f, { startsAt: past })))).toBe('IN_PAST');
		expect(errorOf(await createBooking(db, input(f, { startsAt: at('18:30') })))).toBe('PENALIZED');
	});

	it('retries colliding access codes', async () => {
		const { db, f } = await setup();
		const codes = ['1111', '1111', '1111', '2222'];
		const gen = () => codes.shift()!;
		await createBooking(db, input(f, { startsAt: at('10:00') }), { generateCode: gen });
		const r = await createBooking(db, input(f), { generateCode: gen });
		expect(r.ok && r.value.accessCode).toBe('2222');
	});

	it('throws when access codes keep colliding', async () => {
		const { db, f } = await setup();
		const gen = () => '1111';
		await createBooking(db, input(f, { startsAt: at('10:00') }), { generateCode: gen });
		await expect(createBooking(db, input(f), { generateCode: gen })).rejects.toThrow(
			/CODE_EXHAUSTED/
		);
		// Ningún efecto: la transacción se revierte.
		const rows = await db.select().from(bookings);
		expect(rows).toHaveLength(1);
	});

	it('PINs only need to be unique per concello and local day', async () => {
		const { db, f } = await setup();
		const gen = () => '1111';
		await createBooking(db, input(f), { generateCode: gen });
		const nextDay = localDateTimeToUtc('2026-10-23', '18:00');
		const r = await createBooking(db, input(f, { startsAt: nextDay }), { generateCode: gen });
		expect(r.ok && r.value.accessCode).toBe('1111');
	});
});

describe('getAvailability', () => {
	it('availability reflects booking', async () => {
		const { db, f } = await setup();
		const before = await getAvailability(db, f.municipalityId, f.facilityId, DATE);
		if (!before.ok) throw new Error(before.error);
		expect(before.value).toHaveLength(13);
		expect(before.value.every((s) => s.free)).toBe(true);

		await book(db, f);
		const after = await getAvailability(db, f.municipalityId, f.facilityId, DATE);
		if (!after.ok) throw new Error(after.error);
		const slot = after.value.find((s) => s.startsAt.getTime() === at('18:00').getTime());
		expect(slot?.free).toBe(false);
		expect(after.value.filter((s) => !s.free)).toHaveLength(1);
	});

	it('omits closed slots', async () => {
		const { db, f } = await setup();
		await db
			.insert(closures)
			.values({ facilityId: f.facilityId, startsAt: at('18:00'), endsAt: at('20:00') });
		const r = await getAvailability(db, f.municipalityId, f.facilityId, DATE);
		expect(r.ok && r.value).toHaveLength(11);
	});

	it('is scoped by municipality', async () => {
		const { db, f } = await setup();
		const r = await getAvailability(db, f.otherMunicipalityId, f.facilityId, DATE);
		expect(errorOf(r)).toBe('NOT_FOUND');
	});
});

describe('PIN uniqueness per concello and day', () => {
	/** Cuatro instalaciones más en el mismo concello: 5 × 13 franjas el mismo día. */
	async function moreFacilities(db: Db, f: Fixture) {
		const [base] = await db.select().from(facilities).where(eq(facilities.id, f.facilityId));
		const ids = [f.facilityId];
		for (let i = 2; i <= 5; i++) {
			const [row] = await db
				.insert(facilities)
				.values({ ...base, id: undefined, name: `Pista ${i}` })
				.returning();
			await db.insert(openingHours).values(
				[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
					facilityId: row.id,
					weekday,
					opens: '09:00',
					closes: '22:00'
				}))
			);
			ids.push(row.id);
		}
		return ids;
	}

	it('50 bookings the same day get 50 distinct PINs even when the generator collides', async () => {
		const { db, f } = await setup();
		const ids = await moreFacilities(db, f);
		// Cada PIN se ofrece tres veces seguidas: fuerza colisiones en los primeros intentos.
		let n = 0;
		const generateCode = () => String(Math.floor(n++ / 3)).padStart(4, '0');
		const hours = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
		const pins: string[] = [];
		outer: for (const facilityId of ids) {
			for (const h of hours) {
				const r = await createBooking(db, input(f, { facilityId, startsAt: at(h) }), {
					generateCode
				});
				if (!r.ok) throw new Error(r.error);
				pins.push(r.value.accessCode);
				if (pins.length === 50) break outer;
			}
		}
		expect(pins).toHaveLength(50);
		expect(new Set(pins).size).toBe(50);
		expect(pins.every((p) => /^\d{4}$/.test(p))).toBe(true);
	});

	it('the same PIN may repeat in another concello', async () => {
		const { db, f } = await setup();
		await book(db, f, {}); // concello 1
		const [p2] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: f.otherMunicipalityId, userId: f.userId, isResident: false })
			.returning();
		const r = await createBooking(
			db,
			{
				...input(f),
				municipalityId: f.otherMunicipalityId,
				facilityId: f.otherFacilityId,
				profileId: p2.id
			},
			{ generateCode: () => '4242' }
		);
		const r1 = await createBooking(db, input(f, { startsAt: at('10:00') }), {
			generateCode: () => '4242'
		});
		expect(r.ok && r1.ok && r.value.accessCode === r1.value.accessCode).toBe(true);
	});

	it('a rescheduled booking gets a PIN unused by that day active bookings', async () => {
		const { db, f } = await setup();
		const a = await book(db, f, { startsAt: at('10:00') });
		const original = await book(db, f, { startsAt: at('11:00') });
		// Oferta fija: primero los dos PIN ya usados (deben descartarse), luego uno libre
		// que no puede coincidir con ninguno de ellos.
		const free = [a.accessCode, original.accessCode].includes('0000') ? '0001' : '0000';
		const offered = [a.accessCode, original.accessCode, free];
		let n = 0;
		const r = await rescheduleBooking(
			db,
			{ municipalityId: f.municipalityId, bookingId: original.id, startsAt: at('12:00'), now },
			{ generateCode: () => offered[Math.min(n++, offered.length - 1)] }
		);
		if (!r.ok) throw new Error(r.error);
		expect(r.value.accessCode).toBe(free);
		const active = (await db.select().from(bookings).where(eq(bookings.status, 'confirmed'))).map(
			(b) => b.accessCode
		);
		expect(new Set(active).size).toBe(active.length);
	});

	it('mantén a entidade e o seu prezo ao cambiar unha reserva de club', async () => {
		const { db, f } = await setup();
		const [entity] = await db
			.insert(entities)
			.values({
				municipalityId: f.municipalityId,
				name: 'Club de proba',
				shortName: 'CP',
				priceMode: 'free',
				maxActiveBookings: 1
			})
			.returning();
		await db.insert(entityMembers).values({ entityId: entity.id, userId: f.userId });
		const original = await book(db, f, { entityId: entity.id, startsAt: at('18:00') });
		const moved = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: original.id,
			startsAt: at('19:00'),
			now
		});
		expect(
			moved.ok && { entityId: moved.value.entityId, priceCents: moved.value.priceCents }
		).toEqual({
			entityId: entity.id,
			priceCents: 0
		});
	});
});

describe('lookupAccessCode by PIN and QR', () => {
	const SECRET = 'test-secret';
	const today = new Date('2026-10-22T08:00:00Z');

	it('finds today confirmed booking by PIN and by QR token', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const base = { municipalityId: f.municipalityId, now: today, qrSecret: SECRET };
		const byPin = await lookupAccessCode(db, {
			...base,
			code: ` ${b.accessCode.slice(0, 2)} ${b.accessCode.slice(2)} `
		});
		const byQr = await lookupAccessCode(db, { ...base, code: signBookingQr(b.id, SECRET) });
		expect(byPin.ok && byPin.value.map((m) => m.bookingId)).toEqual([b.id]);
		expect(byQr.ok && byQr.value.map((m) => m.bookingId)).toEqual([b.id]);
	});

	it('a token with a wrong signature or no secret is NOT_FOUND', async () => {
		const { db, f } = await setup();
		const b = await book(db, f);
		const base = { municipalityId: f.municipalityId, now: today };
		const bad = await lookupAccessCode(db, {
			...base,
			qrSecret: SECRET,
			code: signBookingQr(b.id, 'other')
		});
		const none = await lookupAccessCode(db, {
			...base,
			qrSecret: null,
			code: signBookingQr(b.id, SECRET)
		});
		expect(bad.ok ? null : bad.error).toBe('NOT_FOUND');
		expect(none.ok ? null : none.error).toBe('NOT_FOUND');
	});

	it('a token of a booking of another concello is NOT_FOUND', async () => {
		const { db, f } = await setup();
		const [p2] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: f.otherMunicipalityId, userId: f.userId, isResident: false })
			.returning();
		const r = await createBooking(db, {
			...input(f),
			municipalityId: f.otherMunicipalityId,
			facilityId: f.otherFacilityId,
			profileId: p2.id
		});
		if (!r.ok) throw new Error(r.error);
		const res = await lookupAccessCode(db, {
			municipalityId: f.municipalityId,
			now: today,
			qrSecret: SECRET,
			code: signBookingQr(r.value.id, SECRET)
		});
		expect(res.ok ? null : res.error).toBe('NOT_FOUND');
	});

	it('a six-digit legacy code is no longer accepted as a PIN', async () => {
		const { db, f } = await setup();
		await book(db, f);
		const res = await lookupAccessCode(db, {
			municipalityId: f.municipalityId,
			now: today,
			code: '123456'
		});
		expect(res.ok ? null : res.error).toBe('NOT_FOUND');
	});
});
