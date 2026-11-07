// SPDX-License-Identifier: EUPL-1.2
// Solo desarrollo (`npm run dev:demo`): PGlite en memoria con las migraciones y `seedDemo`.
// Se carga con import() dinámico desde la rama `dev` de hooks.server.ts; no entra en producción.
import type { Db } from './client';
import { dniSecret } from '../auth/dni-secret';
import { seedDemo } from './seed';
import { createTestDb } from './test-db';

let demo: Promise<Db> | undefined;

/** Una sola instancia por proceso, creada y sembrada la primera vez. */
export function createDemoDb(): Promise<Db> {
	demo ??= (async () => {
		const db = await createTestDb();
		await seedDemo(db, { dniSecret: dniSecret() });
		return db;
	})();
	return demo;
}
