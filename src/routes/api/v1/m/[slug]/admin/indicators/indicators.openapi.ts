// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { DateRangeQuery, Slug } from '../../../../../../../lib/server/http/schemas';

export const IndicatorsOut = z.object({
	byFacility: z.array(
		z.object({
			facilityId: z.uuid(),
			name: z.string(),
			occupancy: z.number(),
			bookings: z.number().int(),
			noShows: z.number().int(),
			noShowRate: z.number(),
			underused: z.boolean(),
			open: z.boolean()
		})
	),
	peakHours: z.array(
		z.object({
			weekday: z.number().int().min(0).max(6),
			hour: z.number().int().min(0).max(23),
			bookings: z.number().int()
		})
	)
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/indicators',
	summary:
		'Occupancy, no-show rate and peak hours per facility. `from` and `to` are local dates, both inclusive, at most 92 days. Occupancy = booked minutes / offered minutes (confirmed, attended and no_show count); underused below 0.2; weekday 0 = Monday, hour local time',
	auth: 'admin',
	params: z.object({ slug: Slug }),
	query: DateRangeQuery,
	response: IndicatorsOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
