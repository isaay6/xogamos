// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../../../lib/server/http/validate';
import { deleteClosure } from '../../../../../../../../lib/server/services/admin';
import { IdParams } from '../../admin-schemas';
export const DELETE: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const result = await deleteClosure(event.locals.db, municipality.id, p.value.id);
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
