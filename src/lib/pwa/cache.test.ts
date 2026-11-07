// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { shouldCache } from './cache';

describe('shouldCache', () => {
	it('garda só a lista e os detalles das reservas da veciñanza', () => {
		expect(shouldCache(new URL('https://reservas.gal/viana-do-bolo/reservas'))).toBe(true);
		expect(shouldCache(new URL('https://reservas.gal/viana-do-bolo/reservas/abc'))).toBe(true);
		expect(shouldCache(new URL('https://reservas.gal/viana-do-bolo/reserva/abc'))).toBe(true);
	});

	it('non garda zonas de persoal, autenticación, API nin escritas', () => {
		for (const path of [
			'/viana-do-bolo/admin',
			'/viana-do-bolo/conserxeria',
			'/deputacion',
			'/auth/logout',
			'/api/v1/me'
		]) {
			expect(shouldCache(new URL(`https://reservas.gal${path}`))).toBe(false);
		}
		expect(shouldCache(new URL('https://reservas.gal/viana-do-bolo/reservas'), 'POST')).toBe(false);
	});
});
