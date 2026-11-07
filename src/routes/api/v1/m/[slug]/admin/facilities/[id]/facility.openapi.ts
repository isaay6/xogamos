// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { FacilityBody, FacilityOut, IdParams } from '../../admin-schemas';
registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/facilities/{id}',
	summary:
		'Replace a facility configuration; changing to a type with another booking mode fails with INVALID_CONFIG if it has future bookings',
	auth: 'admin',
	params: IdParams,
	body: FacilityBody,
	response: FacilityOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_CONFIG']
});
