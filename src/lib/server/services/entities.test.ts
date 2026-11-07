// SPDX-License-Identifier: EUPL-1.2
// Contas de club (tanda C): a entidade nunca se acepta polo formulario e as súas condicións
// (prezo, antelación, reservas activas, instalacións, faltas) aplícanse no servidor.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { facilities, municipalityProfiles, openingHours, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { createBooking, markNoShow } from './bookings';
import { addEntityMember, saveEntity, setEntityActive, type EntityInput } from './entities';
import { seedFixture, FIXTURE_PRICES, type Fixture } from './fixtures';
import { getAgenda } from './staff';

// Venres 20 nov 2026, 10:00; a ventá normal do concello é de 14 días.
const NOW = new Date('2026-11-20T10:00:00+01:00');
const at = (date: string, hhmm: string) => localDateTimeToUtc(date, hhmm);

const base: EntityInput = {
	name: 'CD Ribadávila',
	shortName: 'CDR',
	phone: '600000000',
	priceMode: null,
	fixedPriceCents: null,
	advanceDays: null,
	maxActiveBookings: null,
	maxConsecutiveSlots: null,
	noShowsCount: true,
	facilityIds: [],
	memberIds: []
};

async function setup(extra: Partial<EntityInput> = {}, member = true) {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const [admin] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'fixture-admin', displayName: 'Admin' })
		.returning();
	const entity = await saveEntity(db, f.municipalityId, admin.id, {
		...base,
		...extra,
		memberIds: member ? [f.userId] : []
	});
	if (!entity) throw new Error('ENTITY_NOT_SAVED');
	return { db, f, adminId: admin.id, entityId: entity.id };
}

const bookAsClub = (db: Db, f: Fixture, entityId: string, date: string, hhmm: string) =>
	createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		entityId,
		startsAt: at(date, hhmm),
		channel: 'online',
		createdByUserId: f.userId,
		now: NOW
	});

describe('reservar como club', () => {
	it('rexeita un entityId de quen non é responsable (formulario manipulado)', async () => {
		const { db, f, entityId } = await setup({}, false);
		const r = await bookAsClub(db, f, entityId, '2026-11-24', '18:00');
		expect(r).toEqual({ ok: false, error: 'ENTITY_NOT_ALLOWED' });
	});

	it('rexeita unha entidade doutro concello', async () => {
		const { db, f, adminId } = await setup();
		const other = await saveEntity(db, f.otherMunicipalityId, adminId, {
			...base,
			memberIds: [f.userId]
		});
		const r = await bookAsClub(db, f, other!.id, '2026-11-24', '18:00');
		expect(r).toEqual({ ok: false, error: 'ENTITY_NOT_ALLOWED' });
	});

	it('rexeita unha entidade desactivada', async () => {
		const { db, f, adminId, entityId } = await setup();
		await setEntityActive(db, f.municipalityId, adminId, entityId, false);
		const r = await bookAsClub(db, f, entityId, '2026-11-24', '18:00');
		expect(r).toEqual({ ok: false, error: 'ENTITY_NOT_ALLOWED' });
	});

	it('só nas instalacións permitidas', async () => {
		const { db, f, adminId } = await setup();
		// Outra instalación do mesmo concello: a única que o club pode reservar.
		const [annex] = await db
			.insert(facilities)
			.values({
				municipalityId: f.municipalityId,
				typeId: f.typeId,
				name: 'Pista anexa',
				...FIXTURE_PRICES
			})
			.returning();
		const limited = await saveEntity(db, f.municipalityId, adminId, {
			...base,
			name: 'Escola',
			shortName: 'ESC',
			facilityIds: [annex.id],
			memberIds: [f.userId]
		});
		const r = await bookAsClub(db, f, limited!.id, '2026-11-24', '18:00');
		expect(r).toEqual({ ok: false, error: 'ENTITY_FACILITY_NOT_ALLOWED' });
	});

	it('prezo de balde, fixo ou o normal', async () => {
		const free = await setup({ priceMode: 'free' });
		const a = await bookAsClub(free.db, free.f, free.entityId, '2026-11-24', '18:00');
		expect(a.ok && a.value.priceCents).toBe(0);

		const fixed = await setup({ priceMode: 'fixed', fixedPriceCents: 150 });
		const b = await bookAsClub(fixed.db, fixed.f, fixed.entityId, '2026-11-24', '18:00');
		expect(b.ok && b.value.priceCents).toBe(150);

		const normal = await setup({ priceMode: 'normal' });
		const c = await bookAsClub(normal.db, normal.f, normal.entityId, '2026-11-24', '18:00');
		expect(c.ok && c.value.priceCents).toBe(FIXTURE_PRICES.priceNonResidentCents);
	});

	it('máis días de antelación que a regra do concello', async () => {
		const { db, f, entityId } = await setup({ advanceDays: 30 });
		// 25 días despois: fóra dos 14 do concello, dentro dos 30 do club.
		expect((await bookAsClub(db, f, entityId, '2026-12-15', '18:00')).ok).toBe(true);
		const personal = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('2026-12-15', '19:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now: NOW
		});
		expect(personal.ok).toBe(false);
	});

	it('máximo de reservas activas do club', async () => {
		const { db, f, entityId } = await setup({ maxActiveBookings: 1 });
		expect((await bookAsClub(db, f, entityId, '2026-11-24', '18:00')).ok).toBe(true);
		const r = await bookAsClub(db, f, entityId, '2026-11-25', '18:00');
		expect(r).toEqual({ ok: false, error: 'ENTITY_MAX_ACTIVE_BOOKINGS' });
	});

	it('serializa o máximo de reservas activas entre instalacións', async () => {
		const { db, f, entityId } = await setup({ maxActiveBookings: 1 });
		const [annex] = await db
			.insert(facilities)
			.values({
				municipalityId: f.municipalityId,
				typeId: f.typeId,
				name: 'Pista anexa concorrente',
				...FIXTURE_PRICES
			})
			.returning();
		await db.insert(openingHours).values(
			[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
				facilityId: annex.id,
				weekday,
				opens: '09:00',
				closes: '22:00'
			}))
		);
		const results = await Promise.all([
			bookAsClub(db, f, entityId, '2026-11-24', '18:00'),
			createBooking(db, {
				municipalityId: f.municipalityId,
				facilityId: annex.id,
				profileId: f.profileId,
				entityId,
				startsAt: at('2026-11-24', '18:00'),
				channel: 'online',
				createdByUserId: f.userId,
				now: NOW
			})
		]);
		expect(results.filter((result) => result.ok)).toHaveLength(1);
	});

	it('limita as franxas consecutivas do club', async () => {
		const allowed = await setup({ maxConsecutiveSlots: 2 });
		expect(
			(await bookAsClub(allowed.db, allowed.f, allowed.entityId, '2026-11-24', '18:00')).ok
		).toBe(true);
		expect(
			(await bookAsClub(allowed.db, allowed.f, allowed.entityId, '2026-11-24', '19:00')).ok
		).toBe(true);
		const rejected = await bookAsClub(
			allowed.db,
			allowed.f,
			allowed.entityId,
			'2026-11-24',
			'20:00'
		);
		expect(rejected).toEqual({ ok: false, error: 'ENTITY_MAX_CONSECUTIVE' });
	});

	it('se as faltas non contan, a non presentación non penaliza ao responsable', async () => {
		const { db, f, entityId } = await setup({ noShowsCount: false });
		const r = await bookAsClub(db, f, entityId, '2026-11-20', '12:00');
		if (!r.ok) throw new Error(r.error);
		const marked = await markNoShow(db, {
			municipalityId: f.municipalityId,
			bookingId: r.value.id,
			now: at('2026-11-20', '12:30')
		});
		expect(marked.ok).toBe(true);
		const [profile] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.profileId));
		expect(profile.penaltyUntil).toBeNull();
	});

	it('a axenda do conserxe amosa o nome do club', async () => {
		const { db, f, entityId } = await setup();
		expect((await bookAsClub(db, f, entityId, '2026-11-24', '18:00')).ok).toBe(true);
		const agenda = await getAgenda(db, f.municipalityId, '2026-11-24');
		const entries = agenda.flatMap((facility) => facility.bookings);
		expect(entries.some((entry) => entry.entityName === 'CD Ribadávila')).toBe(true);
	});

	it('engadir responsable só no propio concello', async () => {
		const { db, f, adminId, entityId } = await setup({}, false);
		expect(
			await addEntityMember(db, f.otherMunicipalityId, entityId, f.userId, adminId)
		).toBeFalsy();
		expect(await addEntityMember(db, f.municipalityId, entityId, f.userId, adminId)).toBeTruthy();
		expect((await bookAsClub(db, f, entityId, '2026-11-24', '18:00')).ok).toBe(true);
	});
});
