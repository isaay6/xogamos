// SPDX-License-Identifier: EUPL-1.2

const STATUS_BY_CODE: Record<string, number> = {
	VALIDATION_FAILED: 400,
	UNAUTHENTICATED: 401,
	FORBIDDEN: 403,
	PENALIZED: 403,
	NOT_FOUND: 404,
	FACILITY_INACTIVE: 404,
	SLOT_UNAVAILABLE: 409,
	UNIT_UNAVAILABLE: 409,
	CAPACITY_EXCEEDED: 409,
	ALREADY_FINAL: 409,
	SLUG_TAKEN: 409,
	HAS_FUTURE_BOOKINGS: 409,
	LAST_ADMIN: 409,
	DNI_EXISTS: 409,
	SLOT_AVAILABLE: 409,
	ALREADY_WAITING: 409,
	WAITLIST_LIMIT: 409,
	NOT_WAITLIST_OWNER: 403,
	IN_PAST: 422,
	TOO_FAR_AHEAD: 422,
	NOT_ALIGNED: 422,
	UNIT_REQUIRED: 422,
	TOO_LATE_TO_CANCEL: 422,
	NOT_STARTED: 422,
	TOO_LATE_FOR_NO_SHOW: 422,
	OUTSIDE_WINDOW: 422,
	NOT_TODAY: 422,
	ALREADY_USED: 422,
	CANCELLED: 422,
	INVALID_CONFIG: 422
};

export function statusFor(code: string): number {
	const status = STATUS_BY_CODE[code];
	if (status === undefined) throw new Error('UNMAPPED_ERROR_CODE');
	return status;
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export function fail(code: string, extra: object = {}): Response {
	return json({ ...extra, error: code }, statusFor(code));
}
