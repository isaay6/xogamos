// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../lib/server/http/openapi';

export const MunicipalityOut = z.object({
	id: z.uuid(),
	slug: z.string(),
	name: z.string(),
	province: z.string(),
	primaryColor: z.string()
});

registerRoute({
	method: 'get',
	path: '/api/v1/municipalities',
	summary: 'List municipalities',
	auth: 'public',
	response: z.array(MunicipalityOut),
	errors: []
});
