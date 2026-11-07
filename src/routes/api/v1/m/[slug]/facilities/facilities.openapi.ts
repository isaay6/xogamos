// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });

export const FacilityOut = z.object({
	id: z.uuid(),
	name: z.string(),
	units: z.number().int(),
	capacity: z.number().int(),
	slotMinutes: z.number().int(),
	priceResidentCents: z.number().int(),
	priceNonResidentCents: z.number().int(),
	accessible: z.boolean(),
	rules: z.string(),
	nameGl: z.string(),
	nameEs: z.string(),
	mascot: z.string(),
	color: z.string(),
	bookingMode: z.enum(['slot', 'unit', 'capacity', 'day'])
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/facilities',
	summary: 'List active facilities of a municipality',
	auth: 'public',
	params: SlugParams,
	response: z.array(FacilityOut),
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
