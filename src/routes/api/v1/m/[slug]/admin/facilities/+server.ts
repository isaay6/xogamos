// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../lib/server/http/validate';
import { createFacility, listAllFacilities } from '../../../../../../../lib/server/services/admin';
import { CreateFacilityBody } from '../admin-schemas';
export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	return json(await listAllFacilities(event.locals.db, municipality.id));
};

export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, CreateFacilityBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const { hours, ...facility } = body.value;
	const result = await createFacility(event.locals.db, municipality.id, facility, hours);
	return result.ok
		? json(result.value, 201)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
