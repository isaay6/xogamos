// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseBody, parseParams } from '../../../../../../../../lib/server/http/validate';
import { updateFacilityType } from '../../../../../../../../lib/server/services/admin';
import { FacilityTypeBody, IdParams } from '../../admin-schemas';
export const PUT: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const body = await parseBody(event, FacilityTypeBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const { db, now } = event.locals;
	const result = await updateFacilityType(db, municipality.id, p.value.id, body.value, now());
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
