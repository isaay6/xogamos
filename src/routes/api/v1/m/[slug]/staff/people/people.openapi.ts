// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
export const SearchQuery = z.object({ q: z.string().trim().min(2).max(100) });
export const CreatePersonBody = z.object({
	displayName: z.string().trim().min(1).max(200),
	phone: z.string().trim().min(1).max(40)
});

export const PersonOut = z.object({
	profileId: z.uuid(),
	userId: z.uuid(),
	displayName: z.string(),
	phone: z.string().nullable()
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/staff/people',
	summary:
		'Search people of the municipality by name, or by phone digits when q has at least 3 (max 20, q of at least 2 characters)',
	auth: 'staff',
	params: SlugParams,
	query: SearchQuery,
	response: z.array(PersonOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/people',
	summary: 'Register a local person without Cl@ve',
	status: 201,
	auth: 'staff',
	params: SlugParams,
	body: CreatePersonBody,
	response: PersonOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
