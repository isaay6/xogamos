// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Mascot } from '../../mascots';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	holidays,
	openingHours
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { FIXTURE_PRICES, seedFixture, type Fixture } from './fixtures';
import { alternatives, dayStrip, freeOptions, hoursForDay, listSports } from './search';

const NOW = new Date('2026-11-24T08:00:00+01:00');
const DATE = '2026-11-24';
const WEEK = [0, 1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);

type Setup = { db: Db; f: Fixture; pista2: string };

/** Instalación activa con horario de 09:00 a 22:00 todos los días. */
async function addFacility(
	db: Db,
	municipalityId: string,
	typeId: string,
	name: string,
	extra: { location?: string; capacity?: number } = {}
): Promise<string> {
	const [row] = await db
		.insert(facilities)
		.values({ municipalityId, typeId, name, slotMinutes: 60, ...FIXTURE_PRICES, ...extra })
		.returning();
	await db
		.insert(openingHours)
		.values(
			WEEK.map((weekday) => ({ facilityId: row.id, weekday, opens: '09:00', closes: '22:00' }))
		);
	return row.id;
}

async function addType(db: Db, municipalityId: string, mascot: Mascot): Promise<string> {
	const [row] = await db
		.insert(facilityTypes)
		.values({
			municipalityId,
			nameGl: mascot,
			nameEs: mascot,
			mascot,
			color: '#000000',
			bookingMode: 'slot'
		})
		.returning();
	return row.id;
}

async function setup(opts: { bookingMode?: BookingMode; capacity?: number } = {}): Promise<Setup> {
	const db = await createTestDb();
	const f = await seedFixture(db, opts);
	const pista2 = await addFacility(db, f.municipalityId, f.typeId, 'Pista 2', {
		location: 'Pavillón da Xunqueira'
	});
	return { db, f, pista2 };
}

/** Reserva confirmada insertada a mano (sin pasar por las reglas de createBooking). */
async function occupy(
	db: Db,
	f: Fixture,
	facilityId: string,
	date: string,
	hhmm: string,
	seats = 1
): Promise<void> {
	const startsAt = localDateTimeToUtc(date, hhmm);
	await db.insert(bookings).values({
		municipalityId: f.municipalityId,
		facilityId,
		profileId: f.profileId,
		seats,
		startsAt,
		endsAt: new Date(startsAt.getTime() + 3600_000),
		accessCode: '123456',
		priceCents: 300,
		channel: 'online',
		createdByUserId: f.userId
	});
}

describe('listSports', () => {
	it('devolve o tipo de Ribadávila e non o de Montemaior', async () => {
		const { db, f } = await setup();
		const sports = await listSports(db, f.municipalityId);
		expect(sports).toEqual([
			{
				typeId: f.typeId,
				nameGl: 'Pista de pádel',
				nameEs: 'Pista de pádel',
				mascot: 'padel',
				color: '#1d4ed8',
				bookingMode: 'slot'
			}
		]);
	});

	it('sen instalacións activas devolve []', async () => {
		const { db, f } = await setup();
		await db
			.update(facilities)
			.set({ active: false })
			.where(eq(facilities.municipalityId, f.municipalityId));
		expect(await listSports(db, f.municipalityId)).toEqual([]);
	});

	it('ordena polo catálogo de personaxes', async () => {
		const { db, f } = await setup();
		const bolos = await addType(db, f.municipalityId, 'bolos');
		const tenis = await addType(db, f.municipalityId, 'tenis');
		await addFacility(db, f.municipalityId, bolos, 'Bolera');
		await addFacility(db, f.municipalityId, tenis, 'Tenis 1');
		const sports = await listSports(db, f.municipalityId);
		expect(sports.map((s) => s.mascot)).toEqual(['padel', 'tenis', 'bolos']);
	});
});

describe('hoursForDay', () => {
	it('un festivo pechado non ofrece horas nin opcións', async () => {
		const { db, f } = await setup();
		await db.insert(holidays).values({
			municipalityId: f.municipalityId,
			date: DATE,
			name: 'San Xoán',
			mode: 'closed'
		});
		expect(await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW)).toEqual([]);
		expect(await freeOptions(db, f.municipalityId, f.typeId, DATE, null, NOW)).toEqual([]);
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		expect(days.find((day) => day.date === DATE)?.closed).toEqual({
			reason: 'San Xoán',
			startsOn: DATE,
			endsOn: DATE,
			holiday: true
		});
	});

	it('un festivo con horario de domingo usa as súas franxas', async () => {
		const { db, f, pista2 } = await setup();
		for (const facilityId of [f.facilityId, pista2]) {
			await db.delete(openingHours).where(eq(openingHours.facilityId, facilityId));
			await db.insert(openingHours).values([
				{ facilityId, weekday: 1, opens: '09:00', closes: '22:00' },
				{ facilityId, weekday: 6, opens: '12:00', closes: '14:00' }
			]);
		}
		await db.insert(holidays).values({
			municipalityId: f.municipalityId,
			date: DATE,
			name: 'San Xoán',
			mode: 'sunday_hours'
		});
		expect(
			(await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW)).map((h) => h.time)
		).toEqual(['12:00', '13:00']);
	});
	it('devolve 13 horas de 09:00 a 21:00, todas libres', async () => {
		const { db, f } = await setup();
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW);
		expect(hours).toEqual(HOURS.map((time) => ({ time, free: true, remainingSeats: null })));
	});

	it('cunha pista ocupada a hora segue libre; coas dúas, non', async () => {
		const { db, f, pista2 } = await setup();
		await occupy(db, f, f.facilityId, DATE, '19:00');
		let hours = await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW);
		expect(hours.find((h) => h.time === '19:00')?.free).toBe(true);
		await occupy(db, f, pista2, DATE, '19:00');
		hours = await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW);
		expect(hours.find((h) => h.time === '19:00')?.free).toBe(false);
	});

	it('as horas xa empezadas non están libres', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-11-24T10:30:00+01:00');
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, DATE, now);
		expect(hours.filter((h) => !h.free).map((h) => h.time)).toEqual(['09:00', '10:00']);
	});

	it('o día do cambio de hora (25/10) ten 13 horas de 09:00 a 21:00', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-10-24T08:00:00+02:00');
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, '2026-10-25', now);
		expect(hours.map((h) => h.time)).toEqual(HOURS);
		expect(hours.every((h) => h.free)).toBe(true);
	});

	it('en modo capacity suma as prazas libres', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db, { bookingMode: 'capacity', capacity: 8 });
		await occupy(db, f, f.facilityId, DATE, '19:00', 5);
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW);
		expect(hours.find((h) => h.time === '19:00')).toEqual({
			time: '19:00',
			free: true,
			remainingSeats: 3
		});
		expect(hours.find((h) => h.time === '18:00')?.remainingSeats).toBe(8);
	});

	it('en modo day devolve []', async () => {
		const { db, f } = await setup({ bookingMode: 'day' });
		expect(await hoursForDay(db, f.municipalityId, f.typeId, DATE, NOW)).toEqual([]);
	});

	it('un tipo doutro concello devolve []', async () => {
		const { db, f } = await setup();
		const [other] = await db
			.select({ typeId: facilities.typeId })
			.from(facilities)
			.where(eq(facilities.id, f.otherFacilityId));
		expect(await hoursForDay(db, f.municipalityId, other.typeId, DATE, NOW)).toEqual([]);
	});
});

describe('dayStrip', () => {
	it('devolve 15 días consecutivos sen duplicados a través do 25/10', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-10-24T08:00:00+02:00');
		const days = await dayStrip(db, f.municipalityId, f.typeId, now);
		const dates = days.map((d) => d.date);
		expect(dates).toHaveLength(15);
		expect(new Set(dates).size).toBe(15);
		expect(dates[0]).toBe('2026-10-24');
		expect(dates).toContain('2026-10-25');
		expect(dates[14]).toBe('2026-11-07');
		for (let i = 1; i < dates.length; i++) {
			const gap = Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`);
			expect(gap).toBe(86_400_000);
		}
		expect(days.every((d) => !d.full)).toBe(true);
	});

	it('un día con todas as franxas reservadas sae full', async () => {
		const { db, f, pista2 } = await setup();
		for (const id of [f.facilityId, pista2]) {
			for (const h of HOURS) await occupy(db, f, id, '2026-11-26', h);
		}
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		expect(days.find((d) => d.date === '2026-11-26')?.full).toBe(true);
		expect(days.filter((d) => d.full).map((d) => d.date)).toEqual(['2026-11-26']);
	});

	it('hoxe sae full se todas as franxas xa empezaron', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-11-24T21:30:00+01:00');
		const days = await dayStrip(db, f.municipalityId, f.typeId, now);
		expect(days[0]).toEqual({ date: DATE, full: true });
		expect(days[1]).toEqual({ date: '2026-11-25', full: false });
	});
});

describe('freeOptions', () => {
	it('ás 19:00 coa Pista 1 ocupada devolve só a Pista 2', async () => {
		const { db, f, pista2 } = await setup();
		await occupy(db, f, f.facilityId, DATE, '19:00');
		const options = await freeOptions(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(options).toEqual([
			{
				facilityId: pista2,
				facilityName: 'Pista 2',
				location: 'Pavillón da Xunqueira',
				address: '',
				accessInfo: '',
				accessInfoEs: null,
				unitIndex: null,
				remainingSeats: null,
				startsAt: localDateTimeToUtc(DATE, '19:00'),
				endsAt: localDateTimeToUtc(DATE, '20:00'),
				...FIXTURE_PRICES,
				priceSocialCents: null
			}
		]);
	});

	it('sen hora devolve as opcións de todas as horas, ordenadas', async () => {
		const { db, f } = await setup();
		await occupy(db, f, f.facilityId, DATE, '19:00');
		const options = await freeOptions(db, f.municipalityId, f.typeId, DATE, null, NOW);
		expect(options).toHaveLength(25);
		const starts = options.map((o) => o.startsAt.getTime());
		expect([...starts].sort((a, b) => a - b)).toEqual(starts);
		// Mesma hora: primeiro a localización baleira (Pista 1), logo o pavillón.
		expect(options.slice(0, 2).map((o) => o.facilityName)).toEqual(['Pista 1', 'Pista 2']);
		const at19 = options.filter(
			(o) => o.startsAt.getTime() === localDateTimeToUtc(DATE, '19:00').getTime()
		);
		expect(at19.map((o) => o.facilityName)).toEqual(['Pista 2']);
	});

	it('en modo capacity dá as prazas restantes', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db, { bookingMode: 'capacity', capacity: 8 });
		await occupy(db, f, f.facilityId, DATE, '19:00', 5);
		const options = await freeOptions(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(options).toHaveLength(1);
		expect(options[0].remainingSeats).toBe(3);
		expect(options[0].unitIndex).toBeNull();
	});

	it('en modo unit dá unha opción por unidade libre', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db, { bookingMode: 'unit', units: 3 });
		await db.insert(bookings).values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			unitIndex: 1,
			startsAt: localDateTimeToUtc(DATE, '19:00'),
			endsAt: localDateTimeToUtc(DATE, '20:00'),
			accessCode: '123456',
			priceCents: 300,
			channel: 'online',
			createdByUserId: f.userId
		});
		const options = await freeOptions(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(options.map((o) => o.unitIndex)).toEqual([0, 2]);
	});
});

describe('alternatives', () => {
	async function full19(): Promise<Setup> {
		const s = await setup();
		await occupy(s.db, s.f, s.f.facilityId, DATE, '19:00');
		await occupy(s.db, s.f, s.pista2, DATE, '19:00');
		return s;
	}

	it('same_day á hora máis próxima (empate: a anterior) e other_day ao día seguinte', async () => {
		const { db, f } = await full19();
		const alts = await alternatives(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(alts).toEqual([
			{ kind: 'same_day', typeId: f.typeId, date: DATE, time: '18:00', count: 2 },
			{ kind: 'other_day', typeId: f.typeId, date: '2026-11-25', time: '19:00', count: 2 }
		]);
	});

	it('cun tipo tenis libre ese día o terceiro é similar_sport', async () => {
		const { db, f } = await full19();
		const tenis = await addType(db, f.municipalityId, 'tenis');
		await addFacility(db, f.municipalityId, tenis, 'Tenis 1');
		const alts = await alternatives(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(alts).toHaveLength(3);
		expect(alts[2]).toEqual({
			kind: 'similar_sport',
			typeId: tenis,
			date: DATE,
			time: '19:00',
			count: 1
		});
	});

	it('cun tipo bolos (familia outro) non hai terceiro', async () => {
		const { db, f } = await full19();
		const bolos = await addType(db, f.municipalityId, 'bolos');
		await addFacility(db, f.municipalityId, bolos, 'Bolera');
		const alts = await alternatives(db, f.municipalityId, f.typeId, DATE, '19:00', NOW);
		expect(alts.map((a) => a.kind)).toEqual(['same_day', 'other_day']);
	});

	it('un tipo da familia outro nunca propón similar_sport', async () => {
		const { db, f } = await setup();
		const bolos = await addType(db, f.municipalityId, 'bolos');
		const bolera = await addFacility(db, f.municipalityId, bolos, 'Bolera');
		const golf = await addType(db, f.municipalityId, 'golf');
		await addFacility(db, f.municipalityId, golf, 'Campo de prácticas');
		await occupy(db, f, bolera, DATE, '19:00');
		const alts = await alternatives(db, f.municipalityId, bolos, DATE, '19:00', NOW);
		expect(alts.map((a) => a.kind)).toEqual(['same_day', 'other_day']);
	});

	it('sen hora: same_day é a primeira libre do día', async () => {
		const { db, f } = await setup();
		const now = new Date('2026-11-24T10:30:00+01:00');
		const alts = await alternatives(db, f.municipalityId, f.typeId, DATE, null, now);
		expect(alts[0]).toEqual({
			kind: 'same_day',
			typeId: f.typeId,
			date: DATE,
			time: '11:00',
			count: 2
		});
		expect(alts[1]).toEqual({
			kind: 'other_day',
			typeId: f.typeId,
			date: '2026-11-25',
			time: null,
			count: 26
		});
	});
});

// ── Peches (tarefa 7): «Pechada: {motivo}» en vez de completo ─────────────────

/** Peche das instalacións dadas entre dous instantes locais ('YYYY-MM-DD HH:MM'). */
async function close(
	db: Db,
	facilityIds: string[],
	from: [string, string],
	to: [string, string],
	reason = 'Pechada ata o verán'
): Promise<void> {
	await db.insert(closures).values(
		facilityIds.map((facilityId) => ({
			facilityId,
			startsAt: localDateTimeToUtc(...from),
			endsAt: localDateTimeToUtc(...to),
			reason
		}))
	);
}

describe('peches', () => {
	it('coas dúas pistas pechadas, a tira e as horas din pechada co motivo, non completo', async () => {
		const { db, f, pista2 } = await setup();
		await close(db, [f.facilityId, pista2], ['2026-11-25', '00:00'], ['2026-11-28', '00:00']);
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		const closed = days.filter((d) => d.closed);
		expect(closed.map((d) => d.date)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27']);
		expect(closed.every((d) => d.closed?.reason === 'Pechada ata o verán')).toBe(true);
		expect(days.find((d) => d.date === DATE)?.closed).toBeUndefined();

		const hours = await hoursForDay(db, f.municipalityId, f.typeId, '2026-11-26', NOW);
		expect(hours.map((h) => h.time)).toEqual(HOURS);
		expect(hours.every((h) => !h.free && h.closed?.reason === 'Pechada ata o verán')).toBe(true);
	});

	it('cunha soa pista pechada o día e as horas seguen libres', async () => {
		const { db, f } = await setup();
		await close(db, [f.facilityId], ['2026-11-25', '00:00'], ['2026-11-26', '00:00']);
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		expect(days.find((d) => d.date === '2026-11-25')).toEqual({ date: '2026-11-25', full: false });
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, '2026-11-25', NOW);
		expect(hours.every((h) => h.free && h.closed === undefined)).toBe(true);
	});

	it('un peche dunha mañá marca só esas horas; o día non sae pechado', async () => {
		const { db, f, pista2 } = await setup();
		await close(
			db,
			[f.facilityId, pista2],
			['2026-11-25', '09:00'],
			['2026-11-25', '12:00'],
			'Partido do CD Viana'
		);
		const hours = await hoursForDay(db, f.municipalityId, f.typeId, '2026-11-25', NOW);
		expect(hours.filter((h) => h.closed).map((h) => h.time)).toEqual(['09:00', '10:00', '11:00']);
		expect(hours.find((h) => h.time === '09:00')).toEqual({
			time: '09:00',
			free: false,
			remainingSeats: null,
			closed: { reason: 'Partido do CD Viana', startsOn: '2026-11-25', endsOn: '2026-11-25' }
		});
		expect(hours.find((h) => h.time === '12:00')).toEqual({
			time: '12:00',
			free: true,
			remainingSeats: null
		});
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		expect(days.find((d) => d.date === '2026-11-25')?.closed).toBeUndefined();
	});

	it('en modo day o día pechado tamén leva o motivo', async () => {
		const { db, f, pista2 } = await setup({ bookingMode: 'day' });
		await close(db, [f.facilityId, pista2], ['2026-11-25', '00:00'], ['2026-11-26', '00:00']);
		const days = await dayStrip(db, f.municipalityId, f.typeId, NOW);
		expect(days.find((d) => d.date === '2026-11-25')).toEqual({
			date: '2026-11-25',
			full: true,
			closed: { reason: 'Pechada ata o verán', startsOn: '2026-11-25', endsOn: '2026-11-25' }
		});
	});
});
