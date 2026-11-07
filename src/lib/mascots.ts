// SPDX-License-Identifier: EUPL-1.2
// Catálogo de personajes. Sin código de servidor: lo usa también la interfaz.

/** 20 deportes más `sala`, la puerta genérica (spec §4, decisión 14). */
export const MASCOTS = [
	'padel',
	'tenis',
	'squash',
	'badminton',
	'pingpong',
	'futbol',
	'basket',
	'volei',
	'balonmano',
	'rugby',
	'natacion',
	'fronton',
	'ximnasio',
	'atletismo',
	'escalada',
	'bolos',
	'ciclismo',
	'patinaxe',
	'golf',
	'piragua',
	'sala'
] as const;

export type Mascot = (typeof MASCOTS)[number];

export const DEFAULT_MASCOT: Mascot = 'sala';

export type MascotFamily = 'raqueta' | 'balon' | 'auga' | 'outro';

export const MASCOT_FAMILY: Record<Mascot, MascotFamily> = {
	padel: 'raqueta',
	tenis: 'raqueta',
	squash: 'raqueta',
	badminton: 'raqueta',
	pingpong: 'raqueta',
	futbol: 'balon',
	basket: 'balon',
	volei: 'balon',
	balonmano: 'balon',
	rugby: 'balon',
	natacion: 'auga',
	piragua: 'auga',
	fronton: 'outro',
	ximnasio: 'outro',
	atletismo: 'outro',
	escalada: 'outro',
	bolos: 'outro',
	ciclismo: 'outro',
	patinaxe: 'outro',
	golf: 'outro',
	sala: 'outro'
};

/** Claves del esquema antiguo y su equivalente actual (la migración 0004 usa la misma tabla). */
export const LEGACY_MASCOT: Record<'pala' | 'gota' | 'campo' | 'muro' | 'porta', Mascot> = {
	pala: 'padel',
	gota: 'natacion',
	campo: 'futbol',
	muro: 'fronton',
	porta: 'sala'
};
