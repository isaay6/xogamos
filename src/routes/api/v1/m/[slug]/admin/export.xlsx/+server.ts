// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { localDateOf } from '../../../../../../../lib/server/domain/time';
import { toXlsx } from '../../../../../../../lib/server/export/xlsx';
import { exportMunicipalityWorkbook } from '../../../../../../../lib/server/services/exports';
import './export-xlsx.openapi';

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const now = event.locals.now();
	const body = toXlsx(await exportMunicipalityWorkbook(event.locals.db, municipality.id, now));
	return new Response(new Blob([body as BlobPart]), {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'cache-control': 'no-store',
			'content-disposition': `attachment; filename="${municipality.slug}-export-${localDateOf(now)}.xlsx"`
		}
	});
};
