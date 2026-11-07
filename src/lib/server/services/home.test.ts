// SPDX-License-Identifier: EUPL-1.2
// Portada (tarefa 7): libre agora, seguinte hora libre por deporte e horas tranquilas.
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, closures, facilities, openingHours } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { addLocalDays, localDateOf, localDateTimeToUtc } from '../domain/time';
import { FIXTURE_PRICES, seedFixture, type Fixture } from './fixtures';
import { freeNow, nextFreeBySport, quietHourTip } from './home';

// Martes 24 nov 2026, 08:00 en Madrid.
const NOW = new Date('2026-11-24T08:00:00+01:00');
const DATE = '2026-11-24';
const HOURS = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);

async function setup(): Promise<{ db: Db; f: Fixture; pista2: string }> {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const [row] = await db
		.insert(facilities)
		.values({
			municipalityId: f.municipalityId,
			typeId: f.typeId,
			name: 'Pista 2',
			slotMinutes: 60,
			...FIXTURE_PRICES
		})
		.returning();
	await db.insert(openingHours).values(
		[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
			facilityId: row.id,
			weekday,
			opens: '09:00',
			closes: '22:00'
		}))
	);
	return { db, f, pista2: row.id };
}

type Past = {
	facilityId: string;
	date: string;
	hhmm: string;
	status?: 'confirmed' | 'attended' | 'cancelled' | 'no_show';
};

async function book(db: Db, f: Fixture, list: Past[]): Promise<void> {
	if (list.length === 0) return;
	await db.insert(bookings).values(
		list.map((b) => {
			const startsAt = localDateTimeToUtc(b.date, b.hhmm);
			return {
				municipalityId: f.municipalityId,
				facilityId: b.facilityId,
				profileId: f.profileId,
				seats: 1,
				startsAt,
				endsAt: new Date(startsAt.getTime() + 3600_000),
				status: b.status ?? 'attended',
				accessCode: '1234',
				priceCents: 300,
				channel: 'online' as const,
				createdByUserId: f.userId
			};
		})
	);
}

describe('freeNow', () => {
	it('nunca devolve unha franxa que empece antes de agora, e todas son de hoxe', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-11-24T10:30:00+01:00');
		const out = await freeNow(db, f.municipalityId, now);
		expect(out.length).toBeGreaterThan(0);
		for (const o of out) {
			expect(o.startsAt.getTime()).toBeGreaterThan(now.getTime());
			expect(localDateOf(o.startsAt)).toBe(DATE);
		}
		// Un só deporte: unha soa tarxeta, a primeira hora libre (11:00).
		expect(out.map((o) => o.time)).toEqual(['11:00']);
	});

	it('unha franxa que empeza xusto agora non conta', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-11-24T11:00:00+01:00');
		const out = await freeNow(db, f.municipalityId, now);
		expect(out.map((o) => o.time)).toEqual(['12:00']);
		const [s] = await nextFreeBySport(db, f.municipalityId, now);
		expect(s.next).toEqual({ date: DATE, time: '12:00' });
	});

	it('á noite, sen horas que queden hoxe, non devolve nada', async () => {
		const { db, f } = await setup();
		const out = await freeNow(db, f.municipalityId, new Date('2026-11-24T21:30:00+01:00'));
		expect(out).toEqual([]);
	});
});

describe('nextFreeBySport', () => {
	it('dá a primeira hora libre de hoxe', async () => {
		const { db, f } = await setup();
		const [s] = await nextFreeBySport(db, f.municipalityId, NOW);
		expect(s.sport.typeId).toBe(f.typeId);
		expect(s.next).toEqual({ date: DATE, time: '09:00' });
		expect(s.closed).toBeNull();
	});

	it('sen horas hoxe mira mañá', async () => {
		const { db, f } = await setup();
		const [s] = await nextFreeBySport(db, f.municipalityId, new Date('2026-11-24T21:30:00+01:00'));
		expect(s.next).toEqual({ date: '2026-11-25', time: '09:00' });
	});

	it('un peche futuro non marca o deporte como pechado hoxe', async () => {
		const { db, f, pista2 } = await setup();
		await db.insert(closures).values(
			[f.facilityId, pista2].map((facilityId) => ({
				facilityId,
				startsAt: localDateTimeToUtc('2026-11-25', '00:00'),
				endsAt: localDateTimeToUtc('2026-11-26', '00:00'),
				reason: 'Mantemento'
			}))
		);
		const [s] = await nextFreeBySport(db, f.municipalityId, NOW);
		expect(s.next).toEqual({ date: DATE, time: '09:00' });
		expect(s.closed).toBeNull();
	});

	it('coas instalacións pechadas di o motivo', async () => {
		const { db, f, pista2 } = await setup();
		await db.insert(closures).values(
			[f.facilityId, pista2].map((facilityId) => ({
				facilityId,
				startsAt: localDateTimeToUtc('2026-09-16', '00:00'),
				endsAt: localDateTimeToUtc('2027-06-15', '00:00'),
				reason: 'Pechada ata o verán'
			}))
		);
		const [s] = await nextFreeBySport(db, f.municipalityId, NOW);
		expect(s.next).toBeNull();
		expect(s.closed).toEqual({
			reason: 'Pechada ata o verán',
			startsOn: DATE,
			endsOn: '2027-06-14'
		});
	});
});

describe('quietHourTip', () => {
	/** As 8 semanas anteriores: todo cheo os martes, agás a Pista 2 ás 15:00 (1 de 8). */
	async function history(db: Db, f: Fixture, pista2: string) {
		const list: Past[] = [];
		for (let w = 1; w <= 8; w++) {
			const date = addLocalDays(DATE, -7 * w);
			for (const hhmm of HOURS) {
				list.push({ facilityId: f.facilityId, date, hhmm });
				if (hhmm !== '15:00' || w === 3) list.push({ facilityId: pista2, date, hhmm });
			}
			// Non contan: canceladas, outro día da semana e máis aló de 8 semanas.
			list.push({ facilityId: pista2, date, hhmm: '15:00', status: 'cancelled' });
			list.push({ facilityId: pista2, date: addLocalDays(date, 1), hhmm: '15:00' });
		}
		list.push({ facilityId: pista2, date: addLocalDays(DATE, -63), hhmm: '15:00' });
		await book(db, f, list);
	}

	it('escolle a hora de hoxe co menor uso medio das últimas 8 semanas', async () => {
		const { db, f, pista2 } = await setup();
		await history(db, f, pista2);
		const tip = await quietHourTip(db, f.municipalityId, NOW);
		expect(tip).toMatchObject({
			typeId: f.typeId,
			mascot: 'padel',
			facilityName: 'Pista 2',
			hour: '15:00',
			pct: 13
		});
	});

	it('as horas xa pasadas non contan; se todo adoita estar cheo, non hai consello', async () => {
		const { db, f, pista2 } = await setup();
		await history(db, f, pista2);
		expect(
			await quietHourTip(db, f.municipalityId, new Date('2026-11-24T16:00:00+01:00'))
		).toBeNull();
	});

	it('unha hora xa reservada hoxe non se propón', async () => {
		const { db, f, pista2 } = await setup();
		await history(db, f, pista2);
		await book(db, f, [{ facilityId: pista2, date: DATE, hhmm: '15:00', status: 'confirmed' }]);
		expect(await quietHourTip(db, f.municipalityId, NOW)).toBeNull();
	});
});
