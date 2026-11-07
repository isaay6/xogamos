// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { IdParams } from '../../admin-schemas';
registerRoute({
	method: 'delete',
	path: '/api/v1/m/{slug}/admin/closures/{id}',
	summary: 'Delete a closure',
	auth: 'admin',
	params: IdParams,
	response: z.object({ id: z.uuid() }),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
