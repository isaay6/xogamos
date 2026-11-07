// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { IdParams } from '../../admin-schemas';

registerRoute({
	method: 'delete',
	path: '/api/v1/m/{slug}/admin/staff/{id}',
	summary: 'Remove a staff role of the municipality (never its last admin)',
	status: 204,
	auth: 'admin',
	params: IdParams,
	response: z.null(),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'LAST_ADMIN']
});
