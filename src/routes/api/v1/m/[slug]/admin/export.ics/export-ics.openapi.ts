// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/export.ics',
	summary:
		'Municipality bookings as an iCalendar attachment (non-cancelled, from 30 days ago; no personal data)',
	auth: 'admin',
	params: z.object({ slug: Slug }),
	response: z.string(),
	contentType: 'text/calendar',
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
