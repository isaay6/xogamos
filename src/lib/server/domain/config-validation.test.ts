// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { validateFacility, validateHours } from './config-validation';

const h = (weekday: number, opens: string, closes: string) => ({
	weekday,
	opens,
	closes
});
const ok = {
	slotMinutes: 60,
	units: 1,
	capacity: 1,
	prices: [300, 600],
	mode: 'slot' as const
};

describe('validateHours', () => {
	it('acepta horarios correctos, también tramos contiguos', () => {
		expect(validateHours([h(0, '09:00', '14:00'), h(0, '14:00', '22:00')], 'slot', 60)).toEqual([]);
	});
	it('en modo day, dos tramos el mismo día es un problema', () => {
		expect(validateHours([h(1, '09:00', '12:00'), h(1, '16:00', '20:00')], 'day', 60)).not.toEqual(
			[]
		);
		expect(validateHours([h(1, '09:00', '12:00'), h(2, '16:00', '20:00')], 'day', 60)).toEqual([]);
	});
	it('dos tramos solapados es un problema', () => {
		expect(validateHours([h(3, '09:00', '13:00'), h(3, '12:00', '15:00')], 'slot', 60)).not.toEqual(
			[]
		);
	});
	it('en franjas de 60, un tramo de 09:00 a 21:30 es un problema', () => {
		expect(validateHours([h(0, '09:00', '21:30')], 'slot', 60)).not.toEqual([]);
	});
	it('un tramo que no cierra después de abrir es un problema', () => {
		expect(validateHours([h(0, '10:00', '10:00')], 'slot', 60)).not.toEqual([]);
	});
});

describe('validateFacility', () => {
	it('acepta una configuración correcta', () => {
		expect(validateFacility(ok)).toEqual([]);
	});
	it.each([0, 7, 2000])('slotMinutes %i es un problema', (slotMinutes) => {
		expect(validateFacility({ ...ok, slotMinutes })).not.toEqual([]);
	});
	it('slotMinutes debe ser múltiplo de 15', () => {
		expect(validateFacility({ ...ok, slotMinutes: 20 })).not.toEqual([]);
		expect(validateFacility({ ...ok, slotMinutes: 90 })).toEqual([]);
	});
	it('en modo unit, units=1 es un problema', () => {
		expect(validateFacility({ ...ok, mode: 'unit', units: 1 })).not.toEqual([]);
		expect(validateFacility({ ...ok, mode: 'unit', units: 3 })).toEqual([]);
	});
	it('en modo capacity, capacity=1 es un problema', () => {
		expect(validateFacility({ ...ok, mode: 'capacity', capacity: 1 })).not.toEqual([]);
		expect(validateFacility({ ...ok, mode: 'capacity', capacity: 12 })).toEqual([]);
	});
	it('en slot y day, units y capacity deben ser 1', () => {
		expect(validateFacility({ ...ok, units: 2 })).not.toEqual([]);
		expect(validateFacility({ ...ok, mode: 'day', capacity: 4 })).not.toEqual([]);
	});
	it('los precios son enteros entre 0 y 100000', () => {
		expect(validateFacility({ ...ok, prices: [-1, 0] })).not.toEqual([]);
		expect(validateFacility({ ...ok, prices: [0, 100001] })).not.toEqual([]);
		expect(validateFacility({ ...ok, prices: [1.5, 0] })).not.toEqual([]);
		expect(validateFacility({ ...ok, prices: [0, 100000] })).toEqual([]);
	});
});
