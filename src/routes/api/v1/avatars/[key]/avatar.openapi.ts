// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../lib/server/http/openapi';
import { AVATARS } from '../../../../../lib/avatars';

registerRoute({
	method: 'get',
	path: '/api/v1/avatars/{key}',
	summary:
		'Catalogue avatar drawing as a standalone SVG (image/svg+xml, nosniff, a restrictive CSP and Cache-Control: public). Static artwork, not personal data; an unknown key gets 404',
	auth: 'public',
	params: z.object({ key: z.enum(AVATARS) }),
	response: z.string(),
	contentType: 'image/svg+xml',
	errors: ['NOT_FOUND']
});
