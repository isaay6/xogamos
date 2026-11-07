// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { Slug, Uuid } from '../../../../../../../../lib/server/http/schemas';
import { BookingOut } from '../../bookings.openapi';

export const BookingParams = z.object({ slug: Slug, id: Uuid });

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/bookings/{id}/cancel',
	summary: 'Cancel an own booking',
	auth: 'user',
	params: BookingParams,
	response: BookingOut,
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'NOT_FOUND',
		'ALREADY_FINAL',
		'TOO_LATE_TO_CANCEL'
	]
});
