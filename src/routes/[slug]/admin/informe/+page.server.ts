// SPDX-License-Identifier: EUPL-1.2
import { monthRange } from '../../../../lib/server/domain/periods';
import { localDateOf } from '../../../../lib/server/domain/time';
import { staffRoles } from '../../../../lib/server/db/schema';
import { getMunicipalityBySlug } from '../../../../lib/server/services/municipalities';
import { monthlyReport } from '../../../../lib/server/services/monthly-report';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireAdminPage } from '../guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Un concello ajeno no se confirma a personal de otro concello; la conserjería propia sí ve 403.
	if (!event.locals.user) await requireAdminPage(event);
	const municipality = await getMunicipalityBySlug(event.locals.db, event.params.slug ?? '');
	if (!municipality) error(404);
	const [role] = await event.locals.db
		.select({ role: staffRoles.role })
		.from(staffRoles)
		.where(
			and(
				eq(staffRoles.userId, event.locals.user!.id),
				eq(staffRoles.municipalityId, municipality.id)
			)
		);
	if (!role) error(404);
	if (role.role !== 'admin') error(403);
	const { month } = monthRange(event.url.searchParams.get('mes'), localDateOf(event.locals.now()));
	return {
		month,
		report: await monthlyReport(event.locals.db, municipality.id, month, event.locals.locale)
	};
};
