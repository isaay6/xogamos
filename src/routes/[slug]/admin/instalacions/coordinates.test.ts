// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { parseFacilityForm } from './form';
import { FacilityBody } from '../../../api/v1/m/[slug]/admin/admin-schemas';

const types = [{ id: '11111111-1111-4111-8111-111111111111', bookingMode: 'slot' as const }];
const form = (coordinates: Record<string, string>) => {
	const values = new FormData();
	for (const [name, value] of Object.entries({
		typeId: types[0].id,
		name: 'Pista de proba',
		location: '',
		address: '',
		slotMinutes: '60',
		priceResident: '3',
		priceNonResident: '4',
		rules: '',
		...coordinates
	}))
		values.set(name, value);
	return values;
};

describe('coordenadas no formulario de instalación', () => {
	it('acepta coordenadas WGS84 opcionais dentro do rango', () => {
		const result = parseFacilityForm(form({ latitude: '42.34', longitude: '-7.86' }), types);
		expect(result).toMatchObject({ input: { latitude: 42.34, longitude: -7.86 } });
	});

	it('rexeita latitudes e lonxitudes fóra de rango', () => {
		expect(parseFacilityForm(form({ latitude: '91', longitude: '0' }), types)).toEqual({
			error: 'INVALID'
		});
		expect(parseFacilityForm(form({ latitude: '0', longitude: '-181' }), types)).toEqual({
			error: 'INVALID'
		});
	});

	it('o esquema Zod da API aplica os mesmos límites', () => {
		const base = {
			typeId: types[0].id,
			name: 'Pista',
			location: '',
			address: '',
			units: 1,
			capacity: 1,
			slotMinutes: 60,
			priceResidentCents: 0,
			priceNonResidentCents: 0,
			accessible: false,
			rules: ''
		};
		expect(FacilityBody.safeParse({ ...base, latitude: 42, longitude: -8 }).success).toBe(true);
		expect(FacilityBody.safeParse({ ...base, latitude: 90.01 }).success).toBe(false);
		expect(FacilityBody.safeParse({ ...base, longitude: -180.01 }).success).toBe(false);
	});
});
