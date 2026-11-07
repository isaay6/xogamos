// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../../lib/server/db/test-db';
import type { Db } from '../../../../lib/server/db/client';
import {
	bookings,
	closures,
	municipalityProfiles,
	passes,
	passTypes,
	staffRoles,
	users
} from '../../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../../lib/server/services/fixtures';
import { makeEvent } from '../../../../lib/server/http/test-event';
import { load } from './+page.server';
import type { monthlyReport } from '../../../../lib/server/services/monthly-report';

const NOW = new Date('2026-11-20T10:00:00+01:00');
let db: Db;
let fx: Fixture;
let admin: { id: string; displayName: string };
let conserxe: { id: string; displayName: string };

const event = (user: typeof admin | null, slug = 'ribadavila') =>
	makeEvent({
		db,
		now: NOW,
		user,
		params: { slug },
		url: `http://localhost/${slug}/admin/informe?mes=2026-10`
	}) as never;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	[admin, conserxe] = await db
		.insert(users)
		.values([
			{ provider: 'local', subject: 'report-admin', displayName: 'Admin Informe' },
			{ provider: 'local', subject: 'report-cons', displayName: 'Conserxe Informe' }
		])
		.returning({ id: users.id, displayName: users.displayName });
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
	await db
		.update(municipalityProfiles)
		.set({ socialTariff: 'maior' })
		.where(eq(municipalityProfiles.id, fx.residentProfileId));
	const makeBooking = (
		profileId: string,
		date: string,
		hour: number,
		status: 'confirmed' | 'cancelled' | 'no_show'
	) => ({
		municipalityId: fx.municipalityId,
		facilityId: fx.facilityId,
		profileId,
		startsAt: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+02:00`),
		endsAt: new Date(`${date}T${String(hour + 1).padStart(2, '0')}:00:00+02:00`),
		status,
		accessCode: `${100000 + hour}`,
		priceCents: 300,
		channel: 'online' as const,
		createdByUserId: admin.id
	});
	await db
		.insert(bookings)
		.values([
			makeBooking(fx.residentProfileId, '2026-09-15', 10, 'confirmed'),
			makeBooking(fx.residentProfileId, '2026-10-10', 10, 'confirmed'),
			makeBooking(fx.profileId, '2026-10-11', 11, 'no_show'),
			makeBooking(fx.residentProfileId, '2026-10-12', 10, 'confirmed'),
			makeBooking(fx.profileId, '2026-10-13', 12, 'cancelled')
		]);
	await db.insert(closures).values({
		facilityId: fx.facilityId,
		startsAt: new Date('2026-10-20T09:00:00+02:00'),
		endsAt: new Date('2026-10-20T12:00:00+02:00'),
		reason: 'Mantemento ficticio'
	});
	const [passType] = await db
		.insert(passTypes)
		.values({
			municipalityId: fx.municipalityId,
			facilityTypeId: fx.typeId,
			name: 'Bono ficticio',
			days: 30,
			priceCents: 1000
		})
		.returning();
	await db.insert(passes).values({
		passTypeId: passType.id,
		profileId: fx.residentProfileId,
		startsOn: '2026-10-01',
		endsOn: '2026-10-31',
		pin: '1234',
		priceCents: 1000,
		createdBy: admin.id,
		createdAt: new Date('2026-10-03T10:00:00+02:00')
	});
});

describe('admin: informe mensual', () => {
	it('calcula as cifras dun mes sementado e o texto automático', async () => {
		const data = (await load(event(admin))) as {
			report: Awaited<ReturnType<typeof monthlyReport>>;
		};
		expect(data.report.figures).toMatchObject({
			bookings: 3,
			people: 2,
			occupancy: 0.008,
			noShows: 1,
			cancellations: 1,
			residents: 2,
			nonResidents: 1,
			passes: 1,
			socialTariffBookings: 2
		});
		expect(data.report.closures).toEqual([{ name: 'Pista 1', reason: 'Mantemento ficticio' }]);
		expect(data.report.summary).toBe('En outubro houbo 3 reservas, un 200 % máis ca en setembro.');
	});

	it('compara as reservas e a ocupación co mes anterior', async () => {
		const data = (await load(event(admin))) as {
			report: Awaited<ReturnType<typeof monthlyReport>>;
		};
		expect(data.report.comparison.bookings).toBe(200);
		expect(data.report.comparison.occupancy).toBeGreaterThan(0);
	});

	it('é só de administración e non revela outro concello', async () => {
		await expect(load(event(conserxe))).rejects.toMatchObject({ status: 403 });
		await expect(load(event(admin, 'montemaior-do-rio'))).rejects.toMatchObject({ status: 404 });
	});
});
