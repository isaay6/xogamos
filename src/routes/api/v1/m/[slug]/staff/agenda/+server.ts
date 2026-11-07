// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../lib/server/http/validate';
import { getAgenda } from '../../../../../../../lib/server/services/staff';
import { AgendaQuery } from './agenda.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const q = parseQuery(event.url, AgendaQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });
	return json(await getAgenda(event.locals.db, municipality.id, q.value.date));
};
