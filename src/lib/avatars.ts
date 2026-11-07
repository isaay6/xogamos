// SPDX-License-Identifier: EUPL-1.2
// Catálogo de avatares. Sin código de servidor: lo usan la interfaz y los servicios (tarea 3).
import { t, type Locale, type MessageKey } from './i18n';

/** Persoas, nenos e personaxes de deporte (`deporte-<mascota>`), na orde do selector. */
export const AVATARS = [
	'rapaz-pelo-curto',
	'rapaza-coleta',
	'home-barba',
	'muller-lentes',
	'home-maior',
	'muller-maior',
	'muller-afro',
	'home-rapado',
	'muller-mono',
	'home-lentes',
	'muller-pano',
	'avo-boina',
	'muller-pelo-longo',
	'persoa-gorro',
	'persoa-pelo-azul',
	'persoa-lentes',
	'neno-gorra',
	'neno-rizos',
	'neno-lentes',
	'nena-coletas',
	'nena-trenzas',
	'nena-lazo',
	'deporte-padel',
	'deporte-tenis',
	'deporte-futbol',
	'deporte-basket',
	'deporte-natacion',
	'deporte-ciclismo',
	'deporte-ximnasio',
	'deporte-fronton',
	'deporte-volei',
	'deporte-bolos'
] as const;

export type AvatarKey = (typeof AVATARS)[number];

export function isAvatarKey(key: string | null | undefined): key is AvatarKey {
	return typeof key === 'string' && (AVATARS as readonly string[]).includes(key);
}

/** Nome do debuxo, para o texto alternativo e o selector. */
export function avatarLabel(key: AvatarKey, locale: Locale): string {
	return t(locale, `vec.avatar.${key}` as MessageKey);
}
