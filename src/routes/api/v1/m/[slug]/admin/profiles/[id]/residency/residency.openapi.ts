// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { IdParams, ResidencyBody } from '../../../admin-schemas';
registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/profiles/{id}/residency',
	summary: 'Mark a person profile as resident or not (affects the price of future bookings)',
	auth: 'admin',
	params: IdParams,
	body: ResidencyBody,
	response: z.object({ id: z.uuid(), isResident: z.boolean() }),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
