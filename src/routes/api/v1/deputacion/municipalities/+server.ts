// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireDeputacion } from '../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../lib/server/http/respond';
import { DateRangeQuery } from '../../../../../lib/server/http/schemas';
import { parseBody, parseQuery } from '../../../../../lib/server/http/validate';
import {
	compareMunicipalities,
	createMunicipality
} from '../../../../../lib/server/services/deputacion';
import { CreateMunicipalityBody } from './municipalities.openapi';

export const GET: RequestHandler = async (event) => {
	const user = await requireDeputacion(event);
	if (user instanceof Response) return user;
	const range = parseQuery(event.url, DateRangeQuery);
	if (!range.ok) return fail(range.error, { issues: range.issues });
	return json(await compareMunicipalities(event.locals.db, range.value.from, range.value.to));
};

export const POST: RequestHandler = async (event) => {
	const user = await requireDeputacion(event);
	if (user instanceof Response) return user;
	const body = await parseBody(event, CreateMunicipalityBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const result = await createMunicipality(event.locals.db, body.value);
	if (!result.ok) return fail(result.error);
	const m = result.value;
	return json(
		{ id: m.id, slug: m.slug, name: m.name, province: m.province, primaryColor: m.primaryColor },
		201
	);
};
