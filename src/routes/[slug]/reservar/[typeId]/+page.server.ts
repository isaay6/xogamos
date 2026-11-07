// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { dayStrip, hoursForDay, listSports } from '../../../../lib/server/services/search';
import { parseDate, requireMunicipality } from '../../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	const sports = await listSports(locals.db, municipality.id);
	const sport = sports.find((s) => s.typeId === params.typeId);
	if (!sport) error(404);

	const now = locals.now();
	const days = await dayStrip(locals.db, municipality.id, sport.typeId, now);
	// `?date=` solo vale si está en la tira; si no, el primer día con hueco (o el primero).
	const asked = parseDate(url.searchParams.get('date'));
	const date =
		days.find((d) => d.date === asked)?.date ??
		days.find((d) => !d.full)?.date ??
		days[0]?.date ??
		null;
	if (!date) error(404);

	const hours = await hoursForDay(locals.db, municipality.id, sport.typeId, date, now);
	return { sport, days, date, hours };
};
