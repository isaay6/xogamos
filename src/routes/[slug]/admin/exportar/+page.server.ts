// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import {
	confirmFacilityImport,
	previewFacilityImport,
	type ImportRow
} from '../../../../lib/server/services/facility-import';
import { requireAdminPage } from '../guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminPage(event);
	return {};
};

export const actions: Actions = {
	previsualizar: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const file = form.get('ficheiro');
		if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith('.csv')) {
			return fail(400, { importError: 'adm.importar.csv' });
		}
		if (file.size > 1_000_000) return fail(400, { importError: 'adm.importar.grande' });
		const preview = await previewFacilityImport(
			event.locals.db,
			municipality.id,
			await file.text()
		);
		if ('error' in preview) return fail(400, { importError: preview.error });
		return { preview: preview.rows };
	},
	importar: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		let rows: ImportRow[];
		try {
			rows = JSON.parse(String(form.get('rows') ?? '[]'));
		} catch {
			return fail(400, { importError: 'adm.importar.invalida' });
		}
		if (!Array.isArray(rows) || rows.some((r) => !r || !Array.isArray(r.values) || r.error)) {
			return fail(400, { importError: 'adm.importar.corrixe' });
		}
		return { imported: await confirmFacilityImport(event.locals.db, municipality.id, rows) };
	}
};
