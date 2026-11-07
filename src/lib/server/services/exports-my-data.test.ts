// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { users, walletMovements, wallets } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { exportMyData } from './exports';
import { seedFixture } from './fixtures';

describe('exportMyData', () => {
	it('incluye el saldo y solo los movimientos de la persona', async () => {
		const db = await createTestDb();
		const f = await seedFixture(db);
		const [otherUser] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'other-wallet-user', displayName: 'Outra persoa' })
			.returning();
		const [mine, other] = await db
			.insert(wallets)
			.values([{ userId: f.userId }, { userId: otherUser.id }])
			.returning();
		await db.insert(walletMovements).values([
			{ walletId: mine.id, amountCents: 1200, kind: 'axuste', reference: 'mine' },
			{ walletId: other.id, amountCents: 900, kind: 'axuste', reference: 'other' }
		]);
		const data = await exportMyData(db, f.userId);
		expect(data.wallet.balanceCents).toBe(1200);
		expect(data.wallet.movements.map((movement) => movement.reference)).toEqual(['mine']);
	});
});
