// SPDX-License-Identifier: EUPL-1.2
import { listActivity } from '../../../lib/server/services/activity-log';
import { listMunicipalities } from '../../../lib/server/services/municipalities';
import { requirePageDeputacion } from '../../../lib/server/http/page-guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requirePageDeputacion(event);
	const municipalities = await listMunicipalities(event.locals.db);
	const selected = event.url.searchParams.get('concello');
	const municipality = municipalities.find((item) => item.id === selected) ?? municipalities[0];
	return {
		municipalities,
		selected: municipality?.id ?? '',
		entries: municipality ? await listActivity(event.locals.db, municipality.id) : []
	};
};
