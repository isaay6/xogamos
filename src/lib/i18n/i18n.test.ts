// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { esZones, glZones, LOCALE_COOKIE, localeCookieOptions, localeFromCookie, t } from './index';

const zones = Object.keys(glZones) as (keyof typeof glZones)[];
const gl = Object.assign({}, ...Object.values(glZones)) as Record<string, string>;
const es = Object.assign({}, ...Object.values(esZones)) as Record<string, string>;

describe('i18n', () => {
	it('gl e es teñen as mesmas claves en cada zona', () => {
		for (const zone of zones) {
			expect(Object.keys(esZones[zone]).sort(), zone).toEqual(Object.keys(glZones[zone]).sort());
		}
	});

	it('ningunha clave se repite entre zonas', () => {
		for (const dicts of [glZones, esZones]) {
			const seen = new Set<string>();
			for (const dict of Object.values(dicts)) {
				for (const key of Object.keys(dict)) {
					expect(seen.has(key), key).toBe(false);
					seen.add(key);
				}
			}
		}
	});

	it('as claves novas levan o prefixo da súa zona', () => {
		const prefix = {
			vecinanza: 'vec.',
			conserxeria: 'cons.',
			admin: 'adm.',
			deputacion: 'dep.',
			demo: 'demo.'
		} as const;
		for (const [zone, p] of Object.entries(prefix)) {
			for (const key of Object.keys(glZones[zone as keyof typeof prefix])) {
				expect(key.startsWith(p), key).toBe(true);
			}
		}
	});

	it('ningún texto está baleiro', () => {
		for (const dict of [gl, es]) {
			for (const [key, value] of Object.entries(dict)) {
				expect(value.trim(), key).not.toBe('');
			}
		}
	});

	it('substitúe os parámetros {nome}', () => {
		expect(t('gl', 'reservar.para', { nome: 'Celestino' })).toBe('Reservar para Celestino');
		expect(t('es', 'reservar.para', { nome: 'Celestino' })).toBe('Reservar para Celestino');
	});

	it('deixa intactos os parámetros que non chegan', () => {
		expect(t('gl', 'reservar.para')).toBe('Reservar para {nome}');
		expect(t('gl', 'reservar.para', { outro: 1 })).toBe('Reservar para {nome}');
	});

	it('a cookie lingua=fr dá gl; só «es» dá es', () => {
		expect(LOCALE_COOKIE).toBe('lingua');
		expect(localeFromCookie('fr')).toBe('gl');
		expect(localeFromCookie(undefined)).toBe('gl');
		expect(localeFromCookie('ES')).toBe('gl');
		expect(localeFromCookie('es')).toBe('es');
	});

	it('a cookie dura un ano e é SameSite=Lax', () => {
		expect(localeCookieOptions(true)).toMatchObject({
			path: '/',
			maxAge: 365 * 24 * 60 * 60,
			sameSite: 'lax',
			secure: true
		});
	});
});
