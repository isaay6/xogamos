// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../../lib/server/http/respond';
import { parseBody } from '../../../../../../../../lib/server/http/validate';
import { bookingQrSecret } from '../../../../../../../../lib/server/auth/booking-qr-secret';
import { lookupAccessCode } from '../../../../../../../../lib/server/services/bookings';
import { ValidateCodeBody } from './validate.openapi';

/** Consulta sin efectos: marcar la llegada es `POST staff/bookings/{id}/attended`. */
export const POST: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['conserxe']);
	if (staff instanceof Response) return staff;
	const body = await parseBody(event, ValidateCodeBody);
	if (!body.ok) return fail(body.error, { issues: body.issues });

	const { db, now } = event.locals;
	const result = await lookupAccessCode(db, {
		municipalityId: municipality.id,
		code: body.value.code,
		now: now(),
		qrSecret: bookingQrSecret()
	});
	if (result.ok) return json({ matches: result.value });
	return fail(result.error, result.date ? { date: result.date } : {});
};
