// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { MASCOTS } from '../../../../../../lib/mascots';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../lib/server/http/schemas';

export const SportsParams = z.object({ slug: Slug });

export const SportOut = z.object({
	typeId: z.uuid(),
	nameGl: z.string(),
	nameEs: z.string(),
	mascot: z.enum(MASCOTS),
	color: z.string(),
	bookingMode: z.enum(['slot', 'unit', 'capacity', 'day'])
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/sports',
	summary: 'List sports (facility types with at least one active facility)',
	auth: 'public',
	params: SportsParams,
	response: z.array(SportOut),
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
