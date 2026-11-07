// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { CreateFacilityBody, FacilityAdminOut, FacilityOut, SlugParams } from '../admin-schemas';
registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/facilities',
	summary: 'List all facilities including inactive ones, with their opening hours',
	auth: 'admin',
	params: SlugParams,
	response: z.array(FacilityAdminOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/admin/facilities',
	summary: 'Create a facility with optional opening hours',
	status: 201,
	auth: 'admin',
	params: SlugParams,
	body: CreateFacilityBody,
	response: FacilityOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_CONFIG']
});
