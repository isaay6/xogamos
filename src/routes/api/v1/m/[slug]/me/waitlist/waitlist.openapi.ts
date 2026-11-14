// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { IsoInstant, Slug, Uuid } from '../../../../../../../lib/server/http/schemas';

export const JoinWaitlistBody = z.object({ facilityId: Uuid, startsAt: IsoInstant });
registerRoute({ method: 'get', path: '/api/v1/m/{slug}/me/waitlist', summary: 'My waitlist entries', auth: 'user', params: z.object({ slug: Slug }), response: z.array(z.unknown()) });
registerRoute({ method: 'post', path: '/api/v1/m/{slug}/me/waitlist', summary: 'Join a full slot waitlist', auth: 'user', params: z.object({ slug: Slug }), body: JoinWaitlistBody, response: z.unknown(), errors: ['NOT_FOUND', 'SLOT_AVAILABLE', 'WAITLIST_LIMIT'] });
