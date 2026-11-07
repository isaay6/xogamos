// SPDX-License-Identifier: EUPL-1.2
// Textos de interfaz sin dependencias: galego por defecto, castellano como segundo idioma.
// Sin código de servidor: lo usan también los componentes.
import { esAdmin } from './es/admin';
import { esCommon } from './es/common';
import { esConserxeria } from './es/conserxeria';
import { esDemo } from './es/demo';
import { esDeputacion } from './es/deputacion';
import { esVecinanza } from './es/vecinanza';
import { glAdmin } from './gl/admin';
import { glCommon } from './gl/common';
import { glConserxeria } from './gl/conserxeria';
import { glDemo } from './gl/demo';
import { glDeputacion } from './gl/deputacion';
import { glVecinanza } from './gl/vecinanza';

/** Textos por zona: cada pista toca só os seus ficheiros (`gl/<zona>.ts` e `es/<zona>.ts`). */
export const glZones = {
	common: glCommon,
	vecinanza: glVecinanza,
	conserxeria: glConserxeria,
	admin: glAdmin,
	deputacion: glDeputacion,
	demo: glDemo
};
export const esZones = {
	common: esCommon,
	vecinanza: esVecinanza,
	conserxeria: esConserxeria,
	admin: esAdmin,
	deputacion: esDeputacion,
	demo: esDemo
};

const gl = {
	...glCommon,
	...glVecinanza,
	...glConserxeria,
	...glAdmin,
	...glDeputacion,
	...glDemo
};
const es: Record<keyof typeof gl, string> = {
	...esCommon,
	...esVecinanza,
	...esConserxeria,
	...esAdmin,
	...esDeputacion,
	...esDemo
};

export type Locale = 'gl' | 'es';
export type MessageKey = keyof typeof gl;

export const LOCALES: readonly Locale[] = ['gl', 'es'];
export const DEFAULT_LOCALE: Locale = 'gl';

/** Cookie con el idioma elegido en «Perfil». */
export const LOCALE_COOKIE = 'lingua';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { gl, es };

/** Texto de `key` en `locale`, sustituyendo `{nome}` por `params.nome`. Los que faltan se dejan. */
export function t(
	locale: Locale,
	key: MessageKey,
	params?: Record<string, string | number>
): string {
	const text = dictionaries[locale][key];
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : whole
	);
}

/** Cualquier valor distinto de `es` (también ausente) cuenta como galego. */
export function localeFromCookie(value: string | undefined | null): Locale {
	return value === 'es' ? 'es' : 'gl';
}

/** Opciones de la cookie `lingua`: un año, `SameSite=Lax`. */
export function localeCookieOptions(secure: boolean) {
	return {
		path: '/',
		maxAge: 365 * 24 * 60 * 60,
		sameSite: 'lax' as const,
		httpOnly: true,
		secure
	};
}
