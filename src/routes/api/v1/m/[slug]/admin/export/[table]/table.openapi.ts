// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../../lib/server/http/schemas';

export const ExportTable = z.enum(['bookings', 'facilities', 'profiles']);

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/export/{table}',
	summary: 'CSV export of one table (UTF-8 with BOM, attachment, formula-injection safe)',
	auth: 'admin',
	params: z.object({ slug: Slug, table: ExportTable }),
	response: z.string(),
	contentType: 'text/csv',
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
