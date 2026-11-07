// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { STAFF_CANCEL_REASON_MAX } from '../../../../../../../../../lib/server/services/bookings';
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { BookingOut } from '../../../../bookings/bookings.openapi';
import { StaffBookingParams } from '../../bookings.openapi';

// Motivo obligatorio: va en el aviso de la persona, nunca en el correo.
export const StaffCancelBody = z.object({
	reason: z.string().trim().min(1).max(STAFF_CANCEL_REASON_MAX)
});

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/bookings/{id}/cancel',
	summary: 'Cancel any booking of the municipality (staff ignore the deadline)',
	auth: 'staff',
	params: StaffBookingParams,
	body: StaffCancelBody,
	response: BookingOut,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'ALREADY_FINAL']
});
