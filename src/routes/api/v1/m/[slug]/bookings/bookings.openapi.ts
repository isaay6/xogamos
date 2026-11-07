// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { IsoInstant, Slug, Uuid } from '../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });

export const CreateBookingBody = z.object({
	facilityId: Uuid,
	startsAt: IsoInstant,
	unitIndex: z.number().int().min(0).optional(),
	seats: z.number().int().min(1).optional()
});

export const BookingOut = z.object({
	id: z.uuid(),
	municipalityId: z.uuid(),
	facilityId: z.uuid(),
	profileId: z.uuid(),
	unitIndex: z.number().int().nullable(),
	seats: z.number().int(),
	startsAt: z.string(),
	endsAt: z.string(),
	status: z.string(),
	accessCode: z.string(),
	priceCents: z.number().int(),
	channel: z.string(),
	createdByUserId: z.uuid(),
	createdAt: z.string(),
	cancelledAt: z.string().nullable()
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/bookings',
	summary: 'Create a booking',
	status: 201,
	auth: 'user',
	params: SlugParams,
	body: CreateBookingBody,
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
		'IN_PAST',
		'TOO_FAR_AHEAD',
		'NOT_ALIGNED',
		'UNIT_REQUIRED'
	]
});
