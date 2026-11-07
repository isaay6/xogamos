// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { requirePageStaff } from '../../../../lib/server/http/page-guards';
import { issueRechargeCard, listRechargeCards } from '../../../../lib/server/services/wallet';
import { requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	await requirePageStaff(event, municipality.id, ['conserxe']);
	return { cards: await listRechargeCards(event.locals.db, municipality.id) };
};

export const actions: Actions = {
	emitir: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = await requirePageStaff(event, municipality.id, ['conserxe']);
		const amountCents = Number((await event.request.formData()).get('amountCents'));
		if (![1000, 2000, 5000].includes(amountCents)) return fail(422, { error: 'INVALID' });
		const issued = await issueRechargeCard(event.locals.db, {
			municipalityId: municipality.id,
			issuedBy: user.id,
			amountCents,
			now: event.locals.now()
		});
		return { issued: { code: issued.code, amountCents } };
	}
};
