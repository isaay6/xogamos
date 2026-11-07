// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../lib/server/http/validate';
import { municipalityProfiles } from '../../../../../../../lib/server/db/schema';
import { createBooking } from '../../../../../../../lib/server/services/bookings';
import { StaffCreateBookingBody } from './bookings.openapi';

export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, StaffCreateBookingBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });

	const { db, now } = event.locals;
	const [profile] = await db
		.select({ id: municipalityProfiles.id })
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.id, body.value.profileId),
				eq(municipalityProfiles.municipalityId, municipality.id)
			)
		);
	if (!profile) return fail('NOT_FOUND');

	const result = await createBooking(db, {
		municipalityId: municipality.id,
		facilityId: body.value.facilityId,
		profileId: profile.id,
		startsAt: body.value.startsAt,
		unitIndex: body.value.unitIndex,
		seats: body.value.seats,
		channel: body.value.channel,
		createdByUserId: staff.id,
		now: now()
	});
	return result.ok ? json(result.value, 201) : fail(result.error);
};
