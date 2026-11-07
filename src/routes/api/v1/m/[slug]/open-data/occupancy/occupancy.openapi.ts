// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { MondayDate, Slug } from '../../../../../../../lib/server/http/schemas';

export const OccupancyQuery = z.object({ week: MondayDate });

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/open-data/occupancy',
	summary:
		'Open data: occupancy (0-1) per facility and day for the week starting on the given Monday. Public, CORS `*`, contains no personal data and no booking ids',
	auth: 'public',
	params: z.object({ slug: Slug }),
	query: OccupancyQuery,
	response: z.object({
		week: z.string(),
		facilities: z.array(
			z.object({
				facilityId: z.uuid(),
				name: z.string(),
				days: z.array(z.object({ date: z.string(), occupancy: z.number() }))
			})
		)
	}),
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
