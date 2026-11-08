// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers';

describe('securityHeaders', () => {
	it('engade as cabeceras de defensa e HSTS en produción HTTPS', () => {
		expect(securityHeaders(new URL('https://reservas.exemplo.gal/'), false)).toEqual({
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'strict-origin-when-cross-origin',
			'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
		});
	});

	it('non manda HSTS en desenvolvemento nin por HTTP', () => {
		expect(securityHeaders(new URL('https://localhost/'), true)).not.toHaveProperty(
			'Strict-Transport-Security'
		);
		expect(securityHeaders(new URL('http://reservas.exemplo.gal/'), false)).not.toHaveProperty(
			'Strict-Transport-Security'
		);
	});
});
