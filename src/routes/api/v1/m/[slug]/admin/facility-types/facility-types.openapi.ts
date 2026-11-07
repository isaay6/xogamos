// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { FacilityTypeBody, FacilityTypeOut, SlugParams } from '../admin-schemas';
registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/facility-types',
	summary: 'List facility types',
	auth: 'admin',
	params: SlugParams,
	response: z.array(FacilityTypeOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/admin/facility-types',
	summary: 'Create a facility type',
	status: 201,
	auth: 'admin',
	params: SlugParams,
	body: FacilityTypeBody,
	response: FacilityTypeOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
