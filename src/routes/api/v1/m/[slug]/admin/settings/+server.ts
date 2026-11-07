// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../lib/server/http/validate';
import { getSettings, updateSettings } from '../../../../../../../lib/server/services/admin';
import { SettingsBody } from '../admin-schemas';
export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	return json(await getSettings(event.locals.db, municipality.id));
};

export const PUT: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, SettingsBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const result = await updateSettings(event.locals.db, municipality.id, body.value);
	return result.ok
		? json(result.value)
		: fail(result.error, result.issues ? { issues: result.issues } : {});
};
