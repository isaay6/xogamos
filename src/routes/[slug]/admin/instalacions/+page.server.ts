// SPDX-License-Identifier: EUPL-1.2
import { listAllFacilities, listFacilityTypes } from '../../../../lib/server/services/admin';
import { requireAdminPage } from '../guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const [facilities, types] = await Promise.all([
		listAllFacilities(event.locals.db, municipality.id, event.locals.now()),
		listFacilityTypes(event.locals.db, municipality.id)
	]);
	return { facilities, types };
};
