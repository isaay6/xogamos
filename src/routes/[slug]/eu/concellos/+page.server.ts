// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import {
	checkResidency,
	declareChosenResidency,
	municipalityChoices
} from '../../../../lib/server/http/profile-forms';
import { requireMunicipality } from '../../municipality.server';
import {
	followMunicipalities,
	joinMunicipality,
	leaveBlock,
	leaveMunicipality,
	listFollowed
} from '../../../../lib/server/services/profiles';
import type { Actions, PageServerLoad } from './$types';

// Os meus concellos: seguir e deixar de seguir (nunca borra perfís nin reservas) e declarar o
// empadroamento, que queda «pendente de comprobar» e non cambia o prezo.

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	return {
		municipalities: await municipalityChoices(event.locals.db, user.id, municipality.slug),
		saved: event.url.searchParams.get('gardado') === '1'
	};
};

export const actions: Actions = {
	unirse: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const id = (await event.request.formData()).get('concello');
		if (typeof id !== 'string' || !z.uuid().safeParse(id).success)
			return fail(400, { erro: 'NINGUN' as const });
		const result = await joinMunicipality(event.locals.db, user.id, id);
		if (!result.ok) return fail(400, { erro: 'NINGUN' as const });
		redirect(303, `/${municipality.slug}/eu/concellos?gardado=1`);
	},
	deixar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const id = (await event.request.formData()).get('concello');
		if (typeof id !== 'string' || !z.uuid().safeParse(id).success)
			return fail(400, { deixarErro: 'NOT_FOLLOWED' as const });
		const result = await leaveMunicipality(event.locals.db, user.id, id, event.locals.now());
		if (!result.ok) return fail(400, { deixarErro: result.error });
		redirect(303, `/${municipality.slug}/eu/concellos?gardado=1`);
	},
	seguir: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const ids = form
			.getAll('concello')
			.filter((id): id is string => typeof id === 'string' && z.uuid().safeParse(id).success);
		if (ids.length === 0) return fail(400, { erro: 'NINGUN' as const });
		// Primeiro compróbanse todas as saídas; só despois cámbiase todo nunha transacción.
		const followed = await listFollowed(event.locals.db, user.id);
		for (const row of followed.filter((row) => !ids.includes(row.municipalityId))) {
			const blocked = await leaveBlock(
				event.locals.db,
				user.id,
				row.municipalityId,
				event.locals.now()
			);
			if (blocked) return fail(400, { deixarErro: blocked });
		}
		const result = await followMunicipalities(event.locals.db, user.id, ids);
		if (!result.ok) return fail(400, { erro: 'NINGUN' as const });
		redirect(303, `/${municipality.slug}/eu/concellos?gardado=1`);
	},
	declarar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		// O campo do formulario é `concello`; a regra é a mesma ca na benvida.
		const choice = new FormData();
		choice.set('empadroado', String(form.get('concello') ?? ''));
		const checked = await checkResidency(event.locals.db, user.id, choice);
		if (!('declare' in checked)) return checked;
		if (!checked.declare) return fail(400, { empadroadoErro: true as const });
		await declareChosenResidency(event.locals.db, user.id, checked, event.locals.now());
		redirect(303, `/${municipality.slug}/eu/concellos?gardado=1`);
	}
};
