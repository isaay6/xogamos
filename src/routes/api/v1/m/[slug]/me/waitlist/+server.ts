// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../lib/server/http/validate';
import { ensureProfile } from '../../../../../../../lib/server/services/profiles';
import { joinWaitlist, listMyWaitlist } from '../../../../../../../lib/server/services/waitlist';
import { JoinWaitlistBody } from './waitlist.openapi';

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const profile = await ensureProfile(event.locals.db, municipality.id, user.id);
	return json(await listMyWaitlist(event.locals.db, profile.id, event.locals.now()));
};

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const body = await parseBody(event, JoinWaitlistBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const profile = await ensureProfile(event.locals.db, municipality.id, user.id);
	const result = await joinWaitlist(event.locals.db, { ...body.value, municipalityId: municipality.id, profileId: profile.id, now: event.locals.now() });
	return result.ok ? json(result.value, 201) : fail(result.error);
};
