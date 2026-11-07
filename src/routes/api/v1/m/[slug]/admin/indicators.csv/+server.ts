// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail } from '../../../../../../../lib/server/http/respond';
import { parseQuery } from '../../../../../../../lib/server/http/validate';
import { DateRangeQuery } from '../../../../../../../lib/server/http/schemas';
import { toCsv } from '../../../../../../../lib/server/export/csv';
import { municipalityIndicators } from '../../../../../../../lib/server/services/indicators';
import './indicators-csv.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const range = parseQuery(event.url, DateRangeQuery);
	if (!range.ok) return fail(range.error, { issues: range.issues });
	const { from, to } = range.value;
	const { byFacility } = await municipalityIndicators(event.locals.db, municipality.id, from, to);
	const csv = toCsv(
		[
			'Identificador da instalación',
			'Instalación',
			'Ocupación',
			'Reservas',
			'Faltas',
			'Taxa de faltas',
			'Pouco usada'
		],
		byFacility.map((f) => [
			f.facilityId,
			f.name,
			f.occupancy,
			f.bookings,
			f.noShows,
			f.noShowRate,
			f.underused
		])
	);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'cache-control': 'no-store',
			'content-disposition': `attachment; filename="${municipality.slug}-indicators-${from}-${to}.csv"`
		}
	});
};
