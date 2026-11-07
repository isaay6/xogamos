// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { dniLetterOk, dniSuggestions, hashDni, normalizeDni } from './dni';

describe('normalizeDni', () => {
	it('quita espazos e guións e pasa a maiúsculas', () => {
		expect(normalizeDni(' 12345678-z ')).toBe('12345678Z');
		expect(normalizeDni('x 1234567 l')).toBe('X1234567L');
	});
	it('rexeita anacos e formatos que non son DNI nin NIE', () => {
		expect(normalizeDni('1234567')).toBeNull();
		expect(normalizeDni('12345678')).toBeNull();
		expect(normalizeDni('A1234567L')).toBeNull();
		expect(normalizeDni('123456789Z')).toBeNull();
		expect(normalizeDni('')).toBeNull();
	});
});

describe('dniLetterOk', () => {
	it('táboa mod 23 do DNI', () => {
		expect(dniLetterOk('12345678Z')).toBe(true);
		expect(dniLetterOk('12345678A')).toBe(false);
		expect(dniLetterOk('34987654P')).toBe(true);
	});
	it('NIE: X/Y/Z valen 0/1/2', () => {
		expect(dniLetterOk('X1234567L')).toBe(true);
		expect(dniLetterOk('X1234567A')).toBe(false);
		expect(dniLetterOk('Y1234567X')).toBe(true);
	});
	it('so acepta a forma normalizada', () => {
		expect(dniLetterOk('12345678z')).toBe(false);
		expect(dniLetterOk('1234')).toBe(false);
	});
});

describe('dniSuggestions', () => {
	it('un troco de cifras veciñas suxire o DNI bo', () => {
		expect(dniSuggestions('34987645P')).toContain('34987654P');
		expect(dniSuggestions('12345687-z')).toContain('12345678Z');
	});
	it('só DNI válidos, distintos do escrito e como moito 3', () => {
		for (const input of ['34987645P', '11111112A', '98765432M', 'X1234576L']) {
			const out = dniSuggestions(input);
			expect(out.length).toBeLessThanOrEqual(3);
			for (const s of out) {
				expect(dniLetterOk(s)).toBe(true);
				expect(s).not.toBe(normalizeDni(input));
			}
		}
	});
	it('nada se a entrada non ten forma de DNI', () => {
		expect(dniSuggestions('1234')).toEqual([]);
	});
});

describe('hashDni', () => {
	it('HMAC estable, distinto por clave e sen as cifras en claro', () => {
		const a = hashDni('12345678Z', 'k1');
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		expect(hashDni('12345678Z', 'k1')).toBe(a);
		expect(hashDni('12345678Z', 'k2')).not.toBe(a);
		expect(a).not.toContain('12345678');
	});
});
