// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { LocalDate, Slug } from '../../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
export const AgendaQuery = z.object({ date: LocalDate });

export const AgendaOut = z.array(
	z.object({
		facilityId: z.uuid(),
		facilityName: z.string(),
		location: z.string(),
		mascot: z.string(),
		color: z.string(),
		bookingMode: z.enum(['slot', 'unit', 'capacity', 'day']),
		units: z.number().int(),
		bookings: z.array(
			z.object({
				id: z.uuid(),
				startsAt: z.string(),
				endsAt: z.string(),
				unitIndex: z.number().int().nullable(),
				seats: z.number().int(),
				channel: z.string(),
				status: z.string(),
				profileId: z.uuid(),
				displayName: z.string(),
				phone: z.string().nullable(),
				accessCode: z.string(),
				priceCents: z.number().int(),
				isResident: z.boolean(),
				noShowCount: z.number().int()
			})
		)
	})
);

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/staff/agenda',
	summary:
		'Day agenda of the municipality grouped by facility (sorted by location), with access code, price, residency and no-show count',
	auth: 'staff',
	params: SlugParams,
	query: AgendaQuery,
	response: AgendaOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
