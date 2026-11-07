// SPDX-License-Identifier: EUPL-1.2
import { registerRoute } from '../../../../../../../../../lib/server/http/openapi';
import { BookingOut } from '../../../../bookings/bookings.openapi';
import { StaffBookingParams } from '../../bookings.openapi';

registerRoute({
	method: 'post',
	path: '/api/v1/m/{slug}/staff/bookings/{id}/attended',
	summary:
		'Mark a confirmed booking as attended (from 15 min before the start until 48 h after the end)',
	auth: 'staff',
	params: StaffBookingParams,
	response: BookingOut,
	errors: [
		'VALIDATION_FAILED',
		'UNAUTHENTICATED',
		'FORBIDDEN',
		'NOT_FOUND',
		'ALREADY_FINAL',
		'OUTSIDE_WINDOW'
	]
});
