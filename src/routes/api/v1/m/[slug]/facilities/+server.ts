// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail, json } from '../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../lib/server/http/validate';
import { listActiveFacilities } from '../../../../../../lib/server/services/facilities';
import { getMunicipalityBySlug } from '../../../../../../lib/server/services/municipalities';
import { SlugParams } from './facilities.openapi';

export const GET: RequestHandler = async ({ locals, params }) => {
	const p = parseParams(params, SlugParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	return json(await listActiveFacilities(locals.db, municipality.id));
};
