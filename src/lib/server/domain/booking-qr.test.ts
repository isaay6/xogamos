// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { extractQrToken, qrPayload, signBookingQr, verifyBookingQr } from './booking-qr';

const ID = '3f2b8c1e-5a47-4d9e-9b1a-0c6d7e8f9a10';

describe('booking QR token', () => {
	it('round-trips the booking id', () => {
		const token = signBookingQr(ID, 's');
		expect(token.startsWith(`${ID}.`)).toBe(true);
		expect(verifyBookingQr(token, 's')).toBe(ID);
	});

	it('signature is 16 bytes in base64url', () => {
		const sig = signBookingQr(ID, 's').split('.')[1];
		expect(sig).toMatch(/^[A-Za-z0-9_-]{22}$/);
	});

	it('rejects a tampered token', () => {
		const [id, sig] = signBookingQr(ID, 's').split('.');
		const other = '3f2b8c1e-5a47-4d9e-9b1a-0c6d7e8f9a11';
		expect(verifyBookingQr(`${other}.${sig}`, 's')).toBeNull();
		const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
		expect(verifyBookingQr(`${id}.${flipped}`, 's')).toBeNull();
	});

	it('rejects a token signed with another secret', () => {
		expect(verifyBookingQr(signBookingQr(ID, 'a'), 'b')).toBeNull();
	});

	it('rejects malformed tokens', () => {
		for (const t of ['', 'abc', `${ID}`, `${ID}.`, `${ID}.x`, `${ID}.a.b`, 'x.y']) {
			expect(verifyBookingQr(t, 's')).toBeNull();
		}
	});
});

describe('qrPayload', () => {
	it('is an absolute URL without personal data', () => {
		expect(qrPayload('https://reservas.exemplo.gal', 'viana-do-bolo', 'tok')).toBe(
			'https://reservas.exemplo.gal/viana-do-bolo/conserxeria/validar?qr=tok'
		);
	});

	it('drops a trailing slash from the origin', () => {
		expect(qrPayload('http://localhost:5173/', 'a', 't')).toBe(
			'http://localhost:5173/a/conserxeria/validar?qr=t'
		);
	});
});

describe('extractQrToken', () => {
	const token = signBookingQr(ID, 's');

	it('reads the token from the absolute and the relative URL', () => {
		expect(extractQrToken(qrPayload('https://x.gal', 'viana-do-bolo', token))).toBe(token);
		expect(extractQrToken(`/viana-do-bolo/conserxeria/validar?qr=${token}`)).toBe(token);
	});

	it('stops at other query parameters, a fragment or whitespace', () => {
		expect(extractQrToken(`/a/conserxeria/validar?qr=${token}&x=1`)).toBe(token);
		expect(extractQrToken(`/a/conserxeria/validar?qr=${token}#f`)).toBe(token);
		expect(extractQrToken(` /a/conserxeria/validar?qr=${token}\n`)).toBe(token);
	});

	it('returns null for a PIN, a bare token or a malformed escape', () => {
		expect(extractQrToken('4821')).toBeNull();
		expect(extractQrToken(token)).toBeNull();
		expect(extractQrToken('/a/conserxeria/validar?qr=%E0%A4%A')).toBeNull();
	});
});
