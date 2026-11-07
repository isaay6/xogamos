// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseParams, parseQuery } from '../../../../../../../../lib/server/http/validate';
import { getPublicAvailability } from '../../../../../../../../lib/server/services/facilities';
import { getMunicipalityBySlug } from '../../../../../../../../lib/server/services/municipalities';
import { AvailabilityParams, AvailabilityQuery } from './availability.openapi';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = parseParams(params, AvailabilityParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const q = parseQuery(url, AvailabilityQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });

	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	const result = await getPublicAvailability(locals.db, municipality.id, p.value.id, q.value.date);
	return result.ok ? json(result.value) : fail(result.error);
};
