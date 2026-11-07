// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail, json } from '../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../lib/server/http/validate';
import { getMunicipalityBySlug } from '../../../../../../lib/server/services/municipalities';
import { listSports } from '../../../../../../lib/server/services/search';
import { SportsParams } from './sports.openapi';

export const GET: RequestHandler = async ({ locals, params }) => {
	const p = parseParams(params, SportsParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	return json(await listSports(locals.db, municipality.id));
};
