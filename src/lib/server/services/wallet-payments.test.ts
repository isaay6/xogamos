// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, walletMovements, wallets } from '../db/schema';
import { localDateTimeToUtc } from '../domain/time';
import { cancelBooking, createBooking, markNoShow, rescheduleBooking } from './bookings';
import { addHoliday } from './holidays';
import { seedFixture, type Fixture } from './fixtures';
import { createTestDb } from '../db/test-db';
import { walletBalance } from './wallet';

const now = new Date('2026-10-21T10:00:00Z');
const startsAt = localDateTimeToUtc('2026-10-22', '18:00');

async function setup(balance: number) {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const [wallet] = await db.insert(wallets).values({ userId: f.userId }).returning();
	if (balance)
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: balance,
			kind: 'axuste',
			reference: 'test',
			createdAt: now
		});
	return { db, f };
}

async function paidBooking(db: Db, f: Fixture, at = startsAt) {
	return createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at,
		channel: 'online',
		createdByUserId: f.userId,
		paymentMethod: 'wallet',
		now
	});
}

describe('pagos do monedero', () => {
	it('cobra la reserva y guarda cómo se pagó', async () => {
		const { db, f } = await setup(600);
		const result = await paidBooking(db, f);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.paymentMethod).toBe('wallet');
		expect(await walletBalance(db, f.userId)).toBe(0);
	});

	it('no crea la reserva si el saldo no alcanza', async () => {
		const { db, f } = await setup(599);
		const result = await paidBooking(db, f);
		expect(result).toEqual({ ok: false, error: 'INSUFFICIENT_WALLET_BALANCE' });
		expect(await db.$count(bookings)).toBe(0);
	});

	it('devuelve al cancelar en plazo, pero no fuera de plazo', async () => {
		const { db, f } = await setup(1200);
		const first = await paidBooking(db, f);
		if (!first.ok) throw new Error(first.error);
		await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: first.value.id,
			byStaff: false,
			now
		});
		expect(await walletBalance(db, f.userId)).toBe(1200);
		const second = await paidBooking(db, f, localDateTimeToUtc('2026-10-22', '19:00'));
		if (!second.ok) throw new Error(second.error);
		const late = new Date(second.value.startsAt.getTime() - 30 * 60_000);
		expect(
			(
				await cancelBooking(db, {
					municipalityId: f.municipalityId,
					bookingId: second.value.id,
					byStaff: false,
					now: late
				})
			).ok
		).toBe(false);
		expect(await walletBalance(db, f.userId)).toBe(600);
	});

	it('dos cargos concurrentes no sobregiran la cartera', async () => {
		const { db, f } = await setup(600);
		const results = await Promise.all([
			paidBooking(db, f, localDateTimeToUtc('2026-10-22', '18:00')),
			paidBooking(db, f, localDateTimeToUtc('2026-10-22', '19:00'))
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(await walletBalance(db, f.userId)).toBe(0);
	});

	it('no devuelve una reserva marcada como falta', async () => {
		const { db, f } = await setup(600);
		const booked = await paidBooking(db, f);
		if (!booked.ok) throw new Error(booked.error);
		const afterStart = new Date(booked.value.startsAt.getTime() + 60_000);
		expect(
			(
				await markNoShow(db, {
					municipalityId: f.municipalityId,
					bookingId: booked.value.id,
					now: afterStart
				})
			).ok
		).toBe(true);
		expect(await walletBalance(db, f.userId)).toBe(0);
	});

	it('devuelve en una cancelación por cierre o festivo', async () => {
		const closed = await setup(600);
		const first = await paidBooking(closed.db, closed.f);
		if (!first.ok) throw new Error(first.error);
		await cancelBooking(closed.db, {
			municipalityId: closed.f.municipalityId,
			bookingId: first.value.id,
			byStaff: true,
			reason: 'Avaría',
			closureId: 'closure-test',
			now
		});
		expect(await walletBalance(closed.db, closed.f.userId)).toBe(600);

		const holiday = await setup(600);
		const second = await paidBooking(holiday.db, holiday.f);
		if (!second.ok) throw new Error(second.error);
		await addHoliday(holiday.db, holiday.f.municipalityId, '2026-10-22', 'Proba', 'closed', now);
		expect(await walletBalance(holiday.db, holiday.f.userId)).toBe(600);
	});

	it('devuelve una reserva de monedero al cancelar la conserxería', async () => {
		const { db, f } = await setup(600);
		const booked = await paidBooking(db, f);
		if (!booked.ok) throw new Error(booked.error);
		const cancelled = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: booked.value.id,
			byStaff: true,
			reason: 'Mantemento',
			now
		});
		expect(cancelled.ok).toBe(true);
		expect(await walletBalance(db, f.userId)).toBe(600);
	});

	it('conserva el pago de monedero al reprogramar sin volver a cobrar', async () => {
		const { db, f } = await setup(600);
		const booked = await paidBooking(db, f);
		if (!booked.ok) throw new Error(booked.error);
		const moved = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: booked.value.id,
			startsAt: localDateTimeToUtc('2026-10-22', '19:00'),
			now
		});
		if (!moved.ok) throw new Error(moved.error);
		expect(moved.value.paymentMethod).toBe('wallet');
		expect(await walletBalance(db, f.userId)).toBe(0);
		expect(await db.$count(walletMovements, eq(walletMovements.kind, 'pago_reserva'))).toBe(1);
	});
});
