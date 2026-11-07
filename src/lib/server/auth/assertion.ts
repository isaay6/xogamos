// SPDX-License-Identifier: EUPL-1.2
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { err, ok, type Result } from '../services/result';

export const ASSERTION_TTL_SECONDS = 120;

const payloadSchema = z.object({
	provider: z.enum(['clave', 'chave365']),
	subject: z.string().min(1).max(64),
	displayName: z.string().min(1).max(120),
	email: z.string().max(254).nullable(),
	state: z.string().min(1).max(128),
	exp: z.number().int()
});

export type AssertionPayload = z.infer<typeof payloadSchema>;

const B64URL = /^[A-Za-z0-9_-]+$/;

function mac(payloadPart: string, secret: string): Buffer {
	return createHmac('sha256', secret).update(payloadPart).digest();
}

/** `base64url(json).base64url(hmacSha256(base64url(json)))` */
export function signAssertion(payload: AssertionPayload, secret: string): string {
	const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${part}.${mac(part, secret).toString('base64url')}`;
}

export function verifyAssertion(
	token: string,
	secret: string,
	now: Date
): Result<AssertionPayload, 'BAD_SIGNATURE' | 'EXPIRED' | 'MALFORMED'> {
	const parts = token.split('.');
	if (parts.length !== 2 || !B64URL.test(parts[0]) || !B64URL.test(parts[1])) {
		return err('MALFORMED');
	}
	const [payloadPart, sigPart] = parts;
	const given = Buffer.from(sigPart, 'base64url');
	const expected = mac(payloadPart, secret);
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return err('BAD_SIGNATURE');
	}
	let data: unknown;
	try {
		data = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
	} catch {
		return err('MALFORMED');
	}
	const parsed = payloadSchema.safeParse(data);
	if (!parsed.success) return err('MALFORMED');
	if (now.getTime() / 1000 > parsed.data.exp) return err('EXPIRED');
	return ok(parsed.data);
}
