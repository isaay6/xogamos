// SPDX-License-Identifier: EUPL-1.2
import { createDb, type Db } from './client';

/**
 * Base de datos del proceso. Con `DATABASE_URL` se conecta a PostgreSQL. Sin ella solo hay
 * respaldo si se pasa `loadDemo`, que `hooks.server.ts` solo define en desarrollo (`dev`):
 * en producción falta la URL y se falla con un error claro.
 */
export async function resolveDb(opts: {
	databaseUrl: string | undefined;
	loadDemo: (() => Promise<Db>) | undefined;
}): Promise<Db> {
	if (opts.databaseUrl) return createDb(opts.databaseUrl);
	if (opts.loadDemo) return opts.loadDemo();
	throw new Error('DATABASE_URL no está definida');
}
