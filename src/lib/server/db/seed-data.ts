// SPDX-License-Identifier: EUPL-1.2
// Datos de demostración declarativos. Os nomes dos concellos son reais (provincia de Ourense),
// con escudo xenérico; instalacións, persoas e reservas son ficticias. As persoas xéranse en
// seed-people.ts e as reservas en seed-bookings.ts, sempre arredor de `now`.
import type { Mascot } from '../../mascots';
import type { BookingMode } from '../domain/types';

export const DEMO_SLUGS = [
	'viana-do-bolo',
	'a-rua',
	'o-barco-de-valdeorras',
	'a-pobra-de-trives',
	'manzaneda',
	'vilarino-de-conso',
	'a-veiga',
	'o-bolo',
	'petin',
	'larouco',
	'verin'
] as const;

export type DemoSlug = (typeof DEMO_SLUGS)[number];

/** Concellos da semente anterior (ficticios): a limpeza tamén os borra. */
export const LEGACY_DEMO_SLUGS = ['ribadavila', 'montemaior-do-rio'] as const;

/** Todos los subject de la demo empiezan así, en cualquier proveedor. */
export const DEMO_SUBJECT_PREFIX = 'DEMO-';

type Range = readonly [opens: string, closes: string];

// Colores de los tokens de la interfaz por familia de personaje; el resto, granito.
export const MASCOT_COLORS: Partial<Record<Mascot, string>> & Record<'padel' | 'sala', string> = {
	padel: '#F2762E',
	tenis: '#F2762E',
	squash: '#F2762E',
	natacion: '#1AA6C8',
	futbol: '#2E9E4F',
	basket: '#2E9E4F',
	balonmano: '#2E9E4F',
	volei: '#2E9E4F',
	fronton: '#9AA1A0',
	ximnasio: '#9AA1A0',
	escalada: '#9AA1A0',
	bolos: '#9AA1A0',
	sala: '#E3B26A'
};

export type DemoMunicipality = {
	slug: DemoSlug;
	name: string;
	province: 'Ourense';
	/** Color principal: texto branco lexible (contraste ≥ 4,5). */
	primaryColor: string;
};

export const DEMO_MUNICIPALITIES: DemoMunicipality[] = [
	{ slug: 'viana-do-bolo', name: 'Viana do Bolo', province: 'Ourense', primaryColor: '#0B5C8A' },
	{ slug: 'a-rua', name: 'A Rúa', province: 'Ourense', primaryColor: '#8A2D3B' },
	{
		slug: 'o-barco-de-valdeorras',
		name: 'O Barco de Valdeorras',
		province: 'Ourense',
		primaryColor: '#1F6B4F'
	},
	{
		slug: 'a-pobra-de-trives',
		name: 'A Pobra de Trives',
		province: 'Ourense',
		primaryColor: '#6A3D8F'
	},
	{ slug: 'manzaneda', name: 'Manzaneda', province: 'Ourense', primaryColor: '#2B5F75' },
	{
		slug: 'vilarino-de-conso',
		name: 'Vilariño de Conso',
		province: 'Ourense',
		primaryColor: '#7A4E14'
	},
	{ slug: 'a-veiga', name: 'A Veiga', province: 'Ourense', primaryColor: '#3D6324' },
	{ slug: 'o-bolo', name: 'O Bolo', province: 'Ourense', primaryColor: '#A0381C' },
	{ slug: 'petin', name: 'Petín', province: 'Ourense', primaryColor: '#2E4A9B' },
	{ slug: 'larouco', name: 'Larouco', province: 'Ourense', primaryColor: '#8C2F6E' },
	{ slug: 'verin', name: 'Verín', province: 'Ourense', primaryColor: '#9E2B25' }
];

export const demoMunicipalityName = (slug: DemoSlug): string =>
	DEMO_MUNICIPALITIES.find((m) => m.slug === slug)!.name;

/** «de» + nome, coa contracción galega do artigo: «da Rúa», «do Barco de Valdeorras». */
export function ofMunicipality(slug: DemoSlug): string {
	const name = demoMunicipalityName(slug);
	if (name.startsWith('A ')) return `da ${name.slice(2)}`;
	if (name.startsWith('O ')) return `do ${name.slice(2)}`;
	return `de ${name}`;
}

/** Tamaño relativo: escala a demanda e o número de veciños. */
export const DEMO_SIZE: Record<DemoSlug, number> = {
	'viana-do-bolo': 1,
	'a-rua': 0.9,
	'o-barco-de-valdeorras': 1,
	'a-pobra-de-trives': 0.85,
	manzaneda: 0.75,
	'vilarino-de-conso': 0.7,
	'a-veiga': 0.7,
	'o-bolo': 0.75,
	petin: 0.75,
	larouco: 0.7,
	verin: 1
};

/** Concellos próximos: algúns veciños teñen perfil neles como non empadroados. */
export const DEMO_NEIGHBOURS: Record<DemoSlug, DemoSlug[]> = {
	'viana-do-bolo': ['a-veiga', 'o-bolo', 'vilarino-de-conso', 'a-rua'],
	'a-rua': ['petin', 'larouco', 'o-barco-de-valdeorras', 'viana-do-bolo'],
	'o-barco-de-valdeorras': ['a-rua', 'petin', 'o-bolo'],
	'a-pobra-de-trives': ['manzaneda', 'larouco'],
	manzaneda: ['a-pobra-de-trives', 'vilarino-de-conso', 'a-veiga'],
	'vilarino-de-conso': ['viana-do-bolo', 'manzaneda'],
	'a-veiga': ['viana-do-bolo', 'o-bolo', 'manzaneda'],
	'o-bolo': ['viana-do-bolo', 'a-veiga', 'o-barco-de-valdeorras'],
	petin: ['a-rua', 'o-barco-de-valdeorras', 'larouco'],
	larouco: ['petin', 'a-rua', 'a-pobra-de-trives'],
	verin: ['viana-do-bolo']
};

/** Textos legales de ejemplo, marcados como tales (no son asesoramiento jurídico). */
export const demoLegal = (name: string) => ({
	legalNotice: `Texto de exemplo: aviso legal do Concello de ${name}. Substitúese polo texto oficial.`,
	privacyPolicy: `Texto de exemplo: política de privacidade do Concello de ${name}. Substitúese polo texto oficial.`,
	usageRules: `Texto de exemplo: normas de uso das instalacións do Concello de ${name}. Substitúense polas normas oficiais.`
});

/** Deporte (tipo de instalación): nome, personaxe e como se reserva. */
export type DemoSport = { nameGl: string; nameEs: string; mascot: Mascot };

export const DEMO_SPORTS = {
	padel: { nameGl: 'Pádel', nameEs: 'Pádel', mascot: 'padel' },
	tenis: { nameGl: 'Tenis', nameEs: 'Tenis', mascot: 'tenis' },
	squash: { nameGl: 'Squash', nameEs: 'Squash', mascot: 'squash' },
	piscina: { nameGl: 'Piscina', nameEs: 'Piscina', mascot: 'natacion' },
	'vaso-infantil': { nameGl: 'Vaso infantil', nameEs: 'Vaso infantil', mascot: 'natacion' },
	futbol: { nameGl: 'Fútbol', nameEs: 'Fútbol', mascot: 'futbol' },
	baloncesto: { nameGl: 'Baloncesto', nameEs: 'Baloncesto', mascot: 'basket' },
	pavillon: { nameGl: 'Pavillón', nameEs: 'Pabellón', mascot: 'balonmano' },
	polideportiva: { nameGl: 'Pista polideportiva', nameEs: 'Pista polideportiva', mascot: 'volei' },
	fronton: { nameGl: 'Frontón', nameEs: 'Frontón', mascot: 'fronton' },
	ximnasio: { nameGl: 'Ximnasio', nameEs: 'Gimnasio', mascot: 'ximnasio' },
	rocodromo: { nameGl: 'Rocódromo', nameEs: 'Rocódromo', mascot: 'escalada' },
	bolos: { nameGl: 'Bolos', nameEs: 'Bolos', mascot: 'bolos' },
	sala: { nameGl: 'Sala de usos múltiples', nameEs: 'Sala de usos múltiples', mascot: 'sala' }
} as const satisfies Record<string, DemoSport>;

export type DemoSportKey = keyof typeof DEMO_SPORTS;

/** Perfil de demanda: como se enche a instalación ao longo da semana. */
export type DemandKind =
	| 'padel'
	| 'pavillon'
	| 'raqueta'
	| 'campo'
	| 'aire-libre'
	| 'piscina-verán'
	| 'piscina-cuberta'
	| 'ximnasio'
	| 'fronton'
	| 'sala';

export type DemoFacility = {
	key: string;
	municipality: DemoSlug;
	sport: DemoSportKey;
	name: string;
	location: string;
	address: string;
	bookingMode: BookingMode;
	units: number;
	capacity: number;
	slotMinutes: number;
	priceResidentCents: number;
	priceNonResidentCents: number;
	/** Prezo para quen ten tarifa social (só nalgunhas instalacións). */
	priceSocialCents?: number;
	accessible: boolean;
	stepFreeAccess?: 'yes' | 'no' | 'partial' | null;
	adaptedToilet?: boolean | null;
	adaptedChangingRoom?: boolean | null;
	accessibleParkingNearby?: boolean | null;
	hearingLoop?: boolean | null;
	supportContact?: string;
	accessibilityNotes?: string;
	accessibilityCheckedAt?: string;
	rules: string;
	needsOpening?: boolean;
	accessInfo?: string;
	accessInfoEs?: string;
	/** weekday 0 = luns … 6 = domingo; os días sen entrada están pechados. */
	hours: Record<number, Range[]>;
	demand: DemandKind;
	/** Só abre no verán (15 xuño – 15 setembro): o resto do ano hai un peche. */
	summerOnly?: boolean;
};

const days = (list: number[], ...ranges: Range[]): Record<number, Range[]> =>
	Object.fromEntries(list.map((d) => [d, ranges]));
const merge = (...parts: Record<number, Range[]>[]): Record<number, Range[]> =>
	Object.assign({}, ...parts);
const WEEK = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6];

// Horarios tipo (luns–venres / fin de semana).
const H_PADEL = merge(
	days(WEEK, ['09:00', '13:30'], ['16:30', '22:30']),
	days(WEEKEND, ['10:00', '14:30'], ['16:30', '22:30'])
);
const H_PAVILLON = merge(
	days(WEEK, ['16:00', '23:00']),
	days(WEEKEND, ['10:00', '14:00'], ['16:00', '21:00'])
);
const H_CAMPO = merge(
	days(WEEK, ['17:00', '23:00']),
	days(WEEKEND, ['10:00', '14:30'], ['16:30', '22:30'])
);
const H_FUTBOL_7 = days(ALL, ['08:00', '22:00']);
const H_TARDE = merge(
	days(WEEK, ['16:00', '22:00']),
	days(WEEKEND, ['10:00', '14:00'], ['16:00', '21:00'])
);
const H_PISCINA_CUBERTA = merge(
	days(WEEK, ['07:00', '10:00'], ['17:00', '21:00']),
	days([5], ['10:00', '14:00'])
);
const H_XIMNASIO = merge(
	days(WEEK, ['07:00', '09:00'], ['17:00', '21:00']),
	days([5], ['10:00', '13:00'])
);
const H_SALA = days([0, 1, 2, 3, 4, 5], ['09:00', '21:00']);

type Defaults = Pick<DemoFacility, 'units' | 'capacity' | 'accessible' | 'rules'>;
const base: Defaults = { units: 1, capacity: 1, accessible: true, rules: '' };
const fac = (f: Omit<DemoFacility, keyof Defaults> & Partial<Defaults>): DemoFacility => ({
	...base,
	...f
});

const RULES_PADEL = 'Calzado deportivo obrigatorio. Trae as túas propias palas e pelotas.';
const RULES_PAVILLON =
	'Calzado de sala limpo. Os clubs teñen preferencia nas tardes de adestramento.';
const RULES_CAMPO = 'Só botas de tacos de goma. Os vestiarios péchanse 30 minutos despois.';
const RULES_PISCINA = 'Gorro de baño obrigatorio. Ducha previa antes de entrar na auga.';
const RULES_FRONTON = 'Prohibido o uso de balóns de coiro. Deixa a pista limpa ao saír.';
const RULES_SALA = 'Para asociacións e actos veciñais. Reserva por xornada completa.';
const RULES_XIMNASIO = 'Toalla persoal obrigatoria. Máximo de persoas por franxa.';

export const DEMO_FACILITIES: DemoFacility[] = [
	// ── Viana do Bolo (docs/ideas/datos-demo-viana.md) ────────────────────────
	fac({
		key: 'viana-piscina-adultos',
		municipality: 'viana-do-bolo',
		sport: 'piscina',
		name: 'Piscina municipal · vaso de adultos',
		location: 'Piscina municipal (ao aire libre)',
		address: 'Rúa Nicolás Tenorio, 49',
		bookingMode: 'unit',
		units: 3,
		slotMinutes: 60,
		priceResidentCents: 200,
		priceNonResidentCents: 400,
		priceSocialCents: 100,
		stepFreeAccess: 'yes',
		adaptedToilet: true,
		adaptedChangingRoom: true,
		accessibleParkingNearby: true,
		hearingLoop: false,
		supportContact: '988 340 120',
		accessibilityNotes: 'Entrada pola rampla lateral. Avisar con antelación se se precisa apoio.',
		accessibilityCheckedAt: '2026-09-15',
		rules: `${RULES_PISCINA} Aberta só no verán.`,
		hours: days(ALL, ['11:00', '20:00']),
		demand: 'piscina-verán',
		summerOnly: true
	}),
	fac({
		key: 'viana-piscina-infantil',
		municipality: 'viana-do-bolo',
		sport: 'vaso-infantil',
		name: 'Piscina municipal · vaso infantil',
		location: 'Piscina municipal (ao aire libre)',
		address: 'Rúa Nicolás Tenorio, 49',
		bookingMode: 'capacity',
		capacity: 8,
		slotMinutes: 120,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Menores sempre acompañados dunha persoa adulta. Aberta só no verán.',
		hours: days(ALL, ['11:00', '19:00']),
		demand: 'piscina-verán',
		summerOnly: true
	}),
	fac({
		key: 'viana-futbol',
		municipality: 'viana-do-bolo',
		sport: 'futbol',
		name: 'Campo de fútbol As Carrelas',
		location: 'As Carrelas',
		address: 'Estrada da Rúa, s/n',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 2500,
		priceNonResidentCents: 4000,
		accessible: false,
		rules: `Herba natural e grada cuberta. ${RULES_CAMPO}`,
		hours: H_CAMPO,
		demand: 'campo'
	}),
	fac({
		key: 'viana-futbol-7',
		municipality: 'viana-do-bolo',
		sport: 'futbol',
		name: 'Campo de fútbol 7',
		location: 'As Carrelas',
		address: 'Estrada da Rúa, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 1500,
		priceNonResidentCents: 2500,
		rules: `Herba artificial. ${RULES_CAMPO}`,
		hours: H_FUTBOL_7,
		demand: 'campo'
	}),
	fac({
		key: 'viana-pavillon',
		municipality: 'viana-do-bolo',
		sport: 'pavillon',
		name: 'Pavillón polideportivo',
		location: 'Pavillón polideportivo (cuberto)',
		address: 'Rúa Nicolás Tenorio, s/n',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1500,
		priceNonResidentCents: 3000,
		priceSocialCents: 750,
		stepFreeAccess: 'partial',
		adaptedToilet: true,
		adaptedChangingRoom: true,
		accessibleParkingNearby: true,
		hearingLoop: null,
		supportContact: '988 340 121',
		accessibilityNotes: 'A grada superior só ten acceso por escaleiras.',
		accessibilityCheckedAt: '2026-09-12',
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'viana-padel',
		municipality: 'viana-do-bolo',
		sport: 'padel',
		name: 'Pistas de pádel',
		location: 'Xunto ao pavillón',
		address: 'Rúa Nicolás Tenorio, s/n',
		bookingMode: 'unit',
		units: 2,
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		priceSocialCents: 0,
		stepFreeAccess: 'yes',
		adaptedToilet: false,
		adaptedChangingRoom: null,
		accessibleParkingNearby: true,
		hearingLoop: null,
		accessibilityCheckedAt: '2026-09-10',
		needsOpening: true,
		accessInfo: 'En inverno ábrea a Policía Local á hora da túa reserva. Amosa o teu PIN.',
		accessInfoEs: 'En invierno la abre la Policía Local a la hora de tu reserva. Enseña tu PIN.',
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'viana-tenis',
		municipality: 'viana-do-bolo',
		sport: 'tenis',
		name: 'Pista de tenis',
		location: 'Pista exterior',
		address: 'Rúa Nicolás Tenorio, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		priceSocialCents: 0,
		needsOpening: true,
		accessInfo: 'En inverno ábrea a Policía Local á hora da túa reserva. Amosa o teu PIN.',
		accessInfoEs: 'En invierno la abre la Policía Local a la hora de tu reserva. Enseña tu PIN.',
		rules: 'Calzado de tenis obrigatorio. Trae as túas raquetas e pelotas.',
		hours: days(ALL, ['08:00', '22:00']),
		demand: 'raqueta'
	}),

	// ── A Rúa ─────────────────────────────────────────────────────────────────
	fac({
		key: 'rua-pavillon',
		municipality: 'a-rua',
		sport: 'pavillon',
		name: 'Pavillón municipal',
		location: 'Pavillón municipal',
		address: 'Rúa do Deporte, 2',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1500,
		priceNonResidentCents: 3000,
		stepFreeAccess: 'yes',
		adaptedToilet: true,
		adaptedChangingRoom: true,
		accessibleParkingNearby: true,
		hearingLoop: false,
		supportContact: '988 310 210',
		accessibilityCheckedAt: '2026-09-08',
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'rua-piscina',
		municipality: 'a-rua',
		sport: 'piscina',
		name: 'Piscina climatizada',
		location: 'Piscina climatizada',
		address: 'Avenida de Galicia, 40',
		bookingMode: 'unit',
		units: 2,
		slotMinutes: 60,
		priceResidentCents: 250,
		priceNonResidentCents: 450,
		rules: RULES_PISCINA,
		hours: H_PISCINA_CUBERTA,
		demand: 'piscina-cuberta'
	}),
	fac({
		key: 'rua-padel',
		municipality: 'a-rua',
		sport: 'padel',
		name: 'Pista de pádel',
		location: 'Xunto ao pavillón',
		address: 'Rúa do Deporte, 2',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 90,
		priceResidentCents: 400,
		priceNonResidentCents: 700,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'rua-futbol',
		municipality: 'a-rua',
		sport: 'futbol',
		name: 'Campo de fútbol municipal',
		location: 'Campo municipal',
		address: 'Camiño do Campo, s/n',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 2500,
		priceNonResidentCents: 4500,
		accessible: false,
		rules: RULES_CAMPO,
		hours: H_CAMPO,
		demand: 'campo'
	}),
	fac({
		key: 'rua-sala',
		municipality: 'a-rua',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Casa da Cultura',
		address: 'Praza do Concello, 1',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── O Barco de Valdeorras ─────────────────────────────────────────────────
	fac({
		key: 'barco-pavillon',
		municipality: 'o-barco-de-valdeorras',
		sport: 'pavillon',
		name: 'Pavillón municipal',
		location: 'Pavillón municipal',
		address: 'Rúa do Pavillón, 1',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1800,
		priceNonResidentCents: 3500,
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'barco-piscina',
		municipality: 'o-barco-de-valdeorras',
		sport: 'piscina',
		name: 'Piscina climatizada',
		location: 'Piscina climatizada',
		address: 'Avenida do Sil, 12',
		bookingMode: 'unit',
		units: 3,
		slotMinutes: 60,
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		rules: RULES_PISCINA,
		hours: H_PISCINA_CUBERTA,
		demand: 'piscina-cuberta'
	}),
	fac({
		key: 'barco-padel',
		municipality: 'o-barco-de-valdeorras',
		sport: 'padel',
		name: 'Pistas de pádel',
		location: 'Cidade deportiva',
		address: 'Avenida do Sil, 14',
		bookingMode: 'unit',
		units: 2,
		slotMinutes: 90,
		priceResidentCents: 450,
		priceNonResidentCents: 800,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'barco-futbol',
		municipality: 'o-barco-de-valdeorras',
		sport: 'futbol',
		name: 'Campo de fútbol de herba artificial',
		location: 'Cidade deportiva',
		address: 'Avenida do Sil, 14',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 3000,
		priceNonResidentCents: 5000,
		rules: RULES_CAMPO,
		hours: H_CAMPO,
		demand: 'campo'
	}),
	fac({
		key: 'barco-tenis',
		municipality: 'o-barco-de-valdeorras',
		sport: 'tenis',
		name: 'Pistas de tenis',
		location: 'Cidade deportiva',
		address: 'Avenida do Sil, 14',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 60,
		priceResidentCents: 300,
		priceNonResidentCents: 600,
		rules: 'Calzado de tenis obrigatorio.',
		hours: H_TARDE,
		demand: 'raqueta'
	}),
	fac({
		key: 'barco-rocodromo',
		municipality: 'o-barco-de-valdeorras',
		sport: 'rocodromo',
		name: 'Rocódromo',
		location: 'Pavillón municipal',
		address: 'Rúa do Pavillón, 1',
		bookingMode: 'capacity',
		capacity: 6,
		slotMinutes: 120,
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		rules: 'Arnés e pés de gato propios. Menores con persoa adulta.',
		hours: merge(days(WEEK, ['17:00', '21:00']), days(WEEKEND, ['10:00', '14:00'])),
		demand: 'ximnasio'
	}),
	fac({
		key: 'barco-sala',
		municipality: 'o-barco-de-valdeorras',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Casa da Cultura',
		address: 'Praza Maior, 3',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── A Pobra de Trives ─────────────────────────────────────────────────────
	fac({
		key: 'trives-pavillon',
		municipality: 'a-pobra-de-trives',
		sport: 'pavillon',
		name: 'Pavillón municipal',
		location: 'Pavillón municipal',
		address: 'Rúa do Pavillón, s/n',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1200,
		priceNonResidentCents: 2400,
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'trives-padel',
		municipality: 'a-pobra-de-trives',
		sport: 'padel',
		name: 'Pista de pádel',
		location: 'Xunto ao pavillón',
		address: 'Rúa do Pavillón, s/n',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 90,
		priceResidentCents: 300,
		priceNonResidentCents: 600,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'trives-fronton',
		municipality: 'a-pobra-de-trives',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón cuberto',
		address: 'Rúa do Frontón, 2',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 200,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),
	fac({
		key: 'trives-tenis',
		municipality: 'a-pobra-de-trives',
		sport: 'tenis',
		name: 'Pista de tenis',
		location: 'Pista exterior',
		address: 'Rúa do Pavillón, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 200,
		priceNonResidentCents: 400,
		rules: 'Calzado de tenis obrigatorio.',
		hours: H_TARDE,
		demand: 'raqueta'
	}),

	// ── Manzaneda ─────────────────────────────────────────────────────────────
	fac({
		key: 'manzaneda-polideportiva',
		municipality: 'manzaneda',
		sport: 'polideportiva',
		name: 'Pista polideportiva',
		location: 'Pista exterior',
		address: 'Rúa da Escola, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Pista de uso libre: reserva para asegurar a túa hora.',
		hours: H_TARDE,
		demand: 'aire-libre'
	}),
	fac({
		key: 'manzaneda-fronton',
		municipality: 'manzaneda',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón',
		address: 'Rúa da Escola, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 150,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),
	fac({
		key: 'manzaneda-padel',
		municipality: 'manzaneda',
		sport: 'padel',
		name: 'Pista de pádel',
		location: 'Xunto á pista polideportiva',
		address: 'Rúa da Escola, s/n',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 90,
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'manzaneda-sala',
		municipality: 'manzaneda',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Centro sociocultural',
		address: 'Praza do Concello, 1',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── Vilariño de Conso ─────────────────────────────────────────────────────
	fac({
		key: 'vilarino-polideportiva',
		municipality: 'vilarino-de-conso',
		sport: 'polideportiva',
		name: 'Pista polideportiva',
		location: 'Pista exterior',
		address: 'Rúa Principal, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Pista de uso libre: reserva para asegurar a túa hora.',
		hours: H_TARDE,
		demand: 'aire-libre'
	}),
	fac({
		key: 'vilarino-fronton',
		municipality: 'vilarino-de-conso',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón',
		address: 'Rúa Principal, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 150,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),
	fac({
		key: 'vilarino-sala',
		municipality: 'vilarino-de-conso',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Casa do Concello',
		address: 'Praza do Concello, 1',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── A Veiga ───────────────────────────────────────────────────────────────
	fac({
		key: 'veiga-polideportiva',
		municipality: 'a-veiga',
		sport: 'polideportiva',
		name: 'Pista polideportiva',
		location: 'Pista exterior',
		address: 'Rúa da Igrexa, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Pista de uso libre: reserva para asegurar a túa hora.',
		hours: H_TARDE,
		demand: 'aire-libre'
	}),
	fac({
		key: 'veiga-bolos',
		municipality: 'a-veiga',
		sport: 'bolos',
		name: 'Bolera municipal',
		location: 'Campo da festa',
		address: 'Rúa da Igrexa, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 100,
		rules: 'Bolos e bolas no local social. Devólveos ao rematar.',
		hours: merge(
			days(WEEK, ['17:00', '21:00']),
			days(WEEKEND, ['10:00', '14:00'], ['16:00', '21:00'])
		),
		demand: 'fronton'
	}),
	fac({
		key: 'veiga-sala',
		municipality: 'a-veiga',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Local social',
		address: 'Praza do Concello, 1',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── O Bolo ────────────────────────────────────────────────────────────────
	fac({
		key: 'bolo-pavillon',
		municipality: 'o-bolo',
		sport: 'pavillon',
		name: 'Pavillón municipal',
		location: 'Pavillón municipal',
		address: 'Rúa do Castelo, 5',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1000,
		priceNonResidentCents: 2000,
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'bolo-padel',
		municipality: 'o-bolo',
		sport: 'padel',
		name: 'Pista de pádel',
		location: 'Xunto ao pavillón',
		address: 'Rúa do Castelo, 5',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 90,
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'bolo-fronton',
		municipality: 'o-bolo',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón',
		address: 'Rúa do Castelo, 7',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 150,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),

	// ── Petín ─────────────────────────────────────────────────────────────────
	fac({
		key: 'petin-futbol',
		municipality: 'petin',
		sport: 'futbol',
		name: 'Campo de fútbol municipal',
		location: 'Campo municipal',
		address: 'Estrada Xeral, s/n',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 2000,
		priceNonResidentCents: 3500,
		accessible: false,
		rules: RULES_CAMPO,
		hours: H_CAMPO,
		demand: 'campo'
	}),
	fac({
		key: 'petin-padel',
		municipality: 'petin',
		sport: 'padel',
		name: 'Pista de pádel',
		location: 'Xunto ao campo',
		address: 'Estrada Xeral, s/n',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 90,
		priceResidentCents: 350,
		priceNonResidentCents: 600,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'petin-polideportiva',
		municipality: 'petin',
		sport: 'polideportiva',
		name: 'Pista polideportiva',
		location: 'Pista exterior',
		address: 'Rúa Nova, 3',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Pista de uso libre: reserva para asegurar a túa hora.',
		hours: H_TARDE,
		demand: 'aire-libre'
	}),

	// ── Larouco ───────────────────────────────────────────────────────────────
	fac({
		key: 'larouco-polideportiva',
		municipality: 'larouco',
		sport: 'polideportiva',
		name: 'Pista polideportiva',
		location: 'Pista exterior',
		address: 'Rúa da Escola, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: 'Pista de uso libre: reserva para asegurar a túa hora.',
		hours: H_TARDE,
		demand: 'aire-libre'
	}),
	fac({
		key: 'larouco-fronton',
		municipality: 'larouco',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón',
		address: 'Rúa da Escola, s/n',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 150,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),
	fac({
		key: 'larouco-sala',
		municipality: 'larouco',
		sport: 'sala',
		name: 'Sala de usos múltiples',
		location: 'Local social',
		address: 'Praza do Concello, 1',
		bookingMode: 'day',
		slotMinutes: 60,
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		rules: RULES_SALA,
		hours: H_SALA,
		demand: 'sala'
	}),

	// ── Verín ─────────────────────────────────────────────────────────────────
	fac({
		key: 'verin-pavillon',
		municipality: 'verin',
		sport: 'pavillon',
		name: 'Pavillón municipal',
		location: 'Pavillón municipal',
		address: 'Avenida de Castela, 20',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 1800,
		priceNonResidentCents: 3500,
		rules: RULES_PAVILLON,
		hours: H_PAVILLON,
		demand: 'pavillon'
	}),
	fac({
		key: 'verin-piscina',
		municipality: 'verin',
		sport: 'piscina',
		name: 'Piscina climatizada',
		location: 'Piscina climatizada',
		address: 'Rúa do Támega, 8',
		bookingMode: 'unit',
		units: 3,
		slotMinutes: 60,
		priceResidentCents: 300,
		priceNonResidentCents: 550,
		rules: RULES_PISCINA,
		hours: H_PISCINA_CUBERTA,
		demand: 'piscina-cuberta'
	}),
	fac({
		key: 'verin-padel',
		municipality: 'verin',
		sport: 'padel',
		name: 'Pistas de pádel',
		location: 'Complexo deportivo',
		address: 'Avenida de Castela, 22',
		bookingMode: 'unit',
		units: 2,
		slotMinutes: 90,
		priceResidentCents: 450,
		priceNonResidentCents: 800,
		rules: RULES_PADEL,
		hours: H_PADEL,
		demand: 'padel'
	}),
	fac({
		key: 'verin-futbol',
		municipality: 'verin',
		sport: 'futbol',
		name: 'Campo de fútbol de herba artificial',
		location: 'Complexo deportivo',
		address: 'Avenida de Castela, 22',
		bookingMode: 'slot',
		slotMinutes: 90,
		priceResidentCents: 3000,
		priceNonResidentCents: 5000,
		rules: RULES_CAMPO,
		hours: H_CAMPO,
		demand: 'campo'
	}),
	fac({
		key: 'verin-fronton',
		municipality: 'verin',
		sport: 'fronton',
		name: 'Frontón municipal',
		location: 'Frontón cuberto',
		address: 'Rúa do Frontón, 1',
		bookingMode: 'slot',
		slotMinutes: 60,
		priceResidentCents: 200,
		priceNonResidentCents: 400,
		rules: RULES_FRONTON,
		hours: H_TARDE,
		demand: 'fronton'
	}),
	fac({
		key: 'verin-squash',
		municipality: 'verin',
		sport: 'squash',
		name: 'Pistas de squash',
		location: 'Complexo deportivo',
		address: 'Avenida de Castela, 22',
		bookingMode: 'unit',
		units: 1,
		slotMinutes: 60,
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		rules: 'Calzado de sala de sola clara. Lentes protectoras recomendadas.',
		hours: H_TARDE,
		demand: 'raqueta'
	}),
	fac({
		key: 'verin-ximnasio',
		municipality: 'verin',
		sport: 'ximnasio',
		name: 'Ximnasio municipal',
		location: 'Pavillón municipal',
		address: 'Avenida de Castela, 20',
		bookingMode: 'capacity',
		capacity: 6,
		slotMinutes: 60,
		priceResidentCents: 200,
		priceNonResidentCents: 400,
		rules: RULES_XIMNASIO,
		hours: H_XIMNASIO,
		demand: 'ximnasio'
	})
];

/** Reservas de temporada dos clubs: un tramo os días da semana indicados (0 = luns), de outubro a xuño. */
export type DemoSeason = {
	facility: string;
	entityName: string;
	weekdays: number[];
	startsTime: string;
	endsTime: string;
};

export const DEMO_SEASONS: DemoSeason[] = [
	{
		facility: 'viana-futbol',
		entityName: 'CD Viana — adestramento',
		weekdays: [1, 3],
		startsTime: '19:00',
		endsTime: '20:30'
	},
	{
		facility: 'viana-pavillon',
		entityName: 'Escola de baloncesto de Viana',
		weekdays: [1, 3],
		startsTime: '17:30',
		endsTime: '19:00'
	}
];

export type DemoProvider = 'clave' | 'chave365';

export type DemoStaff = {
	subject: string;
	provider: DemoProvider;
	name: string;
	municipality: DemoSlug;
	role: 'admin' | 'conserxe' | 'apertura';
};

const staff = (n: number, municipality: DemoSlug, admin: string, conserxe: string): DemoStaff[] => [
	{
		subject: `DEMO-S${String(2 * n + 1).padStart(2, '0')}`,
		provider: 'clave',
		name: admin,
		municipality,
		role: 'admin'
	},
	{
		subject: `DEMO-S${String(2 * n + 2).padStart(2, '0')}`,
		provider: 'chave365',
		name: conserxe,
		municipality,
		role: 'conserxe'
	}
];

/** Unha administradora e un conserxe por concello; nomes ficticios. */
export const DEMO_STAFF: DemoStaff[] = [
	...staff(0, 'viana-do-bolo', 'Amalia Carballal', 'Baltasar Gesto'),
	...staff(1, 'a-rua', 'Anselmo Vilariño', 'Ermitas Valcarce'),
	...staff(2, 'o-barco-de-valdeorras', 'Rosalía Brandariz', 'Gaspar Losada'),
	...staff(3, 'a-pobra-de-trives', 'Bieito Sampaio', 'Comba Míguez'),
	...staff(4, 'manzaneda', 'Ánxela Novoa', 'Xurxo Bouzas'),
	...staff(5, 'vilarino-de-conso', 'Tareixa Folgueira', 'Estevo Sobrado'),
	...staff(6, 'a-veiga', 'Ledicia Moure', 'Tomé Requejo'),
	...staff(7, 'o-bolo', 'Branca Fidalgo', 'Rubén Bello'),
	...staff(8, 'petin', 'Xoana Lamas', 'Simón Riveiro'),
	...staff(9, 'larouco', 'Icía Conde', 'Antón Carbia'),
	...staff(10, 'verin', 'Mencía Taboada', 'Fiz Rodicio')
];

export const DEMO_DEPUTACION = {
	subject: 'DEMO-D01',
	provider: 'clave',
	name: 'Celia Rivas'
} as const;
