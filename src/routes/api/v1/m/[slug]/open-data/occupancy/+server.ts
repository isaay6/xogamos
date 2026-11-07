// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../lib/server/http/validate';
import { addLocalDays } from '../../../../../../../lib/server/domain/time';
import { occupancyByDay } from '../../../../../../../lib/server/services/indicators';
import { OccupancyQuery } from './occupancy.openapi';

const CORS = { 'access-control-allow-origin': '*' };

function withCors(res: Response): Response {
	for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
	return res;
}

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return withCors(municipality);
	const query = parseQuery(event.url, OccupancyQuery);
	if (!query.ok) return withCors(fail(query.error, { issues: query.issues }));
	const { week } = query.value;
	const facilities = await occupancyByDay(
		event.locals.db,
		municipality.id,
		week,
		addLocalDays(week, 6)
	);
	return withCors(json({ week, facilities }));
};
