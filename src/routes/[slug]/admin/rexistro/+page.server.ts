// SPDX-License-Identifier: EUPL-1.2
import { listActivity } from '../../../../lib/server/services/activity-log';
import { requireAdminPage } from '../guard';
import type { PageServerLoad } from './$types';

const start = (value: string | null) =>
	value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : undefined;
const end = (value: string | null) =>
	value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999Z`) : undefined;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const kind = event.url.searchParams.get('tipo') || undefined;
	const from = event.url.searchParams.get('desde');
	const to = event.url.searchParams.get('ata');
	return {
		entries: await listActivity(event.locals.db, municipality.id, {
			kind,
			from: start(from),
			to: end(to)
		}),
		filters: { kind: kind ?? '', from: from ?? '', to: to ?? '' }
	};
};
