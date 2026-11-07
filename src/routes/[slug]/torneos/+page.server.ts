// SPDX-License-Identifier: EUPL-1.2
import { listUpcomingTournaments } from '../../../lib/server/services/tournaments';
import { requireMunicipality } from '../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const rows = await listUpcomingTournaments(event.locals.db, municipality.id, event.locals.now());
	return { rows };
};
