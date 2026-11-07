// SPDX-License-Identifier: EUPL-1.2
import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG = /^[A-Za-z0-9_-]{22}$/;
const SIG_BYTES = 16;

function signature(bookingId: string, secret: string): Buffer {
	return createHmac('sha256', secret).update(bookingId).digest().subarray(0, SIG_BYTES);
}

/** «<uuid>.<HMAC-SHA256 truncado a 16 bytes en base64url>»; no lleva datos personales. */
export function signBookingQr(bookingId: string, secret: string): string {
	return `${bookingId}.${signature(bookingId, secret).toString('base64url')}`;
}

/** Devuelve el id de la reserva si la firma es válida; null en cualquier otro caso. */
export function verifyBookingQr(token: string, secret: string): string | null {
	const parts = token.split('.');
	if (parts.length !== 2) return null;
	const [bookingId, sig] = parts;
	if (!UUID.test(bookingId) || !SIG.test(sig)) return null;
	const given = Buffer.from(sig, 'base64url');
	const expected = signature(bookingId, secret);
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
	return bookingId;
}

/**
 * Valor que codifica la imagen QR: URL absoluta de validar, sin datos personales. Absoluta para
 * que cualquier lector (cámara del móvil o lector de mostrador) la abra o la teclee entera.
 */
export function qrPayload(origin: string, slug: string, token: string): string {
	return `${origin.replace(/\/+$/, '')}/${slug}/conserxeria/validar?qr=${token}`;
}

const QR_PARAM = 'validar?qr=';

/**
 * Si la entrada es la URL de un QR (absoluta o relativa, p. ej. la que teclea un lector de
 * teclado), devuelve el token; si no, null.
 */
export function extractQrToken(input: string): string | null {
	const at = input.indexOf(QR_PARAM);
	if (at < 0) return null;
	const token = input.slice(at + QR_PARAM.length).split(/[&#\s]/)[0];
	try {
		return decodeURIComponent(token);
	} catch {
		return null;
	}
}
