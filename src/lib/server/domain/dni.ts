// SPDX-License-Identifier: EUPL-1.2
// DNI y NIE: forma normalizada, letra de control y hash para la búsqueda exacta del mostrador.
// El DNI nunca se guarda ni se registra en claro: solo `hashDni` (HMAC-SHA256 con clave propia).
import { createHmac } from 'node:crypto';

const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const DNI = /^[0-9]{8}[A-Z]$/;
const NIE = /^[XYZ][0-9]{7}[A-Z]$/;
const MAX_SUGGESTIONS = 3;

/**
 * Mayúsculas y sin espacios ni guiones. Solo acepta un DNI (8 cifras y letra) o un NIE (X, Y o Z,
 * 7 cifras y letra); cualquier otra cosa, también un trozo, es null. No mira la letra.
 */
export function normalizeDni(input: string): string | null {
	const s = input.replace(/[\s-]/g, '').toUpperCase();
	return DNI.test(s) || NIE.test(s) ? s : null;
}

/** Número sobre el que se calcula la letra: en el NIE, X/Y/Z valen 0/1/2. */
const numberOf = (dni: string) =>
	Number('XYZ'.includes(dni[0]) ? 'XYZ'.indexOf(dni[0]) + dni.slice(1, 8) : dni.slice(0, 8));

/** Letra de control de un número de DNI (tabla mod 23). */
export const dniLetter = (n: number): string => LETTERS[n % 23];

/** Letra de control (tabla mod 23) de un DNI/NIE ya normalizado. */
export function dniLetterOk(dni: string): boolean {
	if (!DNI.test(dni) && !NIE.test(dni)) return false;
	return dniLetter(numberOf(dni)) === dni[8];
}

/**
 * DNI válidos a un cambio de dos cifras vecinas del escrito (el error más común al dictar), sin el
 * propio, como mucho 3. Es solo aritmética: no mira si existen, así que no revela a nadie.
 */
export function dniSuggestions(input: string): string[] {
	const dni = normalizeDni(input);
	if (!dni) return [];
	const first = NIE.test(dni) ? 1 : 0;
	const out: string[] = [];
	for (let i = first; i < 7 && out.length < MAX_SUGGESTIONS; i++) {
		if (dni[i] === dni[i + 1]) continue;
		const c = [...dni];
		[c[i], c[i + 1]] = [c[i + 1], c[i]];
		const candidate = c.join('');
		if (dniLetterOk(candidate) && !out.includes(candidate)) out.push(candidate);
	}
	return out;
}

/** Clave del hash de DNI a partir de `AUTH_SECRET`, con la etiqueta `'dni'` (como la de los QR). */
export function deriveDniSecret(authSecret: string): string {
	return createHmac('sha256', authSecret).update('dni').digest('hex');
}

/** HMAC-SHA256 (hex) del DNI normalizado: permite solo la búsqueda exacta. */
export function hashDni(normalized: string, secret: string): string {
	return createHmac('sha256', secret).update(normalized).digest('hex');
}
