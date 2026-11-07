// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { IsoInstant } from '../../../../../../../../lib/server/http/schemas';
import { BookingOut } from '../../bookings.openapi';
import { BookingParams } from '../cancel/cancel.openapi';

export const RescheduleBody = z.object({
	startsAt: IsoInstant,
	unitIndex: z.number().int().min(0).optional()
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/bookings/{id}/reschedule',
	summary: 'Move an own booking to another slot',
	auth: 'user',
	params: BookingParams,
	body: RescheduleBody,
	response: BookingOut,
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'PENALIZED',
		'NOT_FOUND',
		'FACILITY_INACTIVE',
		'SLOT_UNAVAILABLE',
		'UNIT_UNAVAILABLE',
		'CAPACITY_EXCEEDED',
		'ALREADY_FINAL',
		'IN_PAST',
		'TOO_FAR_AHEAD',
		'NOT_ALIGNED',
		'UNIT_REQUIRED',
		'TOO_LATE_TO_CANCEL'
	]
});
