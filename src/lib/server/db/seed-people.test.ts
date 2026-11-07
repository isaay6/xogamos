// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { DEMO_DEPUTACION, DEMO_NEIGHBOURS, DEMO_SLUGS, DEMO_STAFF } from './seed-data';
import { DEMO_PEOPLE, generateDemoPeople } from './seed-people';

describe('veciños xerados', () => {
	it('arredor de 1000 persoas (≈ 1 reserva por semana cada unha), con nomes únicos', () => {
		expect(DEMO_PEOPLE).toHaveLength(1003);
		const names = new Set(DEMO_PEOPLE.map((p) => p.name));
		expect(names.size).toBe(DEMO_PEOPLE.length);
		const staffNames = new Set([...DEMO_STAFF.map((s) => s.name), DEMO_DEPUTACION.name]);
		for (const p of DEMO_PEOPLE) expect(staffNames.has(p.name), p.name).toBe(false);
	});

	it('é determinista', () => {
		expect(generateDemoPeople()).toEqual(DEMO_PEOPLE.slice(0, -4));
	});

	it('engade ao final os casos variados da demostración e da apertura', () => {
		expect(DEMO_PEOPLE.slice(-4).map((person) => person.name)).toEqual([
			'Celestino Arias Fervenza',
			'Telmo Quiroga Busto',
			'Rebeca Viñas Toimil',
			'Policía Local de Viana'
		]);
		expect(DEMO_PEOPLE.at(-4)?.accessibility).toEqual({ textSize: 'large', easyBooking: true });
		expect(DEMO_PEOPLE.at(-3)?.profiles['viana-do-bolo']).toBe(false);
	});

	it('nomes galegos con dous apelidos, salvo as identidades con nome', () => {
		for (const p of DEMO_PEOPLE.filter((x) => !x.featured)) {
			expect(p.name.split(' ').length, p.name).toBeGreaterThanOrEqual(3);
		}
	});

	it('Nerea Cabaleiro: empadroada en Viana do Bolo e non empadroada en A Rúa', () => {
		const uxia = DEMO_PEOPLE.find((p) => p.name === 'Nerea Cabaleiro')!;
		expect(uxia.profiles).toEqual({ 'viana-do-bolo': true, 'a-rua': false });
		expect(uxia.featured).toBe(true);
		expect(DEMO_PEOPLE[0]).toBe(uxia);
	});

	it('non usa palabras prohibidas nos nomes da demo nin do persoal', () => {
		const forbidden = new Set([
			'Alba',
			'Antía',
			'Anxo',
			'Barreiro',
			'Brais',
			'Breixo',
			'Calvo',
			'Carla',
			'Carme',
			'Castro',
			'Celso',
			'Couto',
			'Daniel',
			'Doval',
			'Ferreiro',
			'Freire',
			'Graña',
			'Hugo',
			'Iago',
			'Iglesias',
			'Iria',
			'Lago',
			'Lois',
			'Lorenzo',
			'Lucía',
			'Manuel',
			'Martiño',
			'Maruxa',
			'Mosquera',
			'Méndez',
			'Noa',
			'Olalla',
			'Otero',
			'Outeiro',
			'Pablo',
			'Pena',
			'Pilar',
			'Piñeiro',
			'Ramón',
			'Rey',
			'Rial',
			'Roi',
			'Rosa',
			'Sabela',
			'Seoane',
			'Souto',
			'Uxía',
			'Varela',
			'Vidal',
			'Vilar',
			'Xabier',
			'Xiana',
			'Xosé'
		]);
		for (const person of [...DEMO_PEOPLE, ...DEMO_STAFF, DEMO_DEPUTACION]) {
			for (const word of person.name.split(' '))
				expect(forbidden.has(word), person.name).toBe(false);
		}
	});

	it('cada persoa ten perfil no seu concello e os extra son veciños e non empadroados', () => {
		let multi = 0;
		for (const p of DEMO_PEOPLE) {
			expect(p.profiles[p.home]).toBeDefined();
			const extra = Object.keys(p.profiles).filter((s) => s !== p.home);
			if (extra.length > 0) multi++;
			expect(extra.length).toBeLessThanOrEqual(2);
			for (const s of extra) {
				expect(p.profiles[s as (typeof DEMO_SLUGS)[number]]).toBe(false);
				if (!p.featured) expect(DEMO_NEIGHBOURS[p.home]).toContain(s);
			}
		}
		const share = multi / DEMO_PEOPLE.length;
		expect(share).toBeGreaterThan(0.1);
		expect(share).toBeLessThan(0.2);
	});

	it('arredor do 70 % dos perfís de cada concello están empadroados', () => {
		for (const slug of DEMO_SLUGS) {
			const profiles = DEMO_PEOPLE.filter((p) => slug in p.profiles);
			expect(profiles.length, slug).toBeGreaterThanOrEqual(10);
			const residents = profiles.filter((p) => p.profiles[slug]).length;
			const share = residents / profiles.length;
			expect(share, slug).toBeGreaterThan(0.55);
			expect(share, slug).toBeLessThan(0.85);
		}
	});

	it('contacto ficticio: metade aprox. con correo ou teléfono', () => {
		const withContact = DEMO_PEOPLE.filter((p) => p.email || p.phone).length;
		expect(withContact / DEMO_PEOPLE.length).toBeGreaterThan(0.4);
		expect(withContact / DEMO_PEOPLE.length).toBeLessThan(0.6);
		for (const p of DEMO_PEOPLE) {
			if (p.email) expect(p.email).toMatch(/^[a-z0-9.]+@example\.org$/);
			if (p.phone) expect(p.phone).toMatch(/^600 00\d \d{3}$/);
		}
		const phones = DEMO_PEOPLE.flatMap((p) => (p.phone ? [p.phone] : []));
		expect(new Set(phones).size).toBe(phones.length);
		const emails = DEMO_PEOPLE.flatMap((p) => (p.email ? [p.email] : []));
		expect(new Set(emails).size).toBe(emails.length);
	});
});
