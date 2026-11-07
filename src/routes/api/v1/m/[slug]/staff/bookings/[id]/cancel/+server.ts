// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import {
	requireMunicipality,
	requireStaff
} from '../../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../../lib/server/http/respond';
import { parseBody, parseParams } from '../../../../../../../../../lib/server/http/validate';
import { cancelBooking } from '../../../../../../../../../lib/server/services/bookings';
import { StaffBookingParams } from '../../bookings.openapi';
import { StaffCancelBody } from './cancel.openapi';

export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const p = parseParams(event.params, StaffBookingParams);
	if (!p.ok) return fail(p.error, { issues: p.issues });
	const body = await parseBody(event, StaffCancelBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });

	const { db, now } = event.locals;
	const result = await cancelBooking(db, {
		municipalityId: municipality.id,
		bookingId: p.value.id,
		byStaff: true,
		reason: body.value.reason,
		now: now()
	});
	return result.ok ? json(result.value) : fail(result.error);
};
