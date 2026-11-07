// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../lib/server/http/validate';
import { getProfile, listMyBookings } from '../../../../../../../lib/server/services/profiles';
import { MyBookingsQuery } from './bookings.openapi';

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const q = parseQuery(event.url, MyBookingsQuery);
	if (!q.ok) return fail(q.error, { issues: q.issues });

	const { db, now } = event.locals;
	const profile = await getProfile(db, municipality.id, user.id);
	if (!profile) return json([]);
	return json(
		await listMyBookings(db, municipality.id, profile.id, { scope: q.value.scope, now: now() })
	);
};
