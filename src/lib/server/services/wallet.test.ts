// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { seedFixture, type Fixture } from './fixtures';
import {
	hashRechargeCode,
	issueRechargeCard,
	mobileTopUp,
	newRechargeCode,
	redeemRechargeCard,
	walletBalance,
	walletSummary
} from './wallet';

let db: Db;
let fx: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
});

describe('monedero', () => {
	it('emite códigos legibles, no guarda el código y suma el libro mayor', async () => {
		const now = new Date('2030-01-01T10:00:00Z');
		const issued = await issueRechargeCard(db, {
			municipalityId: fx.municipalityId,
			issuedBy: fx.userId,
			amountCents: 2000,
			now
		});
		expect(issued.code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){2}$/);
		expect(issued.card.codeHash).toBe(hashRechargeCode(issued.code));
		const redeemed = await redeemRechargeCard(db, { userId: fx.userId, code: issued.code, now });
		expect(redeemed).toMatchObject({ ok: true, value: { amountCents: 2000, balanceCents: 2000 } });
		expect(await walletBalance(db, fx.userId)).toBe(2000);
		expect((await walletSummary(db, fx.userId)).movements).toHaveLength(1);
	});

	it('no permite canjear dos veces la misma tarjeta', async () => {
		const issued = await issueRechargeCard(db, {
			municipalityId: fx.municipalityId,
			issuedBy: fx.userId,
			amountCents: 1000,
			now: new Date('2030-01-02T10:00:00Z')
		});
		expect(
			(await redeemRechargeCard(db, { userId: fx.userId, code: issued.code, now: new Date() })).ok
		).toBe(true);
		expect(
			await redeemRechargeCard(db, { userId: fx.userId, code: issued.code, now: new Date() })
		).toEqual({
			ok: false,
			error: 'CARD_USED'
		});
	});

	it('serializa dos canjes concurrentes de la misma tarjeta', async () => {
		const issued = await issueRechargeCard(db, {
			municipalityId: fx.municipalityId,
			issuedBy: fx.userId,
			amountCents: 5000,
			now: new Date('2030-01-03T10:00:00Z')
		});
		const results = await Promise.all([
			redeemRechargeCard(db, { userId: fx.userId, code: issued.code, now: new Date() }),
			redeemRechargeCard(db, { userId: fx.userId, code: issued.code, now: new Date() })
		]);
		expect(results.filter((result) => result.ok)).toHaveLength(1);
		expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: 'CARD_USED' }]);
	});

	it('normaliza el código antes de compararlo', async () => {
		const code = newRechargeCode(() => new Uint8Array(12).fill(1));
		expect(hashRechargeCode(code)).toBe(hashRechargeCode(code.toLowerCase().replaceAll('-', ' ')));
		expect(code).not.toContain('O');
		expect(code).not.toContain('I');
	});

	it('una recarga móvil repetida con la misma clave solo acredita una vez', async () => {
		let charges = 0;
		const provider = {
			async charge(input: { amountCents: number; reference: string; idempotencyKey: string }) {
				charges++;
				return { reference: `provider:${input.idempotencyKey}` };
			}
		};
		const input = {
			userId: fx.userId,
			municipalityId: fx.municipalityId,
			amountCents: 1000,
			idempotencyKey: 'topup-retry-key',
			now: new Date('2030-01-04T10:00:00Z'),
			provider
		};
		const before = await walletBalance(db, fx.userId);
		expect((await mobileTopUp(db, input)).ok).toBe(true);
		expect((await mobileTopUp(db, input)).ok).toBe(true);
		expect(charges).toBe(1);
		expect(await walletBalance(db, fx.userId)).toBe(before + 1000);
	});
});
