// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../../lib/server/http/openapi';
import { LocalDate, Slug, Uuid } from '../../../../../../../../lib/server/http/schemas';
export const SuggestionsParams = z.object({ slug: Slug, id: Uuid });
export const SuggestionsQuery = z.object({ date: LocalDate });
registerRoute({ method: 'get', path: '/api/v1/m/{slug}/facilities/{id}/suggestions', summary: 'Nearby available slots', auth: 'public', params: SuggestionsParams, query: SuggestionsQuery, response: z.array(z.object({ facilityId: Uuid, startsAt: z.string(), endsAt: z.string() })), errors: ['NOT_FOUND'] });
