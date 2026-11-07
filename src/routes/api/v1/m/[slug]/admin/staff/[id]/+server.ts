// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail } from '../../../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../../../lib/server/http/validate';
import { removeStaff } from '../../../../../../../../lib/server/services/staff';
import { IdParams } from '../../admin-schemas';

export const DELETE: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const result = await removeStaff(event.locals.db, municipality.id, p.value.id);
	return result.ok ? new Response(null, { status: 204 }) : fail(result.error);
};
