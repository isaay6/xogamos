// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { SlugParams } from '../../admin-schemas';

export const CandidatesQuery = z.object({ q: z.string().trim().min(2).max(100) });

export const StaffCandidateOut = z.object({
	userId: z.uuid(),
	displayName: z.string(),
	provider: z.enum(['clave', 'chave365'])
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/staff/candidates',
	summary:
		'People with a profile in this municipality who signed in with Cl@ve or Chave365 whose name contains q (accent-insensitive, max 20)',
	auth: 'admin',
	params: SlugParams,
	query: CandidatesQuery,
	response: z.array(StaffCandidateOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
