// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import {
	API_RATE_LIMIT,
	IDENTITY_RATE_LIMIT,
	POST_RATE_LIMIT,
	createRateLimiter,
	rateLimitRule
} from './rate-limit';

describe('rateLimitRule', () => {
	it('prioriza identidade, API e POST xerais', () => {
		expect(rateLimitRule('/auth/clave/start', 'POST')).toBe(IDENTITY_RATE_LIMIT);
		expect(rateLimitRule('/simulador/clave', 'POST')).toBe(IDENTITY_RATE_LIMIT);
		expect(rateLimitRule('/viana/entrar', 'POST')).toBe(IDENTITY_RATE_LIMIT);
		expect(rateLimitRule('/api/v1/me', 'GET')).toBe(API_RATE_LIMIT);
		expect(rateLimitRule('/viana/reservar', 'POST')).toBe(POST_RATE_LIMIT);
		expect(rateLimitRule('/viana/reservar', 'GET')).toBeNull();
	});
});

describe('limitador en memoria', () => {
	it('rexeita ata que pase a xanela e limpa entradas antigas', () => {
		let current = 1_000;
		const limiter = createRateLimiter(() => current);
		const rule = { name: 'proba', limit: 2, windowMs: 60_000 };
		expect(limiter.check('127.0.0.1', rule)).toEqual({ allowed: true, retryAfter: 0 });
		expect(limiter.check('127.0.0.1', rule)).toEqual({ allowed: true, retryAfter: 0 });
		expect(limiter.check('127.0.0.1', rule)).toEqual({ allowed: false, retryAfter: 60 });
		current += 60_001;
		expect(limiter.check('127.0.0.1', rule)).toEqual({ allowed: true, retryAfter: 0 });
	});

	it('cada regra ten o seu contador: os POST xerais non esgotan a entrada', () => {
		const limiter = createRateLimiter(() => 1_000);
		for (let i = 0; i < IDENTITY_RATE_LIMIT.limit; i++) limiter.check('10.0.0.1', POST_RATE_LIMIT);
		expect(limiter.check('10.0.0.1', IDENTITY_RATE_LIMIT).allowed).toBe(true);
		expect(limiter.check('10.0.0.2', POST_RATE_LIMIT).allowed).toBe(true);
	});
});
