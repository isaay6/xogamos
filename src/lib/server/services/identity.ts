// SPDX-License-Identifier: EUPL-1.2
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import type { Tx } from './bookings';

export type UserRow = typeof users.$inferSelect;

export async function upsertIdentity(
	db: Db | Tx,
	identity: {
		provider: 'clave' | 'chave365';
		subject: string;
		displayName: string;
		email: string | null;
	}
): Promise<UserRow> {
	const [row] = await db
		.insert(users)
		.values(identity)
		.onConflictDoUpdate({
			target: [users.provider, users.subject],
			// Sen correo na identidade consérvase o que a persoa escribiu (avisos por correo).
			set: {
				displayName: identity.displayName,
				email: sql`coalesce(excluded.email, "users"."email")`
			}
		})
		.returning();
	return row;
}
