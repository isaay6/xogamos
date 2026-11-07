// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { Uuid } from '../../../../../../../lib/server/http/schemas';
import { SlugParams } from '../admin-schemas';

export const AddStaffBody = z.object({ userId: Uuid, role: z.enum(['admin', 'conserxe']) });

export const StaffMemberOut = z.object({
	roleId: z.uuid(),
	userId: z.uuid(),
	displayName: z.string(),
	role: z.enum(['admin', 'conserxe'])
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/staff',
	summary: 'Staff roles (admin, conserxe) of the municipality',
	auth: 'admin',
	params: SlugParams,
	response: z.array(StaffMemberOut),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/admin/staff',
	summary: 'Grant a role to a person with a profile in this municipality (idempotent)',
	status: 201,
	auth: 'admin',
	params: SlugParams,
	body: AddStaffBody,
	response: StaffMemberOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
