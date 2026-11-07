// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { localDateOf } from '../../../../../../../lib/server/domain/time';
import { municipalityCalendarIcs } from '../../../../../../../lib/server/services/exports';
import './export-ics.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const now = event.locals.now();
	const body = await municipalityCalendarIcs(
		event.locals.db,
		municipality.id,
		now,
		municipality.name,
		event.locals.locale
	);
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'cache-control': 'no-store',
			'content-disposition': `attachment; filename="${municipality.slug}-calendario-${localDateOf(now)}.ics"`
		}
	});
};
