// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { ensureProfile } from '../../../../../../../../lib/server/services/profiles';
import { leaveWaitlist } from '../../../../../../../../lib/server/services/waitlist';

export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const profile = await ensureProfile(event.locals.db, municipality.id, user.id);
	const result = await leaveWaitlist(event.locals.db, {
		id: event.params.id,
		profileId: profile.id,
		now: event.locals.now()
	});
	return result.ok ? json({ ok: true }) : fail(result.error);
};
