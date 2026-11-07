// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { Uuid } from '../../../../../../lib/server/http/schemas';

registerRoute({
	method: 'get',
	path: '/api/v1/users/{id}/avatar',
	summary:
		'Avatar photo (PNG, JPEG or WebP, with its real Content-Type, nosniff and Cache-Control: private, no-cache). Only the person themself and staff of a municipality where they have a profile can see it; anyone else, a missing photo or an unknown id all get the same 404',
	auth: 'user',
	params: z.object({ id: Uuid }),
	response: z.string().meta({ format: 'binary' }),
	contentType: 'image/*',
	errors: ['NOT_FOUND']
});

registerRoute({
	method: 'put',
	path: '/api/v1/users/{id}/avatar',
	summary:
		'Replace your own avatar photo. The body is the raw image (PNG, JPEG or WebP, at most 262144 bytes); the type is checked by magic bytes. Another id gets 404',
	auth: 'user',
	status: 204,
	params: z.object({ id: Uuid }),
	body: z.string().meta({ format: 'binary' }),
	bodyContentType: 'image/*',
	response: z.null(),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'NOT_FOUND']
});

registerRoute({
	method: 'delete',
	path: '/api/v1/users/{id}/avatar',
	summary: 'Remove your own avatar photo. Another id gets 404',
	auth: 'user',
	status: 204,
	params: z.object({ id: Uuid }),
	response: z.null(),
	errors: ['UNAUTHENTICATED', 'NOT_FOUND']
});
