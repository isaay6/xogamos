// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody, parseQuery } from '../../../../../../../lib/server/http/validate';
import { createLocalPerson, searchPeople } from '../../../../../../../lib/server/services/staff';
import { CreatePersonBody, SearchQuery } from './people.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const q = parseQuery(event.url, SearchQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });
	return json(await searchPeople(event.locals.db, municipality.id, q.value.q));
};

export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, CreatePersonBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const created = await createLocalPerson(event.locals.db, municipality.id, body.value);
	return created.ok ? json(created.value, 201) : fail(created.error);
};
