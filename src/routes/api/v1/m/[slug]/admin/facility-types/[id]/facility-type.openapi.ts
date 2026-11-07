// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { FacilityTypeBody, FacilityTypeOut, IdParams } from '../../admin-schemas';
registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/facility-types/{id}',
	summary:
		'Update a facility type; changing the booking mode fails with INVALID_CONFIG if its facilities have future bookings or an incompatible configuration',
	auth: 'admin',
	params: IdParams,
	body: FacilityTypeBody,
	response: FacilityTypeOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_CONFIG']
});
