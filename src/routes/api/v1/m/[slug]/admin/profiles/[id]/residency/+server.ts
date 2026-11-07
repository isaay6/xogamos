// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import {
	requireMunicipality,
	requireStaff
} from '../../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../../lib/server/http/respond';
import { parseBody, parseParams } from '../../../../../../../../../lib/server/http/validate';
import { setResidency } from '../../../../../../../../../lib/server/services/admin';
import { IdParams, ResidencyBody } from '../../../admin-schemas';
export const PUT: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const body = await parseBody(event, ResidencyBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const result = await setResidency(
		event.locals.db,
		municipality.id,
		p.value.id,
		body.value.isResident,
		{ userId: staff.id, now: event.locals.now() }
	);
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
