// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { FacilityOut, IdParams } from '../../../admin-schemas';
export const DeactivateQuery = z.object({
	force: z.enum(['true', 'false']).optional()
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/admin/facilities/{id}/deactivate',
	summary:
		'Deactivate a facility. With future confirmed bookings it responds 409 HAS_FUTURE_BOOKINGS unless ?force=true; with force the facility is deactivated and the future bookings are kept (staff must notify the people)',
	auth: 'admin',
	params: IdParams,
	query: DeactivateQuery,
	response: FacilityOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'HAS_FUTURE_BOOKINGS']
});
