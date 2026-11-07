// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/export',
	summary: 'Full JSON export of the municipality (attachment, open format version 1)',
	auth: 'admin',
	params: z.object({ slug: Slug }),
	response: z.looseObject({
		format: z.literal('plataforma-reservas/export'),
		version: z.literal(1)
	}),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
