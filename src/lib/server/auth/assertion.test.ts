// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { ASSERTION_TTL_SECONDS, signAssertion, verifyAssertion } from './assertion';

const secret = 'a'.repeat(32);
const now = new Date('2026-11-24T10:00:00Z');
const payload = {
	provider: 'clave' as const,
	subject: 'DEMO-1',
	displayName: 'Nerea Cabaleiro',
	email: null,
	state: 's',
	exp: Math.floor(now.getTime() / 1000) + ASSERTION_TTL_SECONDS
};

describe('assertion', () => {
	it('ida y vuelta', () => {
		const r = verifyAssertion(signAssertion(payload, secret), secret, now);
		expect(r).toEqual({ ok: true, value: payload });
	});

	it('un byte cambiado en el payload da BAD_SIGNATURE', () => {
		const t = signAssertion(payload, secret);
		const [p, s] = t.split('.');
		const raw = Buffer.from(p, 'base64url');
		raw[5] ^= 1;
		const r = verifyAssertion(`${raw.toString('base64url')}.${s}`, secret, now);
		expect(r).toEqual({ ok: false, error: 'BAD_SIGNATURE' });
	});

	it('otro secreto da BAD_SIGNATURE', () => {
		const r = verifyAssertion(signAssertion(payload, secret), 'b'.repeat(32), now);
		expect(r).toEqual({ ok: false, error: 'BAD_SIGNATURE' });
	});

	it('caducada da EXPIRED', () => {
		const later = new Date((payload.exp + 1) * 1000);
		expect(verifyAssertion(signAssertion(payload, secret), secret, later)).toEqual({
			ok: false,
			error: 'EXPIRED'
		});
	});

	it('basura da MALFORMED', () => {
		expect(verifyAssertion('abc', secret, now)).toEqual({
			ok: false,
			error: 'MALFORMED'
		});
		expect(verifyAssertion('a.b.c', secret, now)).toEqual({
			ok: false,
			error: 'MALFORMED'
		});
		expect(verifyAssertion('', secret, now)).toEqual({
			ok: false,
			error: 'MALFORMED'
		});
	});

	it('firma válida sobre un payload que no es del esquema da MALFORMED', () => {
		const bad = signAssertion({ ...payload, provider: 'evil' as never }, secret);
		expect(verifyAssertion(bad, secret, now)).toEqual({
			ok: false,
			error: 'MALFORMED'
		});
	});
});
