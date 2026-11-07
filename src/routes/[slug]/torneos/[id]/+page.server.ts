// SPDX-License-Identifier: EUPL-1.2
import { fail, error } from '@sveltejs/kit';
import {
	cancelTournamentEntry,
	getTournament,
	listMyTournamentEntries,
	signUpTournament
} from '../../../../lib/server/services/tournaments';
import { Uuid } from '../../../../lib/server/http/schemas';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	if (!Uuid.safeParse(event.params.id).success) error(404);
	const row = await getTournament(event.locals.db, municipality.id, event.params.id);
	if (!row) error(404);
	// A inscrición activa de quen mira, para amosar «Xa estás inscrito» e poder cancelala.
	const user = event.locals.user;
	const mine = user
		? (await listMyTournamentEntries(event.locals.db, municipality.id, user.id)).find(
				(entry) => entry.tournamentId === row.tournament.id && !entry.cancelledAt
			)
		: undefined;
	return {
		row,
		signedIn: Boolean(user),
		myEntryId: mine?.id ?? null,
		closed: event.locals.now() >= row.tournament.signupDeadline
	};
};

export const actions: Actions = {
	cancelar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const id = String((await event.request.formData()).get('entryId') ?? '');
		if (!Uuid.safeParse(id).success) return fail(404, { error: 'NOT_FOUND' as const });
		const result = await cancelTournamentEntry(
			event.locals.db,
			municipality.id,
			user.id,
			id,
			event.locals.now()
		);
		return result.ok ? { cancelled: true as const } : fail(409, { error: result.error });
	},
	inscribirme: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const paidWith = form.get('paidWith') === 'monedero' ? 'monedero' : 'instalacion';
		const result = await signUpTournament(
			event.locals.db,
			municipality.id,
			user.id,
			event.params.id,
			{
				teamName: String(form.get('teamName') ?? ''),
				members: String(form.get('members') ?? ''),
				paidWith
			},
			event.locals.now()
		);
		return result.ok
			? { signedUp: true as const }
			: fail(result.error === 'NOT_FOUND' ? 404 : 409, { error: result.error });
	}
};
