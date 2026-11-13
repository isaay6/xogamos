// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
	bookings,
	entities,
	entityMembers,
	requests,
	sessions,
	staffRoles,
	users,
	walletMovements,
	wallets
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { deleteAccount } from './account-deletion';
import { createBooking } from './bookings';
import { seedFixture } from './fixtures';

const bookedAt = new Date('2026-10-21T10:00:00Z');
const DATE = '2026-10-22';
const at = (hhmm: string) => localDateTimeToUtc(DATE, hhmm);
// O borrado faise ás 15:00 do día da reserva: a das 12:00 xa pasou e a das 18:00 aínda non.
const deletedAt = at('15:00');

async function setup() {
	const db = await createTestDb();
	const f = await seedFixture(db);
	await db
		.update(users)
		.set({ email: 'nome@exemplo.gal', phone: '600000000', dniHash: 'hash-ficticio' })
		.where(eq(users.id, f.userId));
	return { db, f };
}

async function book(
	db: Awaited<ReturnType<typeof createTestDb>>,
	f: Awaited<ReturnType<typeof seedFixture>>,
	hhmm: string
) {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at(hhmm),
		channel: 'phone',
		createdByUserId: f.userId,
		now: bookedAt
	});
	if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
	return r.value;
}

describe('deleteAccount', () => {
	it('anonimiza a persoa, cancela as reservas futuras e conserva as pasadas', async () => {
		const { db, f } = await setup();
		const past = await book(db, f, '12:00');
		const future = await book(db, f, '18:00');
		await db
			.insert(sessions)
			.values({ id: 'hash-sesion', userId: f.userId, expiresAt: at('23:00') });
		await db.insert(requests).values({
			municipalityId: f.municipalityId,
			userId: f.userId,
			kind: 'evento',
			fromDate: '2026-11-01',
			toDate: '2026-11-01',
			startsTime: '10:00',
			endsTime: '12:00',
			title: 'Aniversario de Nome Ficticio',
			description: 'Chamar a Nome',
			phone: '611111111'
		});
		const before = await db.select().from(bookings);

		const r = await deleteAccount(db, f.userId, deletedAt);
		expect(r.ok).toBe(true);

		const [user] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(user.displayName).toBe('Conta eliminada');
		expect(user.email).toBeNull();
		expect(user.phone).toBeNull();
		expect(user.dniHash).toBeNull();
		expect(user.subject).toBe(`deleted:${f.userId}`);
		expect(await db.select().from(sessions).where(eq(sessions.userId, f.userId))).toHaveLength(0);

		const after = await db.select().from(bookings);
		expect(after).toHaveLength(before.length);
		const byId = (id: string) => after.find((b) => b.id === id)!;
		expect(byId(past.id).status).toBe('confirmed');
		expect(byId(future.id).status).not.toBe('confirmed');

		const [request] = await db.select().from(requests).where(eq(requests.userId, f.userId));
		expect(request.status).toBe('retirada');
		expect(request.title).toBe('Solicitude anonimizada');
		expect(request.description).toBe('');
		expect(request.phone).toBe('');
	});

	it('rexeita o borrado do persoal municipal', async () => {
		const { db, f } = await setup();
		await db
			.insert(staffRoles)
			.values({ userId: f.userId, municipalityId: f.municipalityId, role: 'conserxe' });
		const r = await deleteAccount(db, f.userId, deletedAt);
		expect(r).toEqual({ ok: false, error: 'STAFF_MEMBER' });
	});

	it('rexeita o borrado da única responsable dun club', async () => {
		const { db, f } = await setup();
		const [club] = await db
			.insert(entities)
			.values({ municipalityId: f.municipalityId, name: 'Club Ficticio', shortName: 'CF' })
			.returning();
		await db.insert(entityMembers).values({ entityId: club.id, userId: f.userId });
		const r = await deleteAccount(db, f.userId, deletedAt);
		expect(r).toEqual({ ok: false, error: 'SOLE_ENTITY_RESPONSIBLE' });
	});

	it('rexeita o borrado con saldo no monedeiro', async () => {
		const { db, f } = await setup();
		const [wallet] = await db.insert(wallets).values({ userId: f.userId }).returning();
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: 500,
			kind: 'recarga_tarxeta',
			municipalityId: f.municipalityId,
			reference: 'proba'
		});
		const r = await deleteAccount(db, f.userId, deletedAt);
		expect(r).toEqual({ ok: false, error: 'WALLET_BALANCE' });
		const [user] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(user.email).toBe('nome@exemplo.gal');
	});
});
