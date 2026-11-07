// SPDX-License-Identifier: EUPL-1.2
// Datos ficticios para pruebas: sin dependencias de vitest.
import type { Db } from '../db/client';
import {
	facilities,
	facilityTypes,
	municipalities,
	municipalityProfiles,
	openingHours,
	users
} from '../db/schema';
import type { BookingMode } from '../domain/types';

export type Fixture = {
	municipalityId: string;
	otherMunicipalityId: string;
	typeId: string;
	facilityId: string;
	otherFacilityId: string;
	profileId: string;
	residentProfileId: string;
	userId: string;
};

export const FIXTURE_PRICES = { priceResidentCents: 300, priceNonResidentCents: 600 } as const;

const WEEK = [0, 1, 2, 3, 4, 5, 6];

/**
 * Ribadávila (instalación principal, perfiles) y Montemaior do Río (otra instalación).
 * Horario de luns a domingo de 09:00 a 22:00, franjas de 60 min.
 */
export async function seedFixture(
	db: Db,
	opts: { bookingMode?: BookingMode; units?: number; capacity?: number } = {}
): Promise<Fixture> {
	const [riba, monte] = await db
		.insert(municipalities)
		.values([
			{ slug: 'ribadavila', name: 'Ribadávila', province: 'Ourense', primaryColor: '#1d4ed8' },
			{
				slug: 'montemaior-do-rio',
				name: 'Montemaior do Río',
				province: 'Lugo',
				primaryColor: '#047857'
			}
		])
		.returning();

	const [user, residentUser] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'fixture-user', displayName: 'Nerea Veciña' },
			{ provider: 'local', subject: 'fixture-resident', displayName: 'Telmo Empadroado' }
		])
		.returning();

	const [type, otherType] = await db
		.insert(facilityTypes)
		.values([
			{
				municipalityId: riba.id,
				nameGl: 'Pista de pádel',
				nameEs: 'Pista de pádel',
				mascot: 'padel',
				color: '#1d4ed8',
				bookingMode: opts.bookingMode ?? 'slot'
			},
			{
				municipalityId: monte.id,
				nameGl: 'Pista de pádel',
				nameEs: 'Pista de pádel',
				mascot: 'padel',
				color: '#047857',
				bookingMode: 'slot'
			}
		])
		.returning();

	const [facility, otherFacility] = await db
		.insert(facilities)
		.values([
			{
				municipalityId: riba.id,
				typeId: type.id,
				name: 'Pista 1',
				units: opts.units ?? 1,
				capacity: opts.capacity ?? 1,
				slotMinutes: 60,
				...FIXTURE_PRICES
			},
			{
				municipalityId: monte.id,
				typeId: otherType.id,
				name: 'Pista central',
				slotMinutes: 60,
				...FIXTURE_PRICES
			}
		])
		.returning();

	await db
		.insert(openingHours)
		.values(
			[facility, otherFacility].flatMap((f) =>
				WEEK.map((weekday) => ({ facilityId: f.id, weekday, opens: '09:00', closes: '22:00' }))
			)
		);

	const [profile, residentProfile] = await db
		.insert(municipalityProfiles)
		.values([
			{
				municipalityId: riba.id,
				userId: user.id,
				isResident: false,
				rulesAcceptedAt: new Date('2026-01-01')
			},
			{
				municipalityId: riba.id,
				userId: residentUser.id,
				isResident: true,
				rulesAcceptedAt: new Date('2026-01-01')
			}
		])
		.returning();

	return {
		municipalityId: riba.id,
		otherMunicipalityId: monte.id,
		typeId: type.id,
		facilityId: facility.id,
		otherFacilityId: otherFacility.id,
		profileId: profile.id,
		residentProfileId: residentProfile.id,
		userId: user.id
	};
}
