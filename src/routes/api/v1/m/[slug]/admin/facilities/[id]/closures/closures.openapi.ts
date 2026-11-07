// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { ClosureBody, ClosureOut, IdParams } from '../../../admin-schemas';
registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/facilities/{id}/closures',
	summary: 'List the closures of a facility',
	auth: 'admin',
	params: IdParams,
	response: z.array(ClosureOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/admin/facilities/{id}/closures',
	summary: 'Create a closure (endsAt after startsAt, instants with offset)',
	status: 201,
	auth: 'admin',
	params: IdParams,
	body: ClosureBody,
	response: ClosureOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
