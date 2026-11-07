// SPDX-License-Identifier: EUPL-1.2
// Mostrador v1 (tarefa 1): DNI só como hash, empadroamento verificado, tarifa social e
// cancelación do persoal con motivo.
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import {
	bookings,
	facilities,
	municipalityProfiles,
	notifications,
	outboxEmails,
	users
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { setResidency } from './admin';
import { cancelBooking, createBooking } from './bookings';
import { seedFixture, type Fixture } from './fixtures';
import {
	createLocalPerson,
	ensureProfileForStaff,
	findPersonByDni,
	setSocialTariff,
	verifyResidency
} from './staff';

const SECRET = 'clave-dni-de-proba';
const now = new Date('2026-10-21T10:00:00Z');
const at = (date: string, hhmm: string) => localDateTimeToUtc(date, hhmm);

let db: Db;
let f: Fixture;
let staffUserId: string;
let xoan: { profileId: string; userId: string };

beforeAll(async () => {
	db = await createTestDb();
	f = await seedFixture(db);
	const [staff] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'fixture-desk', displayName: 'Roi Conserxe' })
		.returning();
	staffUserId = staff.id;
	const created = await createLocalPerson(
		db,
		f.municipalityId,
		{ displayName: 'Hadrián Seixo Mouriño', phone: '600 000 001', dni: ' 34987654-p ' },
		SECRET
	);
	if (!created.ok) throw new Error(created.error);
	xoan = created.value;
});

const book = async (profileId: string, date: string, hhmm: string) => {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId,
		startsAt: at(date, hhmm),
		channel: 'phone',
		createdByUserId: staffUserId,
		now
	});
	if (!r.ok) throw new Error(r.error);
	return r.value;
};

const profileOf = async (id: string) =>
	(await db.select().from(municipalityProfiles).where(eq(municipalityProfiles.id, id)))[0];

describe('findPersonByDni', () => {
	it('o DNI enteiro (con espazos, guións ou minúsculas) atopa a persoa do concello', async () => {
		const r = await findPersonByDni(db, f.municipalityId, '34987654 p', SECRET);
		expect(r).toEqual({
			status: 'found',
			person: {
				userId: xoan.userId,
				displayName: 'Hadrián Seixo Mouriño',
				profileId: xoan.profileId,
				isResident: false,
				socialTariff: null
			}
		});
	});

	it('un anaco do DNI é invalid e non atopa nada', async () => {
		expect(await findPersonByDni(db, f.municipalityId, '3498765', SECRET)).toEqual({
			status: 'invalid'
		});
		expect(await findPersonByDni(db, f.municipalityId, '34987654', SECRET)).toEqual({
			status: 'invalid'
		});
	});

	it('un DNI válido descoñecido é not_found', async () => {
		const r = await findPersonByDni(db, f.municipalityId, '12345678Z', SECRET);
		expect(r).toEqual({ status: 'not_found', suggestions: [] });
	});

	it('cunha letra que non cadra, not_found con suxestións aritméticas', async () => {
		const r = await findPersonByDni(db, f.municipalityId, '34987645P', SECRET);
		expect(r.status).toBe('not_found');
		expect(r.status === 'not_found' && r.suggestions).toContain('34987654P');
	});

	it('con outra clave non atopa (é un HMAC, non un hash simple)', async () => {
		const r = await findPersonByDni(db, f.municipalityId, '34987654P', 'outra-clave');
		expect(r.status).toBe('not_found');
	});

	it('noutro concello sen perfil: sen perfil e sen o nome completo', async () => {
		const r = await findPersonByDni(db, f.otherMunicipalityId, '34987654P', SECRET);
		expect(r.status).toBe('found');
		if (r.status !== 'found') return;
		expect(r.person.profileId).toBeNull();
		expect(r.person.isResident).toBe(false);
		expect(r.person.displayName).not.toBe('Hadrián Seixo Mouriño');
		expect(r.person.displayName).not.toContain('Rodríguez');
	});

	it('a táboa users non garda o DNI en claro en ningunha columna', async () => {
		const rows = await db.select().from(users);
		const dump = JSON.stringify(rows);
		expect(dump).not.toContain('34987654');
		const [row] = rows.filter((u) => u.id === xoan.userId);
		expect(row.dniHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('un DNI non válido no alta é un erro de programación', async () => {
		await expect(
			createLocalPerson(db, f.municipalityId, { displayName: 'X', phone: '', dni: '1234' }, SECRET)
		).rejects.toThrow();
		await expect(
			createLocalPerson(db, f.municipalityId, { displayName: 'X', phone: '', dni: '12345678Z' })
		).rejects.toThrow();
	});
});

describe('DNI xa rexistrado e perfil noutro concello', () => {
	it('createLocalPerson cun DNI doutra persoa é DNI_EXISTS, sen 500 nin restos', async () => {
		const before = (await db.select().from(users)).length;
		const r = await createLocalPerson(
			db,
			f.municipalityId,
			{ displayName: 'Outra Persoa', phone: '', dni: '34987654P' },
			SECRET
		);
		expect(r).toEqual({ ok: false, error: 'DNI_EXISTS' });
		expect((await db.select().from(users)).length).toBe(before);
	});

	it('ensureProfileForStaff crea un perfil non empadroado se falta, e non duplica', async () => {
		const first = await ensureProfileForStaff(db, f.otherMunicipalityId, xoan.userId);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const p = await profileOf(first.value.profileId);
		expect(p).toMatchObject({
			municipalityId: f.otherMunicipalityId,
			userId: xoan.userId,
			isResident: false,
			socialTariff: null
		});
		const again = await ensureProfileForStaff(db, f.otherMunicipalityId, xoan.userId);
		expect(again.ok && again.value.profileId).toBe(first.value.profileId);
		const found = await findPersonByDni(db, f.otherMunicipalityId, '34987654P', SECRET);
		expect(found).toMatchObject({
			status: 'found',
			person: { profileId: first.value.profileId, displayName: 'Hadrián Seixo Mouriño' }
		});
		// Limpa: o resto das probas esperan Xoán sen perfil alí.
		await db.delete(municipalityProfiles).where(eq(municipalityProfiles.id, first.value.profileId));
	});

	it('ensureProfileForStaff cun usuario que non existe é NOT_FOUND', async () => {
		expect(
			await ensureProfileForStaff(db, f.municipalityId, '00000000-0000-4000-8000-000000000000')
		).toEqual({ ok: false, error: 'NOT_FOUND' });
	});
});

describe('tarifa social', () => {
	it('unha reserva feita despois de setSocialTariff(maior) custa o prezo social; a anterior consérvase', async () => {
		await db
			.update(facilities)
			.set({ priceSocialCents: 100 })
			.where(eq(facilities.id, f.facilityId));
		const before = await book(xoan.profileId, '2026-10-23', '10:00');
		expect(before.priceCents).toBe(600);

		const set = await setSocialTariff(db, f.municipalityId, xoan.profileId, 'maior');
		expect(set.ok).toBe(true);
		expect((await profileOf(xoan.profileId)).socialTariff).toBe('maior');

		const after = await book(xoan.profileId, '2026-10-23', '11:00');
		expect(after.priceCents).toBe(100);
		const [kept] = await db.select().from(bookings).where(eq(bookings.id, before.id));
		expect(kept.priceCents).toBe(600);

		const found = await findPersonByDni(db, f.municipalityId, '34987654P', SECRET);
		expect(found.status === 'found' && found.person.socialTariff).toBe('maior');
	});

	it('null quita a tarifa; outro concello é NOT_FOUND', async () => {
		expect((await setSocialTariff(db, f.otherMunicipalityId, xoan.profileId, 'xove')).ok).toBe(
			false
		);
		await setSocialTariff(db, f.municipalityId, xoan.profileId, null);
		expect((await profileOf(xoan.profileId)).socialTariff).toBeNull();
		await db
			.update(facilities)
			.set({ priceSocialCents: null })
			.where(eq(facilities.id, f.facilityId));
	});

	it('o prezo social non pode ser negativo', async () => {
		await expect(
			db.update(facilities).set({ priceSocialCents: -1 }).where(eq(facilities.id, f.facilityId))
		).rejects.toThrow();
	});
});

describe('verifyResidency', () => {
	const residencyNotices = (userId: string) =>
		db
			.select()
			.from(notifications)
			.where(and(eq(notifications.userId, userId), eq(notifications.kind, 'residency_verified')));

	it('marca empadroado, quen e cando, e crea un só aviso residency_verified', async () => {
		const r = await verifyResidency(db, f.municipalityId, xoan.profileId, staffUserId, now);
		expect(r.ok).toBe(true);
		const p = await profileOf(xoan.profileId);
		expect(p.isResident).toBe(true);
		expect(p.residencyVerifiedAt).toEqual(now);
		expect(p.residencyVerifiedBy).toBe(staffUserId);
		// Repetir non volve avisar.
		await verifyResidency(db, f.municipalityId, xoan.profileId, staffUserId, now);
		const rows = await residencyNotices(xoan.userId);
		expect(rows).toHaveLength(1);
		expect(rows[0].municipalityId).toBe(f.municipalityId);
		expect(rows[0].bookingId).toBeNull();
	});

	it('a seguinte reserva xa leva o prezo de empadroado', async () => {
		const b = await book(xoan.profileId, '2026-10-23', '12:00');
		expect(b.priceCents).toBe(300);
	});

	it('a quen xa estaba empadroado só se lle anota a verificación, sen aviso', async () => {
		const [p] = await db
			.select({ userId: municipalityProfiles.userId })
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.residentProfileId));
		const r = await verifyResidency(db, f.municipalityId, f.residentProfileId, staffUserId, now);
		expect(r.ok).toBe(true);
		const after = await profileOf(f.residentProfileId);
		expect(after.isResident).toBe(true);
		expect(after.residencyVerifiedAt).toEqual(now);
		expect(after.residencyVerifiedBy).toBe(staffUserId);
		expect(await residencyNotices(p.userId)).toHaveLength(0);
	});

	it('perfil doutro concello é NOT_FOUND e non avisa', async () => {
		const r = await verifyResidency(db, f.otherMunicipalityId, f.profileId, staffUserId, now);
		expect(r.ok).toBe(false);
		expect(await residencyNotices(f.userId)).toHaveLength(0);
	});

	it('setResidency (admin) tamén rexistra a verificación; quitala limpa os campos', async () => {
		const on = await setResidency(db, f.municipalityId, f.profileId, true, {
			userId: staffUserId,
			now
		});
		expect(on.ok).toBe(true);
		let p = await profileOf(f.profileId);
		expect(p.residencyVerifiedAt).toEqual(now);
		expect(p.residencyVerifiedBy).toBe(staffUserId);
		expect(await residencyNotices(f.userId)).toHaveLength(1);
		await setResidency(db, f.municipalityId, f.profileId, false, { userId: staffUserId, now });
		p = await profileOf(f.profileId);
		expect(p.isResident).toBe(false);
		expect(p.residencyVerifiedAt).toBeNull();
		expect(p.residencyVerifiedBy).toBeNull();
	});
});

describe('cancelación do persoal con motivo', () => {
	it('sen motivo, ou con máis de 200 caracteres, é VALIDATION_FAILED e non cancela', async () => {
		const b = await book(f.residentProfileId, '2026-10-24', '10:00');
		const base = { municipalityId: f.municipalityId, bookingId: b.id, byStaff: true, now };
		for (const reason of [undefined, '', '   ', 'x'.repeat(201)]) {
			const r = await cancelBooking(db, { ...base, reason });
			expect(r).toEqual({ ok: false, error: 'VALIDATION_FAILED' });
		}
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
		expect(row.status).toBe('confirmed');
	});

	it('co motivo, o aviso o leva e o corpo do correo non; non conta como ausencia', async () => {
		const [resident] = await db
			.select({ userId: municipalityProfiles.userId })
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.residentProfileId));
		await db
			.update(users)
			.set({ email: 'brais@example.org', notifyEmail: true, notifyConsentAt: now })
			.where(eq(users.id, resident.userId));
		const b = await book(f.residentProfileId, '2026-10-24', '12:00');
		const before = await profileOf(f.residentProfileId);
		// Xa empezada: fóra de prazo para a veciña, pero o persoal pode.
		const late = new Date(b.startsAt.getTime() + 10 * 60_000);
		const r = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: true,
			reason: '  Avaría na iluminación  ',
			now: late
		});
		expect(r.ok && r.value.status).toBe('cancelled');
		const rows = await db
			.select()
			.from(notifications)
			.where(and(eq(notifications.bookingId, b.id), eq(notifications.kind, 'cancelled_by_staff')));
		expect(rows).toHaveLength(1);
		expect(rows[0].params.reason).toBe('Avaría na iluminación');
		const mails = await db
			.select()
			.from(outboxEmails)
			.where(eq(outboxEmails.toAddress, 'brais@example.org'));
		expect(mails.length).toBeGreaterThan(0);
		for (const m of mails) expect(m.body).not.toContain('Avaría');
		const afterProfile = await profileOf(f.residentProfileId);
		expect(afterProfile.noShowCount).toBe(before.noShowCount);
		expect(afterProfile.penaltyUntil).toEqual(before.penaltyUntil);
	});

	it('a veciña segue cancelando sen motivo', async () => {
		const b = await book(f.residentProfileId, '2026-10-24', '14:00');
		const r = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: false,
			now
		});
		expect(r.ok).toBe(true);
	});
});
