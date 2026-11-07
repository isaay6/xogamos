// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import {
	bookings,
	facilityTypes,
	municipalityProfiles,
	passes,
	passTypes,
	users
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from './fixtures';
import {
	completeOnboarding,
	declareResidency,
	followMunicipalities,
	getProfile,
	joinMunicipality,
	leaveMunicipality,
	listFollowed
} from './profiles';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
});

const profileOf = async (municipalityId: string, userId: string) => {
	const [row] = await db
		.select()
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.municipalityId, municipalityId),
				eq(municipalityProfiles.userId, userId)
			)
		);
	return row;
};

describe('followMunicipalities', () => {
	it('alterna followed sin borrar un perfil con reservas', async () => {
		// El perfil de la fixture ya existe (followed por defecto); creamos una reserva en él.
		await db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			unitIndex: 1,
			seats: 1,
			startsAt: new Date('2030-01-07T10:00:00Z'),
			endsAt: new Date('2030-01-07T11:00:00Z'),
			status: 'confirmed',
			accessCode: '1234',
			priceCents: 600,
			channel: 'online',
			createdByUserId: fx.userId
		});
		await followMunicipalities(db, fx.userId, [fx.otherMunicipalityId]);
		const kept = await profileOf(fx.municipalityId, fx.userId);
		expect(kept).toBeDefined();
		expect(kept.followed).toBe(false);
		const created = await profileOf(fx.otherMunicipalityId, fx.userId);
		expect(created.followed).toBe(true);
		expect(created.isResident).toBe(false);
		expect((await listFollowed(db, fx.userId)).map((m) => m.municipalityId)).toEqual([
			fx.otherMunicipalityId
		]);

		await followMunicipalities(db, fx.userId, [fx.municipalityId, fx.otherMunicipalityId]);
		expect((await profileOf(fx.municipalityId, fx.userId)).followed).toBe(true);
		expect(await listFollowed(db, fx.userId)).toHaveLength(2);
	});
});

describe('followMunicipalities con ids inválidos', () => {
	it('UNKNOWN_MUNICIPALITY si algún id no existe, sin tocar nada', async () => {
		const before = await listFollowed(db, fx.userId);
		const r = await followMunicipalities(db, fx.userId, [
			fx.municipalityId,
			'00000000-0000-4000-8000-000000000000'
		]);
		expect(r).toEqual({ ok: false, error: 'UNKNOWN_MUNICIPALITY' });
		expect(await listFollowed(db, fx.userId)).toEqual(before);
	});
});

describe('unirse e deixar concellos', () => {
	it('unirse reutiliza o perfil e deixar conserva o historial cando non hai impedimentos', async () => {
		const joined = await joinMunicipality(db, fx.userId, fx.otherMunicipalityId);
		expect(joined).toEqual({ ok: true, value: undefined });
		const profile = await profileOf(fx.otherMunicipalityId, fx.userId);
		if (!profile) throw new Error('Perfil non creado');
		expect(profile).toMatchObject({ followed: true, isResident: false });
		const left = await leaveMunicipality(
			db,
			fx.userId,
			fx.otherMunicipalityId,
			new Date('2026-11-25T09:00:00Z')
		);
		expect(left).toEqual({ ok: true, value: undefined });
		expect(await profileOf(fx.otherMunicipalityId, fx.userId)).toMatchObject({
			id: profile.id,
			followed: false
		});
	});

	it('non deixa un concello con reserva futura ou abono activo', async () => {
		await joinMunicipality(db, fx.userId, fx.otherMunicipalityId);
		const profile = await profileOf(fx.otherMunicipalityId, fx.userId);
		if (!profile) throw new Error('Perfil non creado');
		const now = new Date('2026-11-25T09:00:00Z');
		const [future] = await db
			.insert(bookings)
			.values({
				municipalityId: fx.otherMunicipalityId,
				facilityId: fx.otherFacilityId,
				profileId: profile.id,
				seats: 1,
				startsAt: new Date('2026-11-26T10:00:00Z'),
				endsAt: new Date('2026-11-26T11:00:00Z'),
				accessCode: '654321',
				priceCents: 600,
				channel: 'online',
				createdByUserId: fx.userId
			})
			.returning();
		expect(await leaveMunicipality(db, fx.userId, fx.otherMunicipalityId, now)).toEqual({
			ok: false,
			error: 'FUTURE_BOOKINGS'
		});
		await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, future.id));
		const [type] = await db
			.select({ id: facilityTypes.id })
			.from(facilityTypes)
			.where(eq(facilityTypes.municipalityId, fx.otherMunicipalityId));
		if (!type) throw new Error('Tipo de instalación non creado');
		const [passType] = await db
			.insert(passTypes)
			.values({
				municipalityId: fx.otherMunicipalityId,
				facilityTypeId: type.id,
				name: 'Mensual',
				days: 30,
				priceCents: 1000
			})
			.returning();
		if (!passType) throw new Error('Tipo de abono non creado');
		await db.insert(passes).values({
			passTypeId: passType.id,
			profileId: profile.id,
			startsOn: '2026-11-20',
			endsOn: '2026-12-19',
			pin: '1234',
			priceCents: 1000,
			createdBy: fx.userId
		});
		expect(await leaveMunicipality(db, fx.userId, fx.otherMunicipalityId, now)).toEqual({
			ok: false,
			error: 'ACTIVE_PASS'
		});
	});
});

describe('declareResidency', () => {
	it('marca residency_declared_at y deja is_resident en false', async () => {
		const now = new Date('2026-10-23T10:00:00Z');
		await declareResidency(db, fx.userId, fx.otherMunicipalityId, now);
		const p = await profileOf(fx.otherMunicipalityId, fx.userId);
		expect(p.residencyDeclaredAt).toEqual(now);
		expect(p.isResident).toBe(false);
		expect((await getProfile(db, fx.otherMunicipalityId, fx.userId))?.isResident).toBe(false);
	});

	it('no cambia el estado verificado de un perfil ya empadronado', async () => {
		const [resident] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, fx.residentProfileId));
		await declareResidency(db, resident.userId, fx.municipalityId, new Date());
		expect((await profileOf(fx.municipalityId, resident.userId)).isResident).toBe(true);
	});
});

describe('completeOnboarding', () => {
	it('fija onboarded_at una sola vez', async () => {
		const first = new Date('2026-10-23T10:00:00Z');
		await completeOnboarding(db, fx.userId, first);
		await completeOnboarding(db, fx.userId, new Date('2026-11-01T10:00:00Z'));
		const [u] = await db.select().from(users).where(eq(users.id, fx.userId));
		expect(u.onboardedAt).toEqual(first);
	});
});
