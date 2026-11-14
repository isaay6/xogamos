// SPDX-License-Identifier: EUPL-1.2
// Veciños ficticios da demo: nomes galegos combinados ao chou (con semente fixa) a partir de
// listas de nomes e apelidos comúns. Ningún corresponde a propósito a unha persoa real.
import {
	DEMO_DEPUTACION,
	DEMO_NEIGHBOURS,
	DEMO_STAFF,
	DEMO_SUBJECT_PREFIX,
	type DemoProvider,
	type DemoSlug
} from './seed-data';
import { AVATARS, type AvatarKey } from '../../avatars';
import { dniLetter } from '../domain/dni';
import type { SocialTariff } from '../domain/policies';
import { pick, prng } from './seed-random';

export type DemoPerson = {
	name: string;
	subject: string;
	provider: DemoProvider;
	email: string | null;
	phone: string | null;
	/** Concello onde vive (sempre ten perfil nel). */
	home: DemoSlug;
	/** Perfil en cada concello: true = empadroado, false = non empadroado. */
	profiles: Partial<Record<DemoSlug, boolean>>;
	/** Canto reserva (peso relativo para o xerador de reservas). */
	activity: number;
	/** Identidade con nome propio da guía e do simulador. */
	featured: boolean;
	/** Axustes de accesibilidade visibles nos casos guiados da demo. */
	accessibility?: { textSize?: 'normal' | 'large' | 'very_large'; easyBooking?: boolean };
};

const FEMALE = [
	'Aroa',
	'Mencía',
	'Xela',
	'Elba',
	'Aldara',
	'Lúa',
	'Rebeca',
	'Mariña',
	'Lía',
	'Celia',
	'Olaia',
	'Icía',
	'Branca',
	'Xoana',
	'Ledicia',
	'Comba',
	'Eva',
	'Zeltia',
	'Sara',
	'Paula',
	'Marta',
	'Laura',
	'Ánxela',
	'Rut',
	'Tareixa',
	'Xulia',
	'Nerea',
	'Candela',
	'Martina',
	'Helena',
	'Irene',
	'Inés',
	'Clara',
	'Rocío',
	'Begoña',
	'Bárbara',
	'Lara',
	'Brenda',
	'Maia',
	'Adega'
];
const MALE = [
	'Telmo',
	'Hadrián',
	'Xil',
	'Xermán',
	'Paio',
	'Gumersindo',
	'Celestino',
	'Artai',
	'Antón',
	'Anselmo',
	'Gaspar',
	'Xandre',
	'Xan',
	'Uxío',
	'Rubén',
	'Fiz',
	'Pedro',
	'Diego',
	'Bieito',
	'Damán',
	'Adrián',
	'Xurxo',
	'Xacobe',
	'Óscar',
	'Alexandre',
	'Xaime',
	'Nicolás',
	'Mateo',
	'Martín',
	'Xoel',
	'Bernardo',
	'Andrés',
	'Gonzalo',
	'Miguel',
	'Carlos',
	'Iván',
	'Simón',
	'Tomé',
	'Estevo',
	'Roque'
];
const SURNAMES = [
	'Cabaleiro',
	'Pombal',
	'Pazos',
	'Pazó',
	'Cuíña',
	'Rouco',
	'Fervenza',
	'Penedo',
	'Toimil',
	'Casal',
	'Busto',
	'Brandariz',
	'Mato',
	'Valcarce',
	'Fraga',
	'Neira',
	'Louzao',
	'Miranda',
	'Fernández',
	'González',
	'Rodríguez',
	'López',
	'Pérez',
	'Álvarez',
	'Blanco',
	'Dacosta',
	'Domínguez',
	'Nogueira',
	'Prieto',
	'Patiño',
	'Vázquez',
	'Mouriño',
	'Gil',
	'Diéguez',
	'Quiroga',
	'Arias',
	'Novoa',
	'Taboada',
	'Sampaio',
	'Cid',
	'Rodicio',
	'Conde',
	'Vilariño',
	'Sanmartín',
	'Míguez',
	'Bouzas',
	'Carbia',
	'Teijeiro',
	'Riveira',
	'Lamas',
	'Folgueira',
	'Moure',
	'Riveiro',
	'Sobrado',
	'Requejo',
	'Fidalgo',
	'Losada',
	'Martínez',
	'Gómez',
	'Sánchez',
	'Morais',
	'Rañal',
	'Salgueiro',
	'Carballo',
	'Veiga',
	'Outeiriño',
	'Gulías',
	'Alonso',
	'Garrido',
	'Somoza'
];

/** Veciños xerados por concello (os de nome propio van á parte). */
const PEOPLE_PER_MUNICIPALITY: Record<DemoSlug, number> = {
	'viana-do-bolo': 160,
	verin: 190,
	'o-barco-de-valdeorras': 190,
	'a-rua': 130,
	'a-pobra-de-trives': 80,
	manzaneda: 45,
	petin: 45,
	'o-bolo': 45,
	'a-veiga': 40,
	'vilarino-de-conso': 35,
	larouco: 35
};

/** Identidades con nome propio: van primeiro (Nerea é DEMO-1). */
const FEATURED: Pick<DemoPerson, 'name' | 'home' | 'profiles'>[] = [
	{
		name: 'Nerea Cabaleiro',
		home: 'viana-do-bolo',
		profiles: { 'viana-do-bolo': true, 'a-rua': false }
	},
	{ name: 'Olaia Pazó', home: 'a-veiga', profiles: { 'a-veiga': true, 'viana-do-bolo': false } },
	{
		name: 'Cibrán Ventosela',
		home: 'viana-do-bolo',
		profiles: { 'viana-do-bolo': true, 'a-rua': false, verin: false }
	}
];

const XOAN: Pick<DemoPerson, 'name' | 'home' | 'profiles'> = {
	name: 'Hadrián Seixo Mouriño',
	home: 'a-rua',
	profiles: { 'a-rua': true, 'viana-do-bolo': false }
};

/** Subject ficticio de cada persoa (DEMO-1 …) e proveedor: a terceira parte entra con Chave365. */
export const demoPersonSubject = (index: number) => `${DEMO_SUBJECT_PREFIX}${index + 1}`;
export const demoPersonProvider = (index: number): DemoProvider =>
	index % 3 === 2 ? 'chave365' : 'clave';

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function generateDemoPeople(): DemoPerson[] {
	const rand = prng(20261022);
	const taken = new Set<string>([
		...FEATURED.map((f) => f.name),
		XOAN.name,
		...DEMO_STAFF.map((s) => s.name),
		DEMO_DEPUTACION.name
	]);
	const emails = new Set<string>();
	const people: DemoPerson[] = FEATURED.map((f, i) => ({
		...f,
		subject: demoPersonSubject(i),
		// Cibrán Ventosela (o perfil de probas con todos os papeis) entra sempre por Cl@ve.
		provider: f.name === 'Cibrán Ventosela' ? 'clave' : demoPersonProvider(i),
		email: null,
		phone: null,
		activity: 1,
		featured: true
	}));

	for (const [home, count] of Object.entries(PEOPLE_PER_MUNICIPALITY) as [DemoSlug, number][]) {
		for (let n = 0; n < count; n++) {
			const index = people.length;
			let first: string;
			let s1: string;
			let name: string;
			do {
				first = pick(rand, rand() < 0.5 ? FEMALE : MALE);
				s1 = pick(rand, SURNAMES);
				let s2 = pick(rand, SURNAMES);
				while (s2 === s1) s2 = pick(rand, SURNAMES);
				name = `${first} ${s1} ${s2}`;
			} while (taken.has(name));
			taken.add(name);

			// O empadroamento do concello propio decídese despois, cando se coñecen todos os perfís.
			const profiles: Partial<Record<DemoSlug, boolean>> = { [home]: true };
			if (rand() < 0.15) {
				const options = [...DEMO_NEIGHBOURS[home]];
				const extra = options.length > 1 && rand() < 0.4 ? 2 : 1;
				for (let k = 0; k < extra; k++) {
					const at = Math.floor(rand() * options.length);
					profiles[options.splice(at, 1)[0]] = false;
				}
			}

			let email: string | null = null;
			let phone: string | null = null;
			if (rand() < 0.5) {
				const kind = rand();
				if (kind < 0.7) {
					let local = `${ascii(first)}.${ascii(s1)}`;
					if (emails.has(local)) local = `${local}${index}`;
					emails.add(local);
					email = `${local}@example.org`;
				}
				if (kind >= 0.4) {
					const n = String(index).padStart(4, '0');
					phone = `600 00${n.slice(0, 1)} ${n.slice(1)}`;
				}
			}

			people.push({
				name,
				subject: demoPersonSubject(index),
				provider: demoPersonProvider(index),
				email,
				phone,
				home,
				profiles,
				activity: 0.3 + 2.7 * rand() ** 2,
				featured: false
			});
		}
	}

	// Arredor do 70 % dos perfís de cada concello, empadroados: os perfís extra non o están,
	// así que se escollen ao chou os veciños da casa que si o están.
	for (const slug of Object.keys(PEOPLE_PER_MUNICIPALITY) as DemoSlug[]) {
		const total = people.filter((p) => slug in p.profiles).length;
		const homes = people.filter((p) => p.home === slug && !p.featured);
		const fixed = people.filter((p) => p.home === slug && p.featured).length;
		const wanted = Math.max(0, Math.round(total * 0.7) - fixed);
		const order = homes.map((p) => ({ p, k: rand() })).sort((a, b) => a.k - b.k);
		order.forEach(({ p }, i) => (p.profiles[slug] = i < wanted));
	}

	// Ao final para non mover a ninguén: a persoa que chama por teléfono da busca por DNI
	// (mockup busca-dni), veciña de A Rúa e non empadroada en Viana do Bolo.
	people.push({
		...XOAN,
		subject: demoPersonSubject(people.length),
		provider: demoPersonProvider(people.length),
		email: null,
		phone: `600 00${String(people.length).padStart(4, '0').slice(0, 1)} ${String(people.length).padStart(4, '0').slice(1)}`,
		// Sen reservas xeradas: así o resto da historia queda igual que antes de engadilo.
		activity: 0,
		featured: true
	});
	return people;
}

// Estes casos van ao final: hai probas e historias que usan os índices das persoas anteriores.
const STORY_PEOPLE: DemoPerson[] = [
	{
		name: 'Celestino Arias Fervenza',
		subject: '',
		provider: 'clave',
		email: 'celestino.arias@example.org',
		phone: '600 009 901',
		home: 'viana-do-bolo',
		profiles: { 'viana-do-bolo': true },
		activity: 0,
		featured: false,
		accessibility: { textSize: 'large', easyBooking: true }
	},
	{
		name: 'Telmo Quiroga Busto',
		subject: '',
		provider: 'chave365',
		email: 'telmo.quiroga@example.org',
		phone: '600 009 902',
		home: 'a-rua',
		profiles: { 'a-rua': true, 'viana-do-bolo': false },
		activity: 0,
		featured: false
	},
	{
		name: 'Rebeca Viñas Toimil',
		subject: '',
		provider: 'clave',
		email: 'rebeca.vinas@example.org',
		phone: '600 009 903',
		home: 'viana-do-bolo',
		profiles: { 'viana-do-bolo': true },
		activity: 0,
		featured: false
	}
];

/** Perfil da Policía Local que abre as pistas no inverno; nome e DNI son ficticios. */
const OPENING_PERSON: DemoPerson = {
	name: 'Policía Local de Viana',
	subject: '',
	provider: 'clave',
	email: null,
	phone: '600 009 904',
	home: 'viana-do-bolo',
	profiles: { 'viana-do-bolo': true },
	activity: 0,
	featured: true
};

const GENERATED_DEMO_PEOPLE = generateDemoPeople();

export const DEMO_PEOPLE: DemoPerson[] = [
	...GENERATED_DEMO_PEOPLE,
	...STORY_PEOPLE.map((person, index) => ({
		...person,
		subject: demoPersonSubject(GENERATED_DEMO_PEOPLE.length + index),
		provider: demoPersonProvider(GENERATED_DEMO_PEOPLE.length + index)
	})),
	{
		...OPENING_PERSON,
		subject: demoPersonSubject(GENERATED_DEMO_PEOPLE.length + STORY_PEOPLE.length),
		provider: demoPersonProvider(GENERATED_DEMO_PEOPLE.length + STORY_PEOPLE.length)
	}
];

/**
 * Avatar de cada persoa: Nerea (a primeira) ten `muller-lentes`; ao redor do 40 % do resto ten
 * un, repartidos polo catálogo enteiro (persoas, nenos e deportes) cun paso coprimo co seu tamaño.
 */
export function demoAvatarKey(index: number): AvatarKey | null {
	if (index === 0) return 'muller-lentes';
	return index % 5 === 1 || index % 5 === 3 ? AVATARS[(index * 7) % AVATARS.length] : null;
}

/** Perfís non empadroados (non verificados) con declaración feita: tarefa para a conserxaría. */
export const DEMO_DECLARATIONS = 3;

/**
 * DNI ficticios (con letra válida) das persoas con nome propio, para probar a busca do mostrador.
 * Na base só se garda o seu hash. O de Hadrián é o do mockup `busca-dni.html`.
 */
export const DEMO_DNIS: Record<string, string> = {
	'Nerea Cabaleiro': '44556677L',
	'Olaia Pazó': '33221144J',
	'Hadrián Seixo Mouriño': '34987654P',
	'Policía Local de Viana': '12345678Z'
};

/** DNI ficticio, válido e único de cada persoa da demo (determinista; os destacados, fixos). */
export function generateDemoDnis(people: DemoPerson[] = DEMO_PEOPLE): string[] {
	const rand = prng(20261023);
	const used = new Set(Object.values(DEMO_DNIS));
	return people.map((p) => {
		const fixed = DEMO_DNIS[p.name];
		if (fixed) return fixed;
		let dni: string;
		do {
			const n = 10_000_000 + Math.floor(rand() * 89_999_999);
			dni = `${n}${dniLetter(n)}`;
		} while (used.has(dni));
		used.add(dni);
		return dni;
	});
}

/** Tarifas sociais da demo (por nome e concello): tres de Viana do Bolo e Hadrián, de fóra. */
export const DEMO_SOCIAL_TARIFFS: { name: string; slug: DemoSlug; tariff: SocialTariff }[] = [
	{ name: 'Antón Cid Dacosta', slug: 'viana-do-bolo', tariff: 'maior' },
	{ name: 'Martín Pazos Diéguez', slug: 'viana-do-bolo', tariff: 'xove' },
	{ name: 'Olaia Pazos Rañal', slug: 'viana-do-bolo', tariff: 'familia' },
	{ name: 'Hadrián Seixo Mouriño', slug: 'viana-do-bolo', tariff: 'maior' },
	{ name: 'Celestino Arias Fervenza', slug: 'viana-do-bolo', tariff: 'maior' },
	{ name: 'Rebeca Viñas Toimil', slug: 'viana-do-bolo', tariff: 'familia' }
];

/** Tarifa social de cada perfil, por `índice|concello`. */
export const DEMO_TARIFF_OF: Map<string, SocialTariff> = new Map(
	DEMO_SOCIAL_TARIFFS.map((t) => {
		const index = DEMO_PEOPLE.findIndex((p) => p.name === t.name);
		if (index < 0 || !(t.slug in DEMO_PEOPLE[index].profiles)) {
			throw new Error(`demo social tariff without profile: ${t.name} (${t.slug})`);
		}
		return [`${index}|${t.slug}`, t.tariff];
	})
);
