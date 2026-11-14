// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/open-data/facilities.geojson',
	summary: 'Open data: active facilities with WGS84 coordinates as GeoJSON. Public, CORS `*`, no personal data.',
	auth: 'public',
	params: z.object({ slug: Slug }),
	response: z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({ type: z.literal('Feature') })) }),
	contentType: 'application/geo+json',
	errors: ['NOT_FOUND']
});
