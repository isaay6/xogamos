// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { exportMunicipality } from '../../../../../../../lib/server/services/exports';
import { localDateOf } from '../../../../../../../lib/server/domain/time';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const now = event.locals.now();
	const data = await exportMunicipality(event.locals.db, municipality.id, now);
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'no-store',
			'content-disposition': `attachment; filename="${municipality.slug}-export-${localDateOf(now)}.json"`
		}
	});
};
