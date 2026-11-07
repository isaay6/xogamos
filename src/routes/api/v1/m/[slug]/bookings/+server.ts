// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../lib/server/http/validate';
import { createBooking } from '../../../../../../lib/server/services/bookings';
import { ensureProfile } from '../../../../../../lib/server/services/profiles';
import { CreateBookingBody } from './bookings.openapi';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const body = await parseBody(event, CreateBookingBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });

	const { db, now } = event.locals;
	const profile = await ensureProfile(db, municipality.id, user.id);
	const result = await createBooking(db, {
		municipalityId: municipality.id,
		facilityId: body.value.facilityId,
		profileId: profile.id,
		startsAt: body.value.startsAt,
		unitIndex: body.value.unitIndex,
		seats: body.value.seats,
		channel: 'online',
		createdByUserId: user.id,
		now: now()
	});
	return result.ok ? json(result.value, 201) : fail(result.error);
};
