// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { cancelBooking } from '../../../../../lib/server/services/bookings';
import { facilityData, loadOwn } from '../own.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const own = await loadOwn(event);
	// Ya cancelada, usada o empezada: no hay nada que cancelar.
	if (!own.editable) redirect(303, `/${own.municipality.slug}/reserva/${own.booking.id}`);
	return {
		id: own.booking.id,
		startsAt: own.booking.startsAt,
		unitIndex: own.booking.unitIndex,
		today: own.today,
		inTime: own.inTime,
		cancellationDeadlineMinutes: own.ctx.cancellationDeadlineMinutes,
		facility: facilityData(own.ctx)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { municipality, booking, now } = await loadOwn(event);
		const result = await cancelBooking(event.locals.db, {
			municipalityId: municipality.id,
			bookingId: booking.id,
			byStaff: false,
			now
		});
		// Ya estaba cancelada (otra pestaña): el resultado es el mismo que se buscaba.
		if (result.ok || result.error === 'ALREADY_FINAL')
			redirect(303, `/${municipality.slug}/reservas`);
		return fail(422, { error: result.error });
	}
};
