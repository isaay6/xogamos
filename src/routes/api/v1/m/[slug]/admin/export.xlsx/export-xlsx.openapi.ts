// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/export.xlsx',
	summary: 'Complete municipality Excel export with frozen headings',
	auth: 'admin',
	params: z.object({ slug: Slug }),
	response: z.string(),
	contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
