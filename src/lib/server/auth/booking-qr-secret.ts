// SPDX-License-Identifier: EUPL-1.2
import { createHmac } from 'node:crypto';
import { AUTH_SECRET, PUBLIC_ORIGIN } from '$app/env/private';
import { qrPayload, signBookingQr } from '../domain/booking-qr';

/** Deriva la clave de los QR de `AUTH_SECRET` con etiqueta propia (no se reutiliza la clave madre). */
export function deriveBookingQrSecret(authSecret: string): string {
	return createHmac('sha256', authSecret).update('booking-qr').digest('hex');
}

/** Clave de los QR del entorno actual; null si no hay `AUTH_SECRET` (los QR no se pueden emitir ni validar). */
export function bookingQrSecret(): string | null {
	return AUTH_SECRET ? deriveBookingQrSecret(AUTH_SECRET) : null;
}

/** Origen de las URL de los QR: `PUBLIC_ORIGIN` si está definido; si no, el de la petición. */
export function publicOrigin(url: URL): string {
	return PUBLIC_ORIGIN || url.origin;
}

/**
 * Lo que codifica el QR de una reserva: la URL absoluta de validar con el token firmado. Sin
 * clave (Ruling 2) devuelve null y la pantalla enseña solo el PIN, sin fallar.
 */
export function bookingQrValue(url: URL, slug: string, bookingId: string): string | null {
	const secret = bookingQrSecret();
	return secret ? qrPayload(publicOrigin(url), slug, signBookingQr(bookingId, secret)) : null;
}
