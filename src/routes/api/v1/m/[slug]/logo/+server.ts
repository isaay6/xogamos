// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail } from '../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../lib/server/http/validate';
import { getLogo } from '../../../../../../lib/server/services/logo';
import { getMunicipalityBySlug } from '../../../../../../lib/server/services/municipalities';
import { SlugParams } from './logo.openapi';

/** Con `?v=` igual a la versión vigente el URL no cambiará de contenido: caché inmutable. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=300';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = parseParams(params, SlugParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const municipality = await getMunicipalityBySlug(locals.db, p.value.slug);
	if (!municipality) return fail('NOT_FOUND');
	const logo = await getLogo(locals.db, municipality.id);
	if (!logo) return fail('NOT_FOUND');
	return new Response(logo.bytes as BodyInit, {
		headers: {
			'content-type': logo.mime,
			'x-content-type-options': 'nosniff',
			'cache-control': url.searchParams.get('v') === String(logo.version) ? IMMUTABLE : SHORT
		}
	});
};
