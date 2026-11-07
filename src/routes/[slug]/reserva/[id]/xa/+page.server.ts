// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { localDateOf } from '../../../../../lib/server/domain/time';
import { bookingQrValue } from '../../../../../lib/server/auth/booking-qr-secret';
import { requirePageUser } from '../../../../../lib/server/http/page-guards';
import { getOwnBooking, getProfile } from '../../../../../lib/server/services/profiles';
import { getFacilityContext } from '../../../../../lib/server/services/reservar';
import { listFacilityPhotos } from '../../../../../lib/server/services/facility-photos';
import { requireMunicipality } from '../../../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requirePageUser(event);
	const { locals, params } = event;
	const municipality = await requireMunicipality(locals.db, params.slug);
	// Recurso ajeno o inexistente → 404.
	if (!z.uuid().safeParse(params.id).success) error(404);
	const profile = await getProfile(locals.db, municipality.id, user.id);
	if (!profile) error(404);
	const booking = await getOwnBooking(locals.db, municipality.id, profile.id, params.id);
	if (!booking) error(404);
	const ctx = await getFacilityContext(locals.db, municipality.id, booking.facilityId);
	if (!ctx) error(404);

	return {
		easy: event.url.searchParams.get('easy') === '1',
		// Solo una reserva confirmada lleva código: si no, no se enseña ninguno.
		code: booking.status === 'confirmed' ? booking.accessCode : null,
		qr:
			booking.status === 'confirmed'
				? bookingQrValue(event.url, municipality.slug, booking.id)
				: null,
		bookingId: booking.id,
		startsAt: booking.startsAt,
		unitIndex: booking.unitIndex,
		today: localDateOf(locals.now()),
		facility: {
			id: ctx.facilityId,
			name: ctx.facilityName,
			nameGl: ctx.nameGl,
			nameEs: ctx.nameEs,
			color: ctx.color,
			mascot: ctx.mascot,
			bookingMode: ctx.bookingMode
		},
		photo: ctx.active ? ((await listFacilityPhotos(locals.db, ctx.facilityId))[0] ?? null) : null
	};
};
