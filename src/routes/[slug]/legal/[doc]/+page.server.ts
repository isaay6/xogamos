// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { getSettings } from '../../../../lib/server/services/admin';
import { requireMunicipality } from '../../municipality.server';
import type { PageServerLoad } from './$types';

const DOCS = {
	'aviso-legal': 'legalNotice',
	privacidade: 'privacyPolicy',
	normas: 'usageRules'
} as const;

export const load: PageServerLoad = async ({ params, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	if (!Object.hasOwn(DOCS, params.doc)) error(404);
	const doc = params.doc as keyof typeof DOCS;
	const settings = await getSettings(locals.db, municipality.id);
	// Texto plano: la página lo pinta como texto, nunca como HTML.
	return { doc, text: settings[DOCS[doc]].trim() };
};
