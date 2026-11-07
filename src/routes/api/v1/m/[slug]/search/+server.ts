// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail, json } from '../../../../../../lib/server/http/respond';
import { parseParams, parseQuery } from '../../../../../../lib/server/http/validate';
import { getMunicipalityBySlug } from '../../../../../../lib/server/services/municipalities';
import {
	alternatives,
	dayStrip,
	freeOptions,
	hoursForDay,
	listSports
} from '../../../../../../lib/server/services/search';
import { SearchParams, SearchQuery } from './search.openapi';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = parseParams(params, SearchParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const q = parseQuery(url, SearchQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });

	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	// Tipo de otro concello o sin instalaciones activas: no existe para el público.
	const sports = await listSports(locals.db, municipality.id);
	if (!sports.some((s) => s.typeId === q.value.type)) return fail('NOT_FOUND');

	const { db } = locals;
	const now = locals.now();
	const { type, date } = q.value;
	const time = q.value.time ?? null;
	const [days, hours, options] = await Promise.all([
		dayStrip(db, municipality.id, type, now),
		hoursForDay(db, municipality.id, type, date, now),
		freeOptions(db, municipality.id, type, date, time, now)
	]);
	const alts =
		options.length === 0 ? await alternatives(db, municipality.id, type, date, time, now) : [];
	return json({ days, hours, options, alternatives: alts });
};
