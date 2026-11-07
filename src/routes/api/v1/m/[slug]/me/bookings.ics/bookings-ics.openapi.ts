// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/me/bookings.ics',
	summary: 'Own non-cancelled bookings as an iCalendar feed',
	auth: 'user',
	params: z.object({ slug: Slug }),
	query: z.object({ booking: z.uuid().optional() }),
	response: z.string(),
	contentType: 'text/calendar',
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'NOT_FOUND']
});
