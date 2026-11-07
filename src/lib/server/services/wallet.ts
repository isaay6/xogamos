// SPDX-License-Identifier: EUPL-1.2
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rechargeCards, walletMovements, wallets } from '../db/schema';
import type { Tx } from './bookings';
import { err, ok, type Result } from './result';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CARD_AMOUNT = new Set([1000, 2000, 5000]);

export type WalletKind =
	'recarga_tarxeta' | 'recarga_mobil' | 'pago_reserva' | 'pago_abono' | 'devolucion' | 'axuste';

/** Código curto, sen 0/O/1/I, para que se poida ler no mostrador. */
export function newRechargeCode(random: (size: number) => Uint8Array = randomBytes): string {
	let raw = '';
	for (const byte of random(12)) raw += ALPHABET[byte % ALPHABET.length];
	return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeRechargeCode(code: string) {
	return code.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

export function hashRechargeCode(code: string) {
	return createHash('sha256').update(normalizeRechargeCode(code)).digest('hex');
}

async function lockedWallet(tx: Tx, userId: string) {
	await tx.insert(wallets).values({ userId }).onConflictDoNothing();
	const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
	if (!wallet) throw new Error('wallet was not created');
	return wallet;
}

export async function walletBalance(q: Db | Tx, userId: string): Promise<number> {
	const [row] = await q
		.select({ balance: sql<number>`coalesce(sum(${walletMovements.amountCents}), 0)` })
		.from(wallets)
		.leftJoin(walletMovements, eq(walletMovements.walletId, wallets.id))
		.where(eq(wallets.userId, userId));
	return Number(row?.balance ?? 0);
}

export async function walletSummary(db: Db, userId: string) {
	const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
	if (!wallet) return { balanceCents: 0, movements: [] as (typeof walletMovements.$inferSelect)[] };
	const movements = await db
		.select()
		.from(walletMovements)
		.where(eq(walletMovements.walletId, wallet.id))
		.orderBy(desc(walletMovements.createdAt));
	return { balanceCents: movements.reduce((sum, row) => sum + row.amountCents, 0), movements };
}

/** Cobra desde unha carteira bloqueada. Nunca deixa un saldo negativo. */
export async function payWalletTx(
	tx: Tx,
	input: {
		userId: string;
		municipalityId: string;
		amountCents: number;
		reference: string;
		now: Date;
	}
): Promise<Result<{ balanceCents: number }, 'INSUFFICIENT_WALLET_BALANCE'>> {
	const wallet = await lockedWallet(tx, input.userId);
	const balanceCents = await walletBalance(tx, input.userId);
	if (balanceCents < input.amountCents) return err('INSUFFICIENT_WALLET_BALANCE');
	await tx.insert(walletMovements).values({
		walletId: wallet.id,
		amountCents: -input.amountCents,
		kind: input.reference.startsWith('pass:') ? 'pago_abono' : 'pago_reserva',
		municipalityId: input.municipalityId,
		reference: input.reference,
		createdAt: input.now
	});
	return ok({ balanceCents: balanceCents - input.amountCents });
}

export async function refundWalletTx(
	tx: Tx,
	input: {
		userId: string;
		municipalityId: string;
		amountCents: number;
		reference: string;
		now: Date;
	}
) {
	const wallet = await lockedWallet(tx, input.userId);
	await tx.insert(walletMovements).values({
		walletId: wallet.id,
		amountCents: input.amountCents,
		kind: 'devolucion',
		municipalityId: input.municipalityId,
		reference: input.reference,
		createdAt: input.now
	});
}

export interface PaymentProvider {
	charge(input: {
		amountCents: number;
		reference: string;
		idempotencyKey: string;
	}): Promise<{ reference: string }>;
}

/** Pasarela só para a demostración; unha pasarela real implementará a mesma interface. */
export const simulatedPaymentProvider: PaymentProvider = {
	async charge(input) {
		return { reference: `simulated:${input.reference}:${input.amountCents}` };
	}
};

export async function mobileTopUp(
	db: Db,
	input: {
		userId: string;
		municipalityId: string;
		amountCents: number;
		idempotencyKey: string;
		now: Date;
		provider: PaymentProvider;
	}
) {
	if (![1000, 2000, 5000].includes(input.amountCents)) return err('INVALID_AMOUNT' as const);
	const [existing] = await db
		.select({ walletId: walletMovements.walletId })
		.from(walletMovements)
		.where(eq(walletMovements.idempotencyKey, input.idempotencyKey));
	if (existing) return ok({ balanceCents: await walletBalance(db, input.userId) });
	const payment = await input.provider.charge({
		amountCents: input.amountCents,
		reference: input.userId,
		idempotencyKey: input.idempotencyKey
	});
	return db.transaction(async (tx) => {
		// Serializa reintentos simultáneos de la misma persona antes de volver a mirar la clave.
		const wallet = await lockedWallet(tx, input.userId);
		const [previous] = await tx
			.select({ walletId: walletMovements.walletId })
			.from(walletMovements)
			.where(eq(walletMovements.idempotencyKey, input.idempotencyKey));
		if (previous) return ok({ balanceCents: await walletBalance(tx, input.userId) });
		await tx.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: input.amountCents,
			kind: 'recarga_mobil',
			municipalityId: input.municipalityId,
			reference: payment.reference,
			idempotencyKey: input.idempotencyKey,
			createdAt: input.now
		});
		return ok({ balanceCents: await walletBalance(tx, input.userId) });
	});
}

export async function issueRechargeCard(
	db: Db,
	input: { municipalityId: string; issuedBy: string; amountCents: number; now: Date }
): Promise<{ code: string; card: typeof rechargeCards.$inferSelect }> {
	if (!CARD_AMOUNT.has(input.amountCents)) throw new Error('invalid recharge card amount');
	for (let attempts = 0; attempts < 5; attempts++) {
		const code = newRechargeCode();
		try {
			const [card] = await db
				.insert(rechargeCards)
				.values({
					municipalityId: input.municipalityId,
					issuedBy: input.issuedBy,
					amountCents: input.amountCents,
					codeHash: hashRechargeCode(code),
					issuedAt: input.now
				})
				.returning();
			return { code, card };
		} catch (cause) {
			if (attempts === 4) throw cause;
		}
	}
	throw new Error('unreachable');
}

export async function listRechargeCards(db: Db, municipalityId: string) {
	return db
		.select({
			id: rechargeCards.id,
			amountCents: rechargeCards.amountCents,
			issuedAt: rechargeCards.issuedAt,
			usedAt: rechargeCards.usedAt,
			usedByWalletId: rechargeCards.usedByWalletId
		})
		.from(rechargeCards)
		.where(eq(rechargeCards.municipalityId, municipalityId))
		.orderBy(desc(rechargeCards.issuedAt));
}

/** Rescata unha tarxeta unha soa vez: a fila da tarxeta e a carteira quedan bloqueadas. */
export async function redeemRechargeCard(
	db: Db,
	input: { userId: string; code: string; now: Date }
): Promise<Result<{ amountCents: number; balanceCents: number }, 'INVALID_CARD' | 'CARD_USED'>> {
	const hash = hashRechargeCode(input.code);
	return db.transaction(async (tx) => {
		const [card] = await tx
			.select()
			.from(rechargeCards)
			.where(eq(rechargeCards.codeHash, hash))
			.for('update');
		if (!card) return err('INVALID_CARD');
		if (card.usedAt) return err('CARD_USED');
		const wallet = await lockedWallet(tx, input.userId);
		await tx
			.update(rechargeCards)
			.set({ usedAt: input.now, usedByWalletId: wallet.id })
			.where(and(eq(rechargeCards.id, card.id), sql`${rechargeCards.usedAt} is null`));
		await tx.insert(walletMovements).values({
			walletId: wallet.id,
			amountCents: card.amountCents,
			kind: 'recarga_tarxeta',
			municipalityId: card.municipalityId,
			reference: card.id,
			createdAt: input.now
		});
		const balanceCents = await walletBalance(tx, input.userId);
		return ok({ amountCents: card.amountCents, balanceCents });
	});
}
