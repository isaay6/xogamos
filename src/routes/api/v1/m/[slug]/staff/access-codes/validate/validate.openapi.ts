// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
/** PIN de 4 cifras, con o sin espacios («04 07»), o token QR firmado («<uuid>.<firma>»). */
export const ValidateCodeBody = z.object({
	code: z
		.string()
		.max(100)
		.transform((v) => v.replace(/\s/g, ''))
		.pipe(
			z
				.string()
				.regex(
					/^(\d{4}|[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]{22})$/,
					'Code must be a 4-digit PIN or a booking QR token'
				)
		)
});

export const LookupMatchOut = z.object({
	bookingId: z.uuid(),
	facilityName: z.string(),
	mascot: z.string(),
	startsAt: z.string(),
	endsAt: z.string(),
	unitIndex: z.number().int().nullable(),
	displayName: z.string(),
	priceCents: z.number().int()
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/access-codes/validate',
	summary:
		"Look up a 4-digit PIN or a signed QR token across the municipality's bookings of today without changing them (NOT_TODAY, only for a QR token, carries the date)",
	auth: 'staff',
	params: SlugParams,
	body: ValidateCodeBody,
	response: z.object({ matches: z.array(LookupMatchOut) }),
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'FORBIDDEN',
		'NOT_FOUND',
		'NOT_TODAY',
		'ALREADY_USED',
		'CANCELLED'
	]
});
