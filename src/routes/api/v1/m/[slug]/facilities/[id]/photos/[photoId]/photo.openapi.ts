// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { Slug, Uuid } from '../../../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/facilities/{id}/photos/{photoId}',
	summary: 'A cached public facility photo; only active facilities are served',
	auth: 'public',
	params: z.object({ slug: Slug, id: Uuid, photoId: Uuid }),
	response: z.string().meta({ format: 'binary' }),
	contentType: 'image/*',
	errors: ['NOT_FOUND']
});
