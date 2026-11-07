// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	facilityTypes,
	municipalityProfiles,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { eq } from 'drizzle-orm';
import { GET as exportIcs } from './m/[slug]/admin/export.ics/+server';

const NOW = new Date('2026-11-20T10:00:00+01:00');
type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserje: U;
let code = 0;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const row = (
	municipalityId: string,
	facilityId: string,
	profileId: string,
	startsAt: string,
	extra: { status?: 'confirmed' | 'cancelled'; unitIndex?: number } = {}
) => ({
	municipalityId,
	facilityId,
	profileId,
	startsAt: new Date(startsAt),
	endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
	status: extra.status ?? ('confirmed' as const),
	unitIndex: extra.unitIndex ?? null,
	accessCode: String(400000 + ++code),
	priceCents: 300,
	channel: 'online' as const,
	createdByUserId: fx.userId
});

const get = (user: U | null, locale: 'gl' | 'es' = 'gl') =>
	exportIcs(
		makeEvent({ db, now: NOW, user, params: { slug: 'ribadavila' }, locale }) as never
	) as Promise<Response>;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Admin Ribadávila');
	conserje = await mkUser('conserje', 'Conserxe Ribadávila');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
	const [other] = await db
		.insert(municipalityProfiles)
		.values({ municipalityId: fx.otherMunicipalityId, userId: fx.userId, isResident: true })
		.returning();
	await db.insert(bookings).values([
		row(fx.municipalityId, fx.facilityId, fx.profileId, '2026-11-24T10:00:00+01:00'),
		row(fx.municipalityId, fx.facilityId, fx.profileId, '2026-11-25T11:00:00+01:00', {
			unitIndex: 1
		}),
		row(fx.municipalityId, fx.facilityId, fx.profileId, '2026-11-26T12:00:00+01:00', {
			status: 'cancelled'
		}),
		row(fx.municipalityId, fx.facilityId, fx.profileId, '2026-10-01T12:00:00+01:00'),
		row(fx.otherMunicipalityId, fx.otherFacilityId, other.id, '2026-11-24T13:00:00+01:00')
	]);
});

describe('GET admin/export.ics', () => {
	it('sen sesión 401 e conserxe 403', async () => {
		expect((await get(null)).status).toBe(401);
		expect((await get(conserje)).status).toBe(403);
	});

	it('admin: calendario do concello sen datos persoais', async () => {
		const res = await get(admin);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/calendar');
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.headers.get('content-disposition')).toBe(
			'attachment; filename="ribadavila-calendario-2026-11-20.ics"'
		);
		const body = await res.text();
		expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
		expect(body).toContain('SUMMARY:Pista 1\r\n');
		expect(body).toContain('SUMMARY:Pista 1 · Pista 2');
		expect(body).not.toContain('rúa/unidade');
		expect(body).not.toContain('Nerea');
		expect(body).not.toContain('Veciña');
		expect(body).not.toContain('Pista central'); // outro concello
		expect(body).not.toContain('20261126'); // cancelada
		expect(body).not.toContain('20261001'); // anterior a 30 días
	});

	it('Ruling 8: a unidade leva o substantivo do personaxe e do idioma', async () => {
		await db
			.update(facilityTypes)
			.set({ mascot: 'natacion' })
			.where(eq(facilityTypes.id, fx.typeId));
		expect(await (await get(admin)).text()).toContain('SUMMARY:Pista 1 · Rúa 2');
		expect(await (await get(admin, 'es')).text()).toContain('SUMMARY:Pista 1 · Calle 2');
		await db.update(facilityTypes).set({ mascot: 'sala' }).where(eq(facilityTypes.id, fx.typeId));
		expect(await (await get(admin)).text()).toContain('SUMMARY:Pista 1 · Sala 2');
	});
});
