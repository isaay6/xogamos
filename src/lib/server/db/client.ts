// SPDX-License-Identifier: EUPL-1.2
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

// Tipo común a los drivers postgres-js y PGlite (ambos extienden PgDatabase).
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// No conecta al importar: postgres() es perezoso hasta la primera consulta.
export function createDb(url: string): Db {
	return drizzle(postgres(url), { schema });
}
