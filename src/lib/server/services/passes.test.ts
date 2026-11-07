// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { bookings, passTypes, walletMovements, wallets } from '../db/schema';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from './fixtures';
import { lookupPassAccess, sellPass } from './passes';
import { parseEuros } from '../../../routes/[slug]/admin/instalacions/text';
import { walletBalance } from './wallet';

let db: Db;
let fx: Fixture;
let typeId: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	const [type] = await db
		.insert(passTypes)
		.values({
			municipalityId: fx.municipalityId,
			facilityTypeId: fx.typeId,
			name: 'Mensual',
			days: 30,
			priceCents: 1800
		})
		.returning();
	typeId = type.id;
});

describe('abonos', () => {
	it('cobra un abono desde el monedero', async () => {
		const [wallet] = await db.insert(wallets).values({ userId: fx.userId }).returning();
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: 2000,
			kind: 'axuste',
			reference: 'test'
		});
		const bought = await sellPass(db, {
			municipalityId: fx.municipalityId,
			passTypeId: typeId,
			profileId: fx.profileId,
			createdBy: fx.userId,
			paymentMethod: 'wallet',
			now: new Date('2030-01-01T10:00:00Z')
		});
		expect(bought.ok).toBe(true);
		expect(await walletBalance(db, fx.userId)).toBe(200);
	});
	it('vale el día 29 y no el 31', async () => {
		const bought = await sellPass(db, {
			municipalityId: fx.municipalityId,
			passTypeId: typeId,
			profileId: fx.profileId,
			createdBy: fx.userId,
			now: new Date('2030-01-01T10:00:00Z')
		});
		expect(bought.ok).toBe(true);
		if (!bought.ok) return;
		expect(bought.value.endsOn).toBe('2030-01-30');
		expect(
			(
				await lookupPassAccess(db, {
					municipalityId: fx.municipalityId,
					code: bought.value.pin,
					now: new Date('2030-01-30T12:00:00Z')
				})
			).ok
		).toBe(true);
		expect(
			(
				await lookupPassAccess(db, {
					municipalityId: fx.municipalityId,
					code: bought.value.pin,
					now: new Date('2030-02-01T12:00:00Z')
				})
			).ok
		).toBe(false);
	});

	it('no reutiliza el PIN de una reserva en ninguno de sus días', async () => {
		await db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt: new Date('2030-03-02T10:00:00Z'),
			endsAt: new Date('2030-03-02T11:00:00Z'),
			status: 'confirmed',
			accessCode: '0000',
			priceCents: 600,
			channel: 'online',
			createdByUserId: fx.userId
		});
		const bought = await sellPass(db, {
			municipalityId: fx.municipalityId,
			passTypeId: typeId,
			profileId: fx.profileId,
			createdBy: fx.userId,
			now: new Date('2030-03-01T10:00:00Z')
		});
		expect(bought.ok && bought.value.pin).not.toBe('0000');
	});

	it('serializa los PIN de abonos con los de las reservas de cada día cubierto', async () => {
		const startsOn = '2030-05-01';
		const bookingPins = ['0000', '0001'];
		for (const [index, accessCode] of bookingPins.entries()) {
			await db.insert(bookings).values({
				municipalityId: fx.municipalityId,
				facilityId: fx.facilityId,
				profileId: fx.profileId,
				startsAt: new Date(`2030-05-0${index + 1}T10:00:00Z`),
				endsAt: new Date(`2030-05-0${index + 1}T11:00:00Z`),
				status: 'confirmed',
				accessCode,
				priceCents: 600,
				channel: 'online',
				createdByUserId: fx.userId
			});
		}
		const input = {
			municipalityId: fx.municipalityId,
			passTypeId: typeId,
			profileId: fx.profileId,
			createdBy: fx.userId,
			startsOn,
			now: new Date('2030-01-01T10:00:00Z')
		};
		const first = await sellPass(db, input);
		const second = await sellPass(db, input);
		if (!first.ok || !second.ok) throw new Error('No se pudo vender el abono');

		expect(first.value.pin).not.toBe(second.value.pin);
		expect(bookingPins).not.toContain(first.value.pin);
		expect(bookingPins).not.toContain(second.value.pin);
	});

	it('acepta una fecha de inicio elegida al vender', async () => {
		const bought = await sellPass(db, {
			municipalityId: fx.municipalityId,
			passTypeId: typeId,
			profileId: fx.profileId,
			createdBy: fx.userId,
			startsOn: '2030-04-10',
			now: new Date('2030-01-01T10:00:00Z')
		});
		expect(bought.ok && bought.value.startsOn).toBe('2030-04-10');
		expect(bought.ok && bought.value.endsOn).toBe('2030-05-09');
	});

	it('convierte 25,50 euros en 2550 céntimos', () => {
		expect(parseEuros('25,50')).toBe(2550);
	});
});
