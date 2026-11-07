// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
	municipalityProfiles,
	tournamentEntries,
	tournaments,
	walletMovements,
	wallets
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { seedFixture } from './fixtures';
import {
	cancelTournament,
	cancelTournamentEntry,
	signUpTournament,
	updateTournament
} from './tournaments';

const NOW = new Date('2026-11-24T08:00:00.000Z');

async function setup(maxEntries = 2, feeCents = 0) {
	const db = await createTestDb();
	const f = await seedFixture(db);
	const profiles = await db
		.select()
		.from(municipalityProfiles)
		.where(eq(municipalityProfiles.municipalityId, f.municipalityId));
	const [tournament] = await db
		.insert(tournaments)
		.values({
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			title: 'Torneo de proba',
			sportDescription: 'Pádel',
			startsOn: '2026-12-10',
			endsOn: '2026-12-11',
			format: 'individual',
			maxEntries,
			signupDeadline: new Date('2026-12-01T12:00:00.000Z'),
			feeCents,
			createdBy: f.userId
		})
		.returning();
	return { db, f, tournament, first: profiles[0].userId, second: profiles[1].userId };
}

/** Código de erro dun Result fallido (ou undefined se saíu ben). */
const errorOf = (r: { ok: boolean; error?: unknown }) => (r.ok ? undefined : r.error);

describe('tournaments', () => {
	it('inscribe ata completar as prazas e rexeita a seguinte', async () => {
		const { db, f, tournament, first, second } = await setup(1);
		expect((await signUpTournament(db, f.municipalityId, first, tournament.id, {}, NOW)).ok).toBe(
			true
		);
		expect(
			errorOf(await signUpTournament(db, f.municipalityId, second, tournament.id, {}, NOW))
		).toBe('FULL');
	});

	it('só deixa unha inscrición concorrente na última praza', async () => {
		const { db, f, tournament, first, second } = await setup(1);
		const results = await Promise.all([
			signUpTournament(db, f.municipalityId, first, tournament.id, {}, NOW),
			signUpTournament(db, f.municipalityId, second, tournament.id, {}, NOW)
		]);
		expect(results.filter((result) => result.ok)).toHaveLength(1);
	});

	it('non deixa inscribirse despois da data límite', async () => {
		const { db, f, tournament, first } = await setup();
		expect(
			errorOf(
				await signUpTournament(
					db,
					f.municipalityId,
					first,
					tournament.id,
					{},
					new Date('2026-12-01T12:00:00.000Z')
				)
			)
		).toBe('SIGNUP_CLOSED');
	});

	it('mantén unha única inscrición activa por persoa', async () => {
		const { db, f, tournament, first } = await setup();
		expect((await signUpTournament(db, f.municipalityId, first, tournament.id, {}, NOW)).ok).toBe(
			true
		);
		expect(
			errorOf(await signUpTournament(db, f.municipalityId, first, tournament.id, {}, NOW))
		).toBe('ALREADY_SIGNED_UP');
	});

	it('cobra do monedero e devolve ao cancelar antes do límite', async () => {
		const { db, f, tournament, first } = await setup(2, 300);
		const [wallet] = await db.insert(wallets).values({ userId: first }).returning();
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: 500,
			kind: 'recarga_mobil',
			reference: 'test',
			createdAt: NOW
		});
		const signed = await signUpTournament(
			db,
			f.municipalityId,
			first,
			tournament.id,
			{ paidWith: 'monedero' },
			NOW
		);
		expect(signed.ok).toBe(true);
		if (!signed.ok) return;
		expect(
			(
				await db.select().from(walletMovements).where(eq(walletMovements.walletId, wallet.id))
			).reduce((sum, movement) => sum + movement.amountCents, 0)
		).toBe(200);
		expect(
			(await cancelTournamentEntry(db, f.municipalityId, first, signed.value.id, NOW)).ok
		).toBe(true);
		expect(
			(
				await db.select().from(walletMovements).where(eq(walletMovements.walletId, wallet.id))
			).reduce((sum, movement) => sum + movement.amountCents, 0)
		).toBe(500);
	});

	it('bloquea o cambio de prezo con inscricións e devolve o importe que se cobrou', async () => {
		const { db, f, tournament, first } = await setup(2, 300);
		const [wallet] = await db.insert(wallets).values({ userId: first }).returning();
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: 500,
			kind: 'recarga_mobil',
			reference: 'test',
			createdAt: NOW
		});
		const signed = await signUpTournament(
			db,
			f.municipalityId,
			first,
			tournament.id,
			{ paidWith: 'monedero' },
			NOW
		);
		expect(signed.ok).toBe(true);
		expect(
			await updateTournament(db, f.municipalityId, f.userId, tournament.id, {
				title: tournament.title,
				sportDescription: tournament.sportDescription,
				startsOn: tournament.startsOn,
				endsOn: tournament.endsOn,
				format: tournament.format,
				maxEntries: tournament.maxEntries,
				signupDeadline: tournament.signupDeadline,
				feeCents: 900,
				facilityId: tournament.facilityId
			})
		).toEqual({ ok: false, error: 'FEE_LOCKED' });
		if (!signed.ok) return;
		await db.update(tournaments).set({ feeCents: 900 }).where(eq(tournaments.id, tournament.id));
		expect(
			(await cancelTournamentEntry(db, f.municipalityId, first, signed.value.id, NOW)).ok
		).toBe(true);
		expect(
			(
				await db.select().from(walletMovements).where(eq(walletMovements.walletId, wallet.id))
			).reduce((sum, movement) => sum + movement.amountCents, 0)
		).toBe(500);
	});

	it('non deixa baixar as prazas por debaixo das inscricións activas', async () => {
		const { db, f, tournament, first, second } = await setup(2);
		await signUpTournament(db, f.municipalityId, first, tournament.id, {}, NOW);
		await signUpTournament(db, f.municipalityId, second, tournament.id, {}, NOW);
		expect(
			await updateTournament(db, f.municipalityId, f.userId, tournament.id, {
				...tournament,
				maxEntries: 1
			})
		).toEqual({ ok: false, error: 'MAX_BELOW_ENTRIES' });
	});

	it('rexeita unha data límite inválida ou posterior ao inicio', async () => {
		const { db, f, tournament } = await setup();
		expect(
			await updateTournament(db, f.municipalityId, f.userId, tournament.id, {
				...tournament,
				signupDeadline: new Date('2026-12-10T00:00:00.000Z')
			})
		).toEqual({ ok: false, error: 'DEADLINE_INVALID' });
	});

	it('cancelar o torneo avisa e devolve as inscricións de monedero', async () => {
		const { db, f, tournament, first } = await setup(2, 300);
		const [wallet] = await db.insert(wallets).values({ userId: first }).returning();
		await db.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: 300,
			kind: 'recarga_mobil',
			reference: 'test',
			createdAt: NOW
		});
		await signUpTournament(
			db,
			f.municipalityId,
			first,
			tournament.id,
			{ paidWith: 'monedero' },
			NOW
		);
		await db.update(tournaments).set({ feeCents: 900 }).where(eq(tournaments.id, tournament.id));
		expect((await cancelTournament(db, f.municipalityId, f.userId, tournament.id, NOW)).ok).toBe(
			true
		);
		expect(
			(
				await db
					.select()
					.from(tournamentEntries)
					.where(eq(tournamentEntries.tournamentId, tournament.id))
			)[0].cancelledAt
		).not.toBeNull();
		expect(
			(
				await db.select().from(walletMovements).where(eq(walletMovements.walletId, wallet.id))
			).reduce((sum, movement) => sum + movement.amountCents, 0)
		).toBe(300);
	});

	it('illa os torneos doutro concello', async () => {
		const { db, f, tournament, first } = await setup();
		const result = await signUpTournament(db, f.otherMunicipalityId, first, tournament.id, {}, NOW);
		expect(errorOf(result)).toBe('NOT_FOUND');
		expect(
			await db
				.select()
				.from(tournamentEntries)
				.where(
					and(
						eq(tournamentEntries.tournamentId, tournament.id),
						eq(tournamentEntries.userId, first)
					)
				)
		).toHaveLength(0);
	});
});
