// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { DateRangeQuery, Slug } from '../../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/indicators.csv',
	summary:
		'Per-facility indicators as CSV (UTF-8 with BOM, attachment, formula-injection safe); `from` and `to` both inclusive, at most 92 days',
	auth: 'admin',
	params: z.object({ slug: Slug }),
	query: DateRangeQuery,
	response: z.string(),
	contentType: 'text/csv',
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
