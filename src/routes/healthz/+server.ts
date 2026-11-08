// SPDX-License-Identifier: EUPL-1.2
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		await locals.db.execute(sql`select 1`);
		return Response.json({ ok: true });
	} catch {
		return Response.json({ ok: false }, { status: 503 });
	}
};
