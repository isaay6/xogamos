// SPDX-License-Identifier: EUPL-1.2
// Uso: DATABASE_URL=postgres://… npm run db:seed (as migracións execútanse á parte).
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/server/db/schema';
import { seedDemo } from '../src/lib/server/db/seed';
import { deriveDniSecret } from '../src/lib/server/domain/dni';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error(
		'DATABASE_URL is not set. Example: DATABASE_URL=postgres://user:pass@localhost:5432/reservas'
	);
	process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
	// Con AUTH_SECRET, os DNI ficticios gárdanse como hash coa mesma clave que usará a app.
	const secret = process.env.AUTH_SECRET;
	const counts = await seedDemo(drizzle(client, { schema }), {
		dniSecret: secret ? deriveDniSecret(secret) : null
	});
	console.log(
		`Demo seed done: ${counts.municipalities} municipalities, ${counts.facilities} facilities, ` +
			`${counts.people} people, ${counts.bookings} bookings.`
	);
} catch (e) {
	console.error('Demo seed failed:', e);
	process.exitCode = 1;
} finally {
	await client.end();
}
