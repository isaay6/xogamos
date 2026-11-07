// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { IsoInstant, Slug, Uuid } from '../../../../../../../lib/server/http/schemas';
import { BookingOut } from '../../bookings/bookings.openapi';

export const SlugParams = z.object({ slug: Slug });
export const StaffBookingParams = z.object({ slug: Slug, id: Uuid });

export const StaffCreateBookingBody = z.object({
	profileId: Uuid,
	facilityId: Uuid,
	startsAt: IsoInstant,
	unitIndex: z.number().int().min(0).optional(),
	seats: z.number().int().min(1).optional(),
	channel: z.enum(['phone', 'desk'])
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/bookings',
	summary: 'Create a booking on behalf of a person (phone or desk)',
	status: 201,
	auth: 'staff',
	params: SlugParams,
	body: StaffCreateBookingBody,
	response: BookingOut,
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'FORBIDDEN',
		'PENALIZED',
		'NOT_FOUND',
		'FACILITY_INACTIVE',
		'SLOT_UNAVAILABLE',
		'UNIT_UNAVAILABLE',
		'CAPACITY_EXCEEDED',
		'IN_PAST',
		'TOO_FAR_AHEAD',
		'NOT_ALIGNED',
		'UNIT_REQUIRED'
	]
});
