// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseBody, parseParams } from '../../../../../../../../lib/server/http/validate';
import { rescheduleBooking } from '../../../../../../../../lib/server/services/bookings';
import { getOwnBooking, getProfile } from '../../../../../../../../lib/server/services/profiles';
import { BookingParams } from '../cancel/cancel.openapi';
import { RescheduleBody } from './reschedule.openapi';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const p = parseParams(event.params, BookingParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const body = await parseBody(event, RescheduleBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;

	const { db, now } = event.locals;
	const profile = await getProfile(db, municipality.id, user.id);
	const own = profile && (await getOwnBooking(db, municipality.id, profile.id, p.value.id));
	if (!own) return fail('NOT_FOUND');

	const result = await rescheduleBooking(db, {
		municipalityId: municipality.id,
		bookingId: own.id,
		startsAt: body.value.startsAt,
		unitIndex: body.value.unitIndex,
		now: now()
	});
	return result.ok ? json(result.value) : fail(result.error);
};
