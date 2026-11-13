// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail } from '../../../../../../../../../lib/server/http/respond';
import { Uuid } from '../../../../../../../../../lib/server/http/schemas';
import { getMunicipalityBySlug } from '../../../../../../../../../lib/server/services/municipalities';
import { getPublicFacilityPhoto } from '../../../../../../../../../lib/server/services/facility-photos';

/** Imagen pública, pero solo de instalaciones activas; los recursos ajenos siempre son 404. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const facilityId = Uuid.safeParse(params.id);
	const photoId = Uuid.safeParse(params.photoId);
	if (!facilityId.success || !photoId.success) return fail('NOT_FOUND');
	const municipality = await getMunicipalityBySlug(locals.db, params.slug ?? '');
	if (!municipality) return fail('NOT_FOUND');
	const photo = await getPublicFacilityPhoto(
		locals.db,
		municipality.id,
		facilityId.data,
		photoId.data
	);
	if (!photo) return fail('NOT_FOUND');
	return new Response(photo.bytes as BodyInit, {
		headers: {
			'content-type': photo.mime,
			'x-content-type-options': 'nosniff',
			'cache-control': 'public, max-age=86400'
		}
	});
};
