// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });

export const SummaryOut = z.object({
	displayName: z.string(),
	provider: z.enum(['clave', 'chave365', 'local']),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	isResident: z.boolean(),
	residencyDeclaredAt: z.string().nullable(),
	socialTariff: z.enum(['xove', 'maior', 'familia']).nullable(),
	avatarKey: z.string().nullable(),
	hasAvatarPhoto: z.boolean(),
	onboardedAt: z.string().nullable(),
	penaltyUntil: z.string().nullable(),
	streak: z.number().int(),
	bookingsThisYear: z.number().int(),
	favouriteTypeId: z.uuid().nullable()
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/me/summary',
	summary:
		'Own profile summary in a municipality: contact, residency, current penalty, weekly streak, bookings this year and favourite type',
	auth: 'user',
	params: SlugParams,
	response: SummaryOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'NOT_FOUND']
});
