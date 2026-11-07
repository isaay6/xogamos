// SPDX-License-Identifier: EUPL-1.2
import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedFixture } from '../services/fixtures';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	municipalities,
	municipalityProfiles,
	openingHours,
	users
} from './schema';
import { createTestDb } from './test-db';

type PgErr = { code?: string; constraint?: string };

// Devuelve el error de Postgres (drizzle lo envuelve en .cause) o null si no falla.
async function pgError(p: PromiseLike<unknown>): Promise<PgErr | null> {
	return Promise.resolve(p).then(
		() => null,
		(e: { cause?: unknown }) => (e.cause ?? e) as PgErr
	);
}

describe('schema', () => {
	it('applies migrations', async () => {
		const db = await createTestDb();
		const [row] = await db.select({ n: count() }).from(municipalities);
		expect(row.n).toBe(0);
	});

	it('profile unique per municipality', async () => {
		const db = await createTestDb();
		const [m] = await db
			.insert(municipalities)
			.values({
				slug: 'ribadavila',
				name: 'Ribadávila',
				province: 'Ourense',
				primaryColor: '#1d4ed8'
			})
			.returning();
		const [u] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'u1', displayName: 'Ana' })
			.returning();
		const row = { municipalityId: m.id, userId: u.id, isResident: true };
		await db.insert(municipalityProfiles).values(row); // first insert must succeed
		const err = await db
			.insert(municipalityProfiles)
			.values(row)
			.then(
				() => null,
				(e: unknown) => e as { code?: string; constraint?: string; cause?: unknown }
			);
		expect(err).not.toBeNull();
		const cause = (err?.cause ?? err) as { code?: string; constraint?: string };
		expect(cause.code).toBe('23505');
		expect(cause.constraint).toBe('profiles_municipality_user_unique');
	});

	describe('integrity constraints', () => {
		const at = (iso: string) => new Date(iso);
		const bookingValues = (f: Awaited<ReturnType<typeof seedFixture>>) => ({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('2026-10-22T16:00:00Z'),
			endsAt: at('2026-10-22T17:00:00Z'),
			accessCode: '123456',
			priceCents: 600,
			channel: 'online' as const,
			createdByUserId: f.userId
		});

		it('accepts a consistent booking', async () => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			expect(await pgError(db.insert(bookings).values(bookingValues(f)))).toBeNull();
		});

		it('rejects a booking whose municipality differs from its facility', async () => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			// Perfil válido en Montemaior: solo falla la FK compuesta de la instalación.
			const [otherProfile] = await db
				.insert(municipalityProfiles)
				.values({ municipalityId: f.otherMunicipalityId, userId: f.userId })
				.returning();
			const err = await pgError(
				db.insert(bookings).values({
					...bookingValues(f),
					municipalityId: f.otherMunicipalityId,
					profileId: otherProfile.id
				})
			);
			expect(err?.code).toBe('23503');
			expect(err?.constraint).toBe('bookings_facility_municipality_fk');
		});

		it('rejects a booking whose profile belongs to another municipality', async () => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const [otherProfile] = await db
				.insert(municipalityProfiles)
				.values({ municipalityId: f.otherMunicipalityId, userId: f.userId })
				.returning();
			const err = await pgError(
				db.insert(bookings).values({ ...bookingValues(f), profileId: otherProfile.id })
			);
			expect(err?.code).toBe('23503');
			expect(err?.constraint).toBe('bookings_profile_municipality_fk');
		});

		it.each([
			[
				'ends_at <= starts_at',
				{ endsAt: at('2026-10-22T16:00:00Z') },
				'bookings_ends_after_starts'
			],
			['seats < 1', { seats: 0 }, 'bookings_seats_positive']
		])('rejects booking with %s', async (_label, patch, constraint) => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const err = await pgError(db.insert(bookings).values({ ...bookingValues(f), ...patch }));
			expect(err?.code).toBe('23514');
			expect(err?.constraint).toBe(constraint);
		});

		it('rejects a facility whose type belongs to another municipality', async () => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const [otherType] = await db
				.select({ id: facilityTypes.id })
				.from(facilityTypes)
				.where(eq(facilityTypes.municipalityId, f.otherMunicipalityId));
			const err = await pgError(
				db.insert(facilities).values({
					municipalityId: f.municipalityId,
					typeId: otherType.id,
					name: 'Pista allea',
					priceResidentCents: 0,
					priceNonResidentCents: 0
				})
			);
			expect(err?.code).toBe('23503');
			expect(err?.constraint).toBe('facilities_type_municipality_fk');
		});

		it.each([
			[
				'closes before opens',
				{ opens: '21:00', closes: '09:00' },
				'opening_hours_closes_after_opens'
			],
			[
				'closes equal to opens',
				{ opens: '09:00', closes: '09:00' },
				'opening_hours_closes_after_opens'
			],
			['malformed opens', { opens: '0900', closes: '21:00' }, 'opening_hours_opens_format'],
			['out-of-range closes', { opens: '09:00', closes: '24:00' }, 'opening_hours_closes_format']
		])('rejects opening hours with %s', async (_label, hours, constraint) => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const err = await pgError(
				db.insert(openingHours).values({ facilityId: f.facilityId, weekday: 0, ...hours })
			);
			expect(err?.code).toBe('23514');
			expect(err?.constraint).toBe(constraint);
		});

		it('rejects a closure that does not end after it starts', async () => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const err = await pgError(
				db.insert(closures).values({
					facilityId: f.facilityId,
					startsAt: at('2026-10-22T16:00:00Z'),
					endsAt: at('2026-10-22T16:00:00Z')
				})
			);
			expect(err?.code).toBe('23514');
			expect(err?.constraint).toBe('closures_ends_after_starts');
		});

		it.each([
			['slot_minutes = 0', { slotMinutes: 0 }, 'facilities_slot_minutes_positive'],
			['units = 0', { units: 0 }, 'facilities_units_positive'],
			['capacity = 0', { capacity: 0 }, 'facilities_capacity_positive'],
			[
				'negative resident price',
				{ priceResidentCents: -1 },
				'facilities_price_resident_non_negative'
			],
			[
				'negative non-resident price',
				{ priceNonResidentCents: -1 },
				'facilities_price_non_resident_non_negative'
			]
		])('rejects facility with %s', async (_label, patch, constraint) => {
			const db = await createTestDb();
			const f = await seedFixture(db);
			const err = await pgError(
				db.update(facilities).set(patch).where(eq(facilities.id, f.facilityId))
			);
			expect(err?.code).toBe('23514');
			expect(err?.constraint).toBe(constraint);
		});
	});
});
