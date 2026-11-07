// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { HoursBody, HoursItem, IdParams } from '../../../admin-schemas';
registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/facilities/{id}/hours',
	summary:
		'Replace the whole weekly schedule atomically (weekday 0 = Monday; validated against the facility mode and slotMinutes)',
	auth: 'admin',
	params: IdParams,
	body: HoursBody,
	response: z.array(HoursItem),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_CONFIG']
});
