// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../lib/server/http/validate';
import { DateRangeQuery } from '../../../../../../../lib/server/http/schemas';
import { municipalityIndicators } from '../../../../../../../lib/server/services/indicators';
import './indicators.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const range = parseQuery(event.url, DateRangeQuery);
	if (!range.ok) return fail(range.error, { issues: range.issues });
	const { from, to } = range.value;
	return json(await municipalityIndicators(event.locals.db, municipality.id, from, to));
};
