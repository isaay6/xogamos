// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../../lib/server/http/validate';
import { searchStaffCandidates } from '../../../../../../../../lib/server/services/staff';
import { CandidatesQuery } from './candidates.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const q = parseQuery(event.url, CandidatesQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });
	return json(await searchStaffCandidates(event.locals.db, municipality.id, q.value.q));
};
