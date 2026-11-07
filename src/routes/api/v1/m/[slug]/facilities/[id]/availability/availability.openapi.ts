// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { LocalDate, Slug, Uuid } from '../../../../../../../../lib/server/http/schemas';

export const AvailabilityParams = z.object({ slug: Slug, id: Uuid });
export const AvailabilityQuery = z.object({ date: LocalDate });

export const SlotOut = z.object({
	startsAt: z.string(),
	endsAt: z.string(),
	free: z.boolean(),
	freeUnits: z.array(z.number().int()),
	remainingSeats: z.number().int()
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/facilities/{id}/availability',
	summary: 'Slot availability of an active facility for a calendar day',
	auth: 'public',
	params: AvailabilityParams,
	query: AvailabilityQuery,
	response: z.array(SlotOut),
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
