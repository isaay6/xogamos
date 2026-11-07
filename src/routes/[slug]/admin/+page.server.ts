// SPDX-License-Identifier: EUPL-1.2
import { periodRange } from '../../../lib/server/domain/periods';
import { localDateOf } from '../../../lib/server/domain/time';
import {
	facilityLooks,
	municipalityIndicators,
	summarize
} from '../../../lib/server/services/indicators';
import { requireAdminPage } from './guard';
import type { PageServerLoad } from './$types';

/** Por debajo de esta ocupación, el personaje avisa de que la instalación no se usa. */
const WARN_BELOW = 0.15;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const {
		period: periodo,
		from,
		to
	} = periodRange(event.url.searchParams.get('periodo'), localDateOf(event.locals.now()));

	const { db } = event.locals;
	const indicators = await municipalityIndicators(db, municipality.id, from, to);
	const summary = summarize(indicators);
	const looks = await facilityLooks(db, municipality.id);
	const bars = indicators.byFacility.map((f) => ({
		id: f.facilityId,
		name: f.name,
		occupancy: f.occupancy,
		mascot: looks.get(f.facilityId)?.mascot ?? 'sala',
		color: looks.get(f.facilityId)?.color ?? '#9aa1a0'
	}));

	// La menos usada entre las que ofertaron horas (`underused` lo implica).
	const lowest = indicators.byFacility
		.filter((f) => f.underused)
		.sort((a, b) => a.occupancy - b.occupancy)[0];
	const warning =
		lowest && summary.bookings > 0 && lowest.occupancy < WARN_BELOW
			? { name: lowest.name, mascot: looks.get(lowest.facilityId)?.mascot ?? 'sala' }
			: null;

	return {
		periodo,
		from,
		to,
		kpi: summary,
		bars,
		peakHours: indicators.peakHours,
		warning
	};
};
