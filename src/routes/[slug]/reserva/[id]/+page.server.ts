// SPDX-License-Identifier: EUPL-1.2
import { bookingQrValue } from '../../../../lib/server/auth/booking-qr-secret';
import { facilityData, loadOwn } from './own.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { booking, ctx, today, editable, inTime, municipality, entityName } = await loadOwn(event);
	// El código y el QR solo se envían si la reserva sigue abierta.
	const open = booking.status === 'confirmed';
	return {
		id: booking.id,
		code: open ? booking.accessCode : null,
		qr: open ? bookingQrValue(event.url, municipality.slug, booking.id) : null,
		status: booking.status,
		startsAt: booking.startsAt,
		endsAt: booking.endsAt,
		unitIndex: booking.unitIndex,
		priceCents: booking.priceCents,
		paymentMethod: booking.paymentMethod,
		entityName,
		today,
		editable,
		inTime,
		facility: facilityData(ctx)
	};
};
