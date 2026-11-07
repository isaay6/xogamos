// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../lib/server/http/validate';
import { addStaff, listStaff } from '../../../../../../../lib/server/services/staff';
import { AddStaffBody } from './staff.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	return json(await listStaff(event.locals.db, municipality.id));
};

export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, AddStaffBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const result = await addStaff(event.locals.db, municipality.id, body.value);
	return result.ok ? json(result.value, 201) : fail(result.error);
};
