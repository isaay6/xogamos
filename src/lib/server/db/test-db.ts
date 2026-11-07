// SPDX-License-Identifier: EUPL-1.2
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './client';
import * as schema from './schema';

// PGlite en memoria con las migraciones de drizzle/ aplicadas.
export async function createTestDb(): Promise<Db> {
	const db = drizzle(new PGlite(), { schema });
	await migrate(db, { migrationsFolder: 'drizzle' });
	return db;
}
