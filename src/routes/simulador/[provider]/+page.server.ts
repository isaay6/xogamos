// SPDX-License-Identifier: EUPL-1.2
import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { ASSERTION_TTL_SECONDS, signAssertion } from '../../../lib/server/auth/assertion';
import { isProvider, readIdentityConfig } from '../../../lib/server/auth/config';
import { SIMULATED_IDENTITIES } from '../../../lib/server/auth/simulated-identities';

function requireSimulator(providerParam: string | undefined) {
	const config = readIdentityConfig();
	if (!isProvider(providerParam) || config.mode !== 'simulated') error(404);
	return { provider: providerParam, secret: config.secret! };
}

export const load: PageServerLoad = ({ params, url }) => {
	const { provider } = requireSimulator(params.provider);
	const state = url.searchParams.get('state');
	if (!state) error(400);
	const identities = SIMULATED_IDENTITIES.filter((i) => i.provider === provider);
	return {
		provider,
		state,
		// Destacadas arriba; o resto (centos de veciños), nunha sección pregable con busca.
		featured: identities.filter((i) => i.featured),
		others: identities.filter((i) => !i.featured)
	};
};

const form = z.object({
	state: z.string().min(1).max(128),
	subject: z.string().trim().min(1).max(64),
	displayName: z.string().trim().min(1).max(120)
});

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const { provider, secret } = requireSimulator(params.provider);
		const data = await request.formData();
		const parsed = form.safeParse({
			state: data.get('state'),
			subject: data.get('subject'),
			displayName: data.get('displayName')
		});
		if (!parsed.success) error(400);
		const exp = Math.floor(locals.now().getTime() / 1000) + ASSERTION_TTL_SECONDS;
		const assertion = signAssertion(
			{
				provider,
				subject: parsed.data.subject,
				displayName: parsed.data.displayName,
				email: null,
				state: parsed.data.state,
				exp
			},
			secret
		);
		redirect(303, `/auth/${provider}/callback?assertion=${encodeURIComponent(assertion)}`);
	}
};
