// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import {
	requireMunicipality,
	requireStaff
} from '../../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../../lib/server/http/respond';
import { parseBody, parseParams } from '../../../../../../../../../lib/server/http/validate';
import { replaceHours } from '../../../../../../../../../lib/server/services/admin';
import { HoursBody, IdParams } from '../../../admin-schemas';
export const PUT: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, IdParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const body = await parseBody(event, HoursBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	// Como na interface: quen queda fóra do horario novo recibe o aviso na mesma transacción.
	const result = await replaceHours(
		event.locals.db,
		municipality.id,
		p.value.id,
		body.value.hours,
		{
			notifyNow: event.locals.now()
		}
	);
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
