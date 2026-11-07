// SPDX-License-Identifier: EUPL-1.2
// Inscricións de torneos: a fila do torneo queda bloqueada para contar e ocupar a última praza.
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	facilities,
	facilityTypes,
	municipalityProfiles,
	tournamentEntries,
	tournaments,
	users
} from '../db/schema';
import { localDateTimeToUtc } from '../domain/time';
import { writeActivity } from './activity-log';
import { notify } from './notifications';
import { err, ok, type Result } from './result';
import { payWalletTx, refundWalletTx } from './wallet';

export type TournamentError =
	| 'NOT_FOUND'
	| 'TOURNAMENT_CANCELLED'
	| 'SIGNUP_CLOSED'
	| 'FULL'
	| 'ALREADY_SIGNED_UP'
	| 'INSUFFICIENT_WALLET_BALANCE'
	| 'FEE_LOCKED'
	| 'MAX_BELOW_ENTRIES'
	| 'DEADLINE_INVALID';

function validDeadline(input: TournamentInput) {
	return (
		!Number.isNaN(input.signupDeadline.getTime()) &&
		input.signupDeadline < localDateTimeToUtc(input.startsOn, '00:00')
	);
}

export type TournamentInput = {
	title: string;
	sportDescription: string;
	startsOn: string;
	endsOn: string;
	description?: string;
	rules?: string;
	format: 'individual' | 'parellas' | 'equipos';
	teamSize?: number | null;
	maxEntries: number;
	signupDeadline: Date;
	feeCents?: number;
	facilityId: string;
	requestId?: string | null;
	entityId?: string | null;
};

export async function listUpcomingTournaments(db: Db, municipalityId: string, now: Date) {
	return db
		.select({
			tournament: tournaments,
			facilityName: facilities.name,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			entries: sql<number>`(select count(*) from ${tournamentEntries} where ${tournamentEntries.tournamentId} = ${tournaments.id} and ${tournamentEntries.cancelledAt} is null)`
		})
		.from(tournaments)
		.innerJoin(facilities, eq(facilities.id, tournaments.facilityId))
		.innerJoin(facilityTypes, eq(facilityTypes.id, facilities.typeId))
		.where(
			and(
				eq(tournaments.municipalityId, municipalityId),
				eq(tournaments.status, 'publicado'),
				gt(tournaments.signupDeadline, now)
			)
		)
		.orderBy(asc(tournaments.startsOn));
}

export async function getTournament(db: Db, municipalityId: string, id: string) {
	const [row] = await db
		.select({
			tournament: tournaments,
			facilityName: facilities.name,
			mascot: facilityTypes.mascot,
			color: facilityTypes.color,
			entries: sql<number>`count(${tournamentEntries.id})`
		})
		.from(tournaments)
		.innerJoin(facilities, eq(facilities.id, tournaments.facilityId))
		.innerJoin(facilityTypes, eq(facilityTypes.id, facilities.typeId))
		.leftJoin(
			tournamentEntries,
			and(eq(tournamentEntries.tournamentId, tournaments.id), isNull(tournamentEntries.cancelledAt))
		)
		.where(and(eq(tournaments.id, id), eq(tournaments.municipalityId, municipalityId)))
		.groupBy(tournaments.id, facilities.id, facilityTypes.id);
	return row ?? null;
}

export async function createTournament(
	db: Db,
	municipalityId: string,
	actorId: string,
	input: TournamentInput
) {
	if (
		!input.title.trim() ||
		!input.sportDescription.trim() ||
		input.endsOn < input.startsOn ||
		input.maxEntries < 1 ||
		(input.feeCents ?? 0) < 0
	)
		return err('NOT_FOUND' as const);
	if (!validDeadline(input)) return err('DEADLINE_INVALID' as const);
	const [facility] = await db
		.select({ id: facilities.id })
		.from(facilities)
		.where(and(eq(facilities.id, input.facilityId), eq(facilities.municipalityId, municipalityId)));
	if (!facility) return err('NOT_FOUND' as const);
	return db.transaction(async (tx) => {
		const [tournament] = await tx
			.insert(tournaments)
			.values({
				...input,
				title: input.title.trim(),
				sportDescription: input.sportDescription.trim(),
				description: input.description?.trim() ?? '',
				rules: input.rules?.trim() ?? '',
				municipalityId,
				createdBy: actorId,
				feeCents: input.feeCents ?? 0,
				requestId: input.requestId ?? null,
				entityId: input.entityId ?? null,
				teamSize: input.teamSize ?? null
			})
			.returning();
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'tournament_saved',
			params: { detalle: tournament.title }
		});
		const followers = await tx
			.select({ userId: municipalityProfiles.userId })
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.municipalityId, municipalityId),
					eq(municipalityProfiles.followed, true)
				)
			);
		for (const follower of followers) {
			await notify(tx, {
				userId: follower.userId,
				municipalityId,
				kind: 'tournament_published',
				tournamentId: tournament.id,
				params: { tournamentTitle: tournament.title, facilityName: '' }
			});
		}
		return ok(tournament);
	});
}

export async function updateTournament(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	input: TournamentInput
) {
	if (
		!input.title.trim() ||
		!input.sportDescription.trim() ||
		input.endsOn < input.startsOn ||
		input.maxEntries < 1 ||
		(input.feeCents ?? 0) < 0
	)
		return err('NOT_FOUND' as const);
	if (!validDeadline(input)) return err('DEADLINE_INVALID' as const);
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ feeCents: tournaments.feeCents, maxEntries: tournaments.maxEntries })
			.from(tournaments)
			.where(and(eq(tournaments.id, id), eq(tournaments.municipalityId, municipalityId)))
			.for('update');
		if (!current) return err('NOT_FOUND' as const);
		const [facility] = await tx
			.select({ id: facilities.id })
			.from(facilities)
			.where(
				and(eq(facilities.id, input.facilityId), eq(facilities.municipalityId, municipalityId))
			);
		if (!facility) return err('NOT_FOUND' as const);
		const [{ count }] = await tx
			.select({ count: sql<number>`count(*)` })
			.from(tournamentEntries)
			.where(and(eq(tournamentEntries.tournamentId, id), isNull(tournamentEntries.cancelledAt)));
		if (Number(count) > input.maxEntries) return err('MAX_BELOW_ENTRIES' as const);
		if (current.feeCents !== (input.feeCents ?? 0)) {
			const [entry] = await tx
				.select({ id: tournamentEntries.id })
				.from(tournamentEntries)
				.where(and(eq(tournamentEntries.tournamentId, id), isNull(tournamentEntries.cancelledAt)));
			if (entry) return err('FEE_LOCKED' as const);
		}
		const [saved] = await tx
			.update(tournaments)
			.set({
				title: input.title.trim(),
				sportDescription: input.sportDescription.trim(),
				startsOn: input.startsOn,
				endsOn: input.endsOn,
				description: input.description?.trim() ?? '',
				rules: input.rules?.trim() ?? '',
				format: input.format,
				teamSize: input.teamSize ?? null,
				maxEntries: input.maxEntries,
				signupDeadline: input.signupDeadline,
				feeCents: input.feeCents ?? 0,
				facilityId: input.facilityId
			})
			.where(and(eq(tournaments.id, id), eq(tournaments.municipalityId, municipalityId)))
			.returning();
		if (!saved) return err('NOT_FOUND' as const);
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'tournament_saved',
			params: { detalle: saved.title }
		});
		return ok(saved);
	});
}

export async function signUpTournament(
	db: Db,
	municipalityId: string,
	userId: string,
	id: string,
	input: {
		teamName?: string | null;
		members?: string | null;
		paidWith?: 'monedero' | 'instalacion';
	},
	now: Date
): Promise<Result<typeof tournamentEntries.$inferSelect, TournamentError>> {
	return db.transaction(async (tx) => {
		const [tournament] = await tx
			.select()
			.from(tournaments)
			.where(and(eq(tournaments.id, id), eq(tournaments.municipalityId, municipalityId)))
			.for('update');
		if (!tournament) return err('NOT_FOUND');
		if (tournament.status !== 'publicado') return err('TOURNAMENT_CANCELLED');
		if (now >= tournament.signupDeadline) return err('SIGNUP_CLOSED');
		const [existing] = await tx
			.select({ id: tournamentEntries.id })
			.from(tournamentEntries)
			.where(
				and(
					eq(tournamentEntries.tournamentId, id),
					eq(tournamentEntries.userId, userId),
					isNull(tournamentEntries.cancelledAt)
				)
			);
		if (existing) return err('ALREADY_SIGNED_UP');
		const [{ count }] = await tx
			.select({ count: sql<number>`count(*)` })
			.from(tournamentEntries)
			.where(and(eq(tournamentEntries.tournamentId, id), isNull(tournamentEntries.cancelledAt)));
		if (Number(count) >= tournament.maxEntries) return err('FULL');
		if (tournament.feeCents > 0 && input.paidWith === 'monedero') {
			const payment = await payWalletTx(tx, {
				userId,
				municipalityId,
				amountCents: tournament.feeCents,
				reference: `tournament:${id}`,
				now
			});
			if (!payment.ok) return err('INSUFFICIENT_WALLET_BALANCE');
		}
		const [entry] = await tx
			.insert(tournamentEntries)
			.values({
				tournamentId: id,
				userId,
				teamName: input.teamName?.trim() || null,
				members: input.members?.trim() || null,
				paidWith: tournament.feeCents > 0 ? (input.paidWith ?? 'instalacion') : null,
				paidCents:
					tournament.feeCents > 0 && input.paidWith === 'monedero' ? tournament.feeCents : 0,
				createdAt: now
			})
			.returning();
		return ok(entry);
	});
}

export async function cancelTournamentEntry(
	db: Db,
	municipalityId: string,
	userId: string,
	id: string,
	now: Date
): Promise<Result<true, TournamentError>> {
	return db.transaction(async (tx) => {
		const [entry] = await tx
			.select({ entry: tournamentEntries, tournament: tournaments })
			.from(tournamentEntries)
			.innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
			.where(
				and(
					eq(tournamentEntries.id, id),
					eq(tournamentEntries.userId, userId),
					eq(tournaments.municipalityId, municipalityId),
					isNull(tournamentEntries.cancelledAt)
				)
			)
			.for('update');
		if (!entry) return err('NOT_FOUND');
		if (now >= entry.tournament.signupDeadline) return err('SIGNUP_CLOSED');
		await tx
			.update(tournamentEntries)
			.set({ cancelledAt: now })
			.where(eq(tournamentEntries.id, entry.entry.id));
		if (entry.entry.paidWith === 'monedero' && entry.entry.paidCents > 0)
			await refundWalletTx(tx, {
				userId,
				municipalityId,
				amountCents: entry.entry.paidCents,
				reference: `tournament-refund:${entry.entry.id}`,
				now
			});
		return ok(true);
	});
}

export async function cancelTournament(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	now: Date
) {
	return db.transaction(async (tx) => {
		const [tournament] = await tx
			.select()
			.from(tournaments)
			.where(and(eq(tournaments.id, id), eq(tournaments.municipalityId, municipalityId)))
			.for('update');
		if (!tournament) return err('NOT_FOUND' as const);
		const entries = await tx
			.select()
			.from(tournamentEntries)
			.where(and(eq(tournamentEntries.tournamentId, id), isNull(tournamentEntries.cancelledAt)));
		await tx.update(tournaments).set({ status: 'cancelado' }).where(eq(tournaments.id, id));
		for (const entry of entries) {
			await tx
				.update(tournamentEntries)
				.set({ cancelledAt: now })
				.where(eq(tournamentEntries.id, entry.id));
			if (entry.paidWith === 'monedero' && entry.paidCents > 0)
				await refundWalletTx(tx, {
					userId: entry.userId,
					municipalityId,
					amountCents: entry.paidCents,
					reference: `tournament-cancel:${entry.id}`,
					now
				});
			await notify(tx, {
				userId: entry.userId,
				municipalityId,
				kind: 'tournament_cancelled',
				tournamentId: tournament.id,
				params: { tournamentTitle: tournament.title, facilityName: '' }
			});
		}
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'tournament_saved',
			params: { detalle: `${tournament.title}: cancelado` }
		});
		return ok(true);
	});
}

export function listTournamentEntries(db: Db, municipalityId: string, tournamentId: string) {
	return db
		.select({ entry: tournamentEntries, userName: users.displayName })
		.from(tournamentEntries)
		.innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
		.innerJoin(users, eq(users.id, tournamentEntries.userId))
		.where(and(eq(tournaments.id, tournamentId), eq(tournaments.municipalityId, municipalityId)))
		.orderBy(asc(tournamentEntries.createdAt));
}

export function listMyTournamentEntries(db: Db, municipalityId: string, userId: string) {
	return db
		.select({
			id: tournamentEntries.id,
			cancelledAt: tournamentEntries.cancelledAt,
			tournamentId: tournaments.id,
			title: tournaments.title,
			startsOn: tournaments.startsOn,
			endsOn: tournaments.endsOn,
			facilityName: facilities.name
		})
		.from(tournamentEntries)
		.innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
		.innerJoin(facilities, eq(facilities.id, tournaments.facilityId))
		.where(
			and(eq(tournamentEntries.userId, userId), eq(tournaments.municipalityId, municipalityId))
		)
		.orderBy(asc(tournaments.startsOn));
}
