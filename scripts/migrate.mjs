// SPDX-License-Identifier: EUPL-1.2
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('DATABASE_URL non está definida; indique a conexión a PostgreSQL antes de migrar.');
	process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });

try {
	await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	console.log('Migracións de base de datos completadas.');
} catch (error) {
	console.error('Non se puideron aplicar as migracións da base de datos:', error);
	process.exitCode = 1;
} finally {
	await client.end();
}
