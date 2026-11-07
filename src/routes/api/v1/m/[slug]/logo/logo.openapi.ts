// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { Slug } from '../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
export const LogoQuery = z.object({
	v: z.string().optional().meta({ description: 'Logo version (logo_version) for cache busting' })
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/logo',
	summary:
		'Municipality crest (PNG, JPEG or WebP, served with its real Content-Type and nosniff). With ?v= equal to the current logo version it is cached for a year as immutable; otherwise a 5-minute public cache. 404 when none has been uploaded',
	auth: 'public',
	params: SlugParams,
	query: LogoQuery,
	response: z.string().meta({ format: 'binary' }),
	contentType: 'image/*',
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
