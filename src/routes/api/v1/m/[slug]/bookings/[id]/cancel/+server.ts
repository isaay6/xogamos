// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseParams } from '../../../../../../../../lib/server/http/validate';
import { cancelBooking } from '../../../../../../../../lib/server/services/bookings';
import { getOwnBooking, getProfile } from '../../../../../../../../lib/server/services/profiles';
import { BookingParams } from './cancel.openapi';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const p = parseParams(event.params, BookingParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;

	const { db, now } = event.locals;
	const profile = await getProfile(db, municipality.id, user.id);
	const own = profile && (await getOwnBooking(db, municipality.id, profile.id, p.value.id));
	if (!own) return fail('NOT_FOUND');

	const result = await cancelBooking(db, {
		municipalityId: municipality.id,
		bookingId: own.id,
		byStaff: false,
		now: now()
	});
	return result.ok ? json(result.value) : fail(result.error);
};
