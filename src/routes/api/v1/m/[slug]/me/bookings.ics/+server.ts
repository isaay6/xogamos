// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../lib/server/http/guards';
import { myBookingsIcs } from '../../../../../../../lib/server/services/exports';
import { toIcs } from '../../../../../../../lib/server/export/ics';
import { getProfile } from '../../../../../../../lib/server/services/profiles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const { db } = event.locals;
	const profile = await getProfile(db, municipality.id, user.id);
	// ?booking=<uuid> limita o calendario a unha reserva; un valor que non é UUID ignórase.
	const param = event.url.searchParams.get('booking');
	const bookingId = param && UUID.test(param) ? param : undefined;
	const body = profile
		? await myBookingsIcs(db, municipality.id, profile.id, municipality.name, bookingId)
		: toIcs(municipality.name, []);
	return new Response(body, {
		headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' }
	});
};
