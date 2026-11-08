// SPDX-License-Identifier: EUPL-1.2

/** Cabeceras comunes de defensa, separadas para poder probalas sen un servidor. */
export function securityHeaders(url: URL, dev: boolean): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
		'Cross-Origin-Opener-Policy': 'same-origin'
	};
	// HSTS só é correcto cando a primeira resposta xa viaxa por HTTPS.
	if (!dev && url.protocol === 'https:') {
		headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	}
	return headers;
}
