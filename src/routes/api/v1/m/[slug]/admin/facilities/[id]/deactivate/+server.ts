// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import {
	requireMunicipality,
	requireStaff
} from '../../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../../lib/server/http/respond';
import { parseParams, parseQuery } from '../../../../../../../../../lib/server/http/validate';
import { deactivateFacility } from '../../../../../../../../../lib/server/services/admin';
import { IdParams } from '../../../admin-schemas';
import { DeactivateQuery } from './deactivate.openapi';
export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const q = parseQuery(event.url, DeactivateQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });
	const { db, now } = event.locals;
	const result = await deactivateFacility(db, municipality.id, p.value.id, {
		force: q.value.force === 'true',
		now: now()
	});
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
