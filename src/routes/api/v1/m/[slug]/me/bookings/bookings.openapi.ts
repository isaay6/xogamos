// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
export const MyBookingsQuery = z.object({
	scope: z.enum(['upcoming', 'past']).default('upcoming')
});

export const MyBookingOut = z.object({
	id: z.uuid(),
	facilityId: z.uuid(),
	facilityName: z.string(),
	facilityLocation: z.string(),
	facilityAddress: z.string(),
	typeId: z.uuid(),
	mascot: z.string(),
	color: z.string(),
	unitIndex: z.number().int().nullable(),
	seats: z.number().int(),
	startsAt: z.string(),
	endsAt: z.string(),
	status: z.string(),
	accessCode: z.string(),
	priceCents: z.number().int()
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/me/bookings',
	summary:
		'Own bookings in a municipality: upcoming (without cancelled ones) or past (history, including every cancelled one)',
	auth: 'user',
	params: SlugParams,
	query: MyBookingsQuery,
	response: z.array(MyBookingOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'NOT_FOUND']
});
