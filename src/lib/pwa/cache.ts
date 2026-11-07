// SPDX-License-Identifier: EUPL-1.2
// Reglas puras de caché: solo las páginas personales de vecindad pueden quedar en el dispositivo.

const BLOCKED_SEGMENTS = new Set(['admin', 'conserxeria', 'deputacion', 'auth', 'api']);

/** Indica si una navegación GET es una página personal que puede guardarse sin conexión. */
export function shouldCache(url: URL, method = 'GET'): boolean {
	if (method !== 'GET') return false;
	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) return false;
	if (segments.length < 2) return false;

	const [, area, id] = segments;
	// La ruta actual del detalle es /{slug}/reserva/{id}; también se acepta la futura bajo reservas.
	return (
		(area === 'reservas' && (segments.length === 2 || (segments.length === 3 && Boolean(id)))) ||
		(area === 'reserva' && segments.length === 3 && Boolean(id))
	);
}
