// SPDX-License-Identifier: EUPL-1.2
// Identidades ficticias del simulador: una por cada persoa, persoal e deputación da demo.
// As destacadas (nome propio da guía, persoal e Deputación) van primeiro.
import {
	DEMO_DEPUTACION,
	DEMO_SLUGS,
	DEMO_STAFF,
	demoMunicipalityName,
	ofMunicipality
} from '../db/seed-data';
import { DEMO_PEOPLE } from '../db/seed-people';

export type SimulatedIdentity = {
	provider: 'clave' | 'chave365';
	subject: string;
	displayName: string;
	email: string | null;
	note: string;
	/** Sae arriba, en «Persoas destacadas». */
	featured: boolean;
};

const ROLE_NOTE: Record<(typeof DEMO_STAFF)[number]['role'], string> = {
	admin: 'Administración',
	conserxe: 'Conserxería',
	apertura: 'Apertura'
};

const people = DEMO_PEOPLE.map((p) => ({
	provider: p.provider,
	subject: p.subject,
	displayName: p.name,
	email: p.email,
	note: DEMO_SLUGS.filter((slug) => slug in p.profiles)
		.map(
			(slug) => `${demoMunicipalityName(slug)} (empadroamento: ${p.profiles[slug] ? 'si' : 'non'})`
		)
		.join(', '),
	featured: p.featured
}));

export const SIMULATED_IDENTITIES: SimulatedIdentity[] = [
	// Isay Rodríguez vai o primeiro: é o perfil mestre para probar todo.
	...people.filter((p) => p.featured && p.displayName === 'Isay Rodríguez'),
	// Despois as demais destacadas na orde de DEMO_PEOPLE (a Policía Local vai ao final).
	...people.filter((p) => p.featured && p.displayName !== 'Isay Rodríguez'),
	...DEMO_STAFF.map((s) => ({
		provider: s.provider,
		subject: s.subject,
		displayName: s.name,
		email: null,
		note: `${ROLE_NOTE[s.role]} ${ofMunicipality(s.municipality)}`,
		featured: true
	})),
	{
		provider: DEMO_DEPUTACION.provider,
		subject: DEMO_DEPUTACION.subject,
		displayName: DEMO_DEPUTACION.name,
		email: null,
		note: 'Deputación de Ourense',
		featured: true
	},
	...people
		.filter((p) => !p.featured)
		.sort((a, b) => a.displayName.localeCompare(b.displayName, 'gl'))
];
