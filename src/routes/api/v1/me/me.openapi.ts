// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../lib/server/http/openapi';
import { ContactInput } from '../../../../lib/server/services/me';

export const MeOut = z.object({
	user: z.object({ id: z.uuid(), displayName: z.string() }),
	profiles: z.array(
		z.object({
			municipalitySlug: z.string(),
			isResident: z.boolean(),
			penaltyUntil: z.string().nullable()
		})
	),
	roles: z.array(
		z.object({
			municipalitySlug: z.string().nullable(),
			role: z.enum(['admin', 'conserxe', 'deputacion'])
		})
	)
});

registerRoute({
	method: 'get',
	path: '/api/v1/me',
	summary: 'Current user, their profiles and staff roles',
	auth: 'user',
	response: MeOut,
	errors: ['UNAUTHENTICATED']
});

export const ContactOut = z.object({
	id: z.uuid(),
	displayName: z.string(),
	provider: z.enum(['clave', 'chave365', 'local']),
	email: z.string().nullable(),
	phone: z.string().nullable()
});

registerRoute({
	method: 'patch',
	path: '/api/v1/me',
	summary: 'Update own email (valid, max 200) and phone (max 40); null or empty clears',
	auth: 'user',
	body: ContactInput,
	response: ContactOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED']
});
