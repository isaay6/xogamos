// SPDX-License-Identifier: EUPL-1.2
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from './schema';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Copia de drizzle/ con só as migracións ata `lastTag` (incluída) no diario. */
function migrationsUpTo(lastTag: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'migr-'));
	dirs.push(dir);
	cpSync('drizzle', dir, { recursive: true });
	const path = join(dir, 'meta', '_journal.json');
	const journal = JSON.parse(readFileSync(path, 'utf8')) as { entries: { tag: string }[] };
	const at = journal.entries.findIndex((e) => e.tag === lastTag);
	journal.entries = journal.entries.slice(0, at + 1);
	writeFileSync(path, JSON.stringify(journal));
	return dir;
}

describe('0008_onboarded_backfill', () => {
	it('dá por feita a benvida de quen existía; quen chega despois aínda a fai', async () => {
		const db = drizzle(new PGlite(), { schema });
		await migrate(db, { migrationsFolder: migrationsUpTo('0007_profile_v1') });
		// SQL a man: o esquema actual ten columnas que a base en 0007 aínda non ten.
		const inserted = await db.execute<{ id: string; onboarded_at: Date | null }>(
			sql`insert into users (provider, subject, display_name)
				values ('clave', 'ANTES', 'Persoa de antes') returning id, onboarded_at`
		);
		const before = inserted.rows[0];
		expect(before.onboarded_at).toBeNull();

		await migrate(db, { migrationsFolder: 'drizzle' });
		const [backfilled] = await db.select().from(schema.users).where(eq(schema.users.id, before.id));
		expect(backfilled.onboardedAt).toBeInstanceOf(Date);

		const [after] = await db
			.insert(schema.users)
			.values({ provider: 'clave', subject: 'DESPOIS', displayName: 'Persoa nova' })
			.returning();
		expect(after.onboardedAt).toBeNull();
	});
});
