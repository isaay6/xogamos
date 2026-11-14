// SPDX-License-Identifier: EUPL-1.2
import { and, eq, isNotNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { facilities, facilityTypes } from '../../../../../../../lib/server/db/schema';
import { requireMunicipality } from '../../../../../../../lib/server/http/guards';

const CORS = { 'access-control-allow-origin': '*' };

function withCors(response: Response) {
	response.headers.set('access-control-allow-origin', '*');
	return response;
}

/** Instalacións publicables: nunca inclúe persoas, reservas nin identificadores internos. */
export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return withCors(municipality);
	const rows = await event.locals.db
		.select({ facility: facilities, sport: facilityTypes.nameGl })
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.where(
			and(
				eq(facilities.municipalityId, municipality.id),
				eq(facilities.active, true),
				isNotNull(facilities.latitude),
				isNotNull(facilities.longitude)
			)
		);
	return new Response(
		JSON.stringify({
			type: 'FeatureCollection',
			features: rows.map(({ facility, sport }) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [facility.longitude, facility.latitude] },
				properties: {
					name: facility.name,
					sport,
					address: facility.address,
					accessible: facility.accessible,
					prices: {
						residentCents: facility.priceResidentCents,
						nonResidentCents: facility.priceNonResidentCents
					},
					url: `${event.url.origin}/${municipality.slug}/reservar`
				}
			}))
		}),
		{ headers: { ...CORS, 'content-type': 'application/geo+json; charset=utf-8' } }
	);
};
