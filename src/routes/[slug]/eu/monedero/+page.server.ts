// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { redeemRechargeCard, walletSummary } from '../../../../lib/server/services/wallet';
import { mobileTopUp, simulatedPaymentProvider } from '../../../../lib/server/services/wallet';
import { isDemo } from '../../../../lib/server/demo';
import { requireMunicipality } from '../../municipality.server';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	return {
		municipality,
		wallet: await walletSummary(event.locals.db, user.id),
		recharged: event.url.searchParams.has('recargado'),
		mobilePay: isDemo(),
		mobileTopUpKey: randomUUID()
	};
};

export const actions: Actions = {
	recargar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const code = String(form.get('code') ?? '').replace(/^wallet:/i, '');
		const result = await redeemRechargeCard(event.locals.db, {
			userId: user.id,
			code,
			now: event.locals.now()
		});
		if (!result.ok) return fail(422, { error: result.error });
		redirect(303, `/${municipality.slug}/eu/monedero?recargado=${result.value.amountCents}`);
	},
	mobil: async (event) => {
		if (!isDemo()) return fail(404, { error: 'NOT_FOUND' });
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const amountCents = Number(form.get('amountCents'));
		const idempotencyKey = String(form.get('idempotencyKey') ?? '');
		if (!idempotencyKey) return fail(422, { error: 'INVALID_AMOUNT' });
		const result = await mobileTopUp(event.locals.db, {
			userId: user.id,
			municipalityId: municipality.id,
			amountCents,
			idempotencyKey,
			now: event.locals.now(),
			provider: simulatedPaymentProvider
		});
		if (!result.ok) return fail(422, { error: result.error });
		redirect(303, `/${municipality.slug}/eu/monedero?recargado=mobile`);
	}
};
