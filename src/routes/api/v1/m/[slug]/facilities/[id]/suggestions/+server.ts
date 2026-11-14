// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseParams, parseQuery } from '../../../../../../../../lib/server/http/validate';
import { getMunicipalityBySlug } from '../../../../../../../../lib/server/services/municipalities';
import { suggestAlternatives } from '../../../../../../../../lib/server/services/waitlist';
import { SuggestionsParams, SuggestionsQuery } from './suggestions.openapi';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = parseParams(params, SuggestionsParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const q = parseQuery(url, SuggestionsQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });
	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	return json(
		await suggestAlternatives(locals.db, {
			municipalityId: municipality.id,
			facilityId: p.value.id,
			date: q.value.date,
			now: locals.now()
		})
	);
};
