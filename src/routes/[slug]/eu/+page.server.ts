// SPDX-License-Identifier: EUPL-1.2
import { responsibleEntities } from '../../../lib/server/services/entities';
import { getSummary } from '../../../lib/server/services/me';
import { listSports } from '../../../lib/server/services/search';
import { requireMunicipality } from '../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	if (!locals.user) return { summary: null, favourite: null, clubs: [] };

	const summary = await getSummary(locals.db, municipality.id, locals.user.id, locals.now());
	if (!summary) return { summary: null, favourite: null, clubs: [] };

	// El deporte favorito se muestra con su personaje.
	const sports = summary.favouriteTypeId ? await listSports(locals.db, municipality.id) : [];
	const sport = sports.find((s) => s.typeId === summary.favouriteTypeId);
	// Clubs dos que a persoa é responsable neste concello: cada un ten a súa zona.
	const clubs = await responsibleEntities(locals.db, municipality.id, locals.user.id);
	return {
		summary,
		clubs: clubs.map((club) => ({ id: club.id, name: club.name })),
		userId: locals.user.id,
		favourite: sport
			? { nameGl: sport.nameGl, nameEs: sport.nameEs, mascot: sport.mascot, color: sport.color }
			: null
	};
};
