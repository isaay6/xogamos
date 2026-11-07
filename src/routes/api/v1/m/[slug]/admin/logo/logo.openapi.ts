// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { SlugParams } from '../admin-schemas';

registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/logo',
	summary:
		'Replace the municipality crest. The body is the raw image (PNG, JPEG or WebP, at most 262144 bytes); the type is checked by magic bytes, not by the request header',
	auth: 'admin',
	status: 204,
	params: SlugParams,
	body: z.string().meta({ format: 'binary' }),
	bodyContentType: 'image/*',
	response: z.null(),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
