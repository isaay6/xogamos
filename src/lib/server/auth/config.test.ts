// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { identityConfig } from './config';

describe('identityConfig', () => {
	it('sin modo queda desactivado', () => {
		expect(identityConfig({})).toEqual({ mode: 'disabled', secret: null });
		expect(identityConfig({ IDENTITY_MODE: 'real', AUTH_SECRET: 'x' }).mode).toBe('disabled');
	});
	it('simulado con secreto válido', () => {
		const secret = 's'.repeat(32);
		expect(identityConfig({ IDENTITY_MODE: 'simulated', AUTH_SECRET: secret })).toEqual({
			mode: 'simulated',
			secret
		});
	});
	it('simulado sin secreto o corto lanza error', () => {
		expect(() => identityConfig({ IDENTITY_MODE: 'simulated' })).toThrow(/AUTH_SECRET/);
		expect(() => identityConfig({ IDENTITY_MODE: 'simulated', AUTH_SECRET: 'short' })).toThrow(
			/AUTH_SECRET/
		);
	});
	it('simulado solo permite una base desechable', () => {
		const secret = 's'.repeat(32);
		expect(
			identityConfig({ IDENTITY_MODE: 'simulated', AUTH_SECRET: secret, DATABASE_URL: undefined })
		).toEqual({ mode: 'simulated', secret });
		expect(() =>
			identityConfig({
				IDENTITY_MODE: 'simulated',
				AUTH_SECRET: secret,
				DATABASE_URL: 'postgres://real'
			})
		).toThrow(/DEMO_DATABASE_IS_DISPOSABLE/);
		expect(
			identityConfig({
				IDENTITY_MODE: 'simulated',
				AUTH_SECRET: secret,
				DATABASE_URL: 'postgres://demo',
				DEMO_DATABASE_IS_DISPOSABLE: '1'
			})
		).toEqual({ mode: 'simulated', secret });
	});
	it('DEMO=1 y simulación con una base no desechable lanza error', () => {
		expect(() =>
			identityConfig({
				DEMO: '1',
				IDENTITY_MODE: 'simulated',
				AUTH_SECRET: 's'.repeat(32),
				DATABASE_URL: 'postgres://real'
			})
		).toThrow(/DEMO_DATABASE_IS_DISPOSABLE/);
	});
});
