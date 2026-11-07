// SPDX-License-Identifier: EUPL-1.2
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { BookingOut } from '../../../../bookings/bookings.openapi';
import { StaffBookingParams } from '../../bookings.openapi';

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/bookings/{id}/no-show',
	summary: 'Mark a started booking as no-show',
	auth: 'staff',
	params: StaffBookingParams,
	response: BookingOut,
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'FORBIDDEN',
		'NOT_FOUND',
		'ALREADY_FINAL',
		'NOT_STARTED',
		'TOO_LATE_FOR_NO_SHOW'
	]
});
