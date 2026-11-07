// SPDX-License-Identifier: EUPL-1.2
// Modelos del asistente de nueva instalación: lo habitual de cada tipo para no empezar de cero.
// Todo se puede cambiar en los pasos siguientes. Los horarios encajan con la duración de la reserva.
import { MASCOT_FAMILY, type Mascot } from '../../mascots';
import type { BookingMode, Hours } from '../domain/types';

export const TEMPLATE_KEYS = [
	'pavillon',
	'padel',
	'piscina',
	'futbol',
	'fronton',
	'ximnasio',
	'sala'
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type FacilityTemplate = {
	key: TemplateKey;
	mascot: Mascot;
	/** Nombre del tipo nuevo cuando no hay uno igual en el concello. */
	typeName: { gl: string; es: string };
	bookingMode: BookingMode;
	slotMinutes: number;
	units: number;
	capacity: number;
	hours: Hours[];
	priceResidentCents: number;
	priceNonResidentCents: number;
	priceSocialCents: number | null;
};

type Range = [string, string];
const WEEK = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6];

/** Mismos tramos para varios días (0 = luns … 6 = domingo). */
const days = (list: number[], ...ranges: Range[]): Hours[] =>
	list.flatMap((weekday) => ranges.map(([opens, closes]) => ({ weekday, opens, closes })));

/** Ordenado por día y hora, como lo devuelve la base de datos. */
const week = (...parts: Hours[][]): Hours[] =>
	parts
		.flat()
		.sort((a, b) => a.weekday - b.weekday || (a.opens < b.opens ? -1 : a.opens > b.opens ? 1 : 0));

export const FACILITY_TEMPLATES: readonly FacilityTemplate[] = [
	{
		key: 'pavillon',
		mascot: 'balonmano',
		typeName: { gl: 'Pavillón', es: 'Pabellón' },
		bookingMode: 'slot',
		slotMinutes: 60,
		units: 1,
		capacity: 1,
		hours: week(
			days(WEEK, ['16:00', '23:00']),
			days(WEEKEND, ['10:00', '14:00'], ['16:00', '21:00'])
		),
		priceResidentCents: 1500,
		priceNonResidentCents: 3000,
		priceSocialCents: 750
	},
	{
		key: 'padel',
		mascot: 'padel',
		typeName: { gl: 'Pádel', es: 'Pádel' },
		bookingMode: 'unit',
		slotMinutes: 90,
		units: 2,
		capacity: 1,
		hours: week(
			days(WEEK, ['09:00', '13:30'], ['16:30', '22:30']),
			days(WEEKEND, ['10:00', '14:30'], ['16:30', '22:30'])
		),
		priceResidentCents: 400,
		priceNonResidentCents: 700,
		priceSocialCents: 200
	},
	{
		key: 'piscina',
		mascot: 'natacion',
		typeName: { gl: 'Piscina', es: 'Piscina' },
		bookingMode: 'capacity',
		slotMinutes: 60,
		units: 1,
		capacity: 25,
		hours: week(days(WEEK, ['07:00', '10:00'], ['17:00', '21:00']), days([5], ['10:00', '14:00'])),
		priceResidentCents: 200,
		priceNonResidentCents: 400,
		priceSocialCents: 100
	},
	{
		key: 'futbol',
		mascot: 'futbol',
		typeName: { gl: 'Fútbol', es: 'Fútbol' },
		bookingMode: 'slot',
		slotMinutes: 90,
		units: 1,
		capacity: 1,
		hours: week(
			days(WEEK, ['17:00', '23:00']),
			days(WEEKEND, ['10:00', '14:30'], ['16:30', '22:30'])
		),
		priceResidentCents: 2500,
		priceNonResidentCents: 4000,
		priceSocialCents: null
	},
	{
		key: 'fronton',
		mascot: 'fronton',
		typeName: { gl: 'Frontón', es: 'Frontón' },
		bookingMode: 'slot',
		slotMinutes: 60,
		units: 1,
		capacity: 1,
		hours: days(ALL, ['09:00', '22:00']),
		priceResidentCents: 300,
		priceNonResidentCents: 500,
		priceSocialCents: null
	},
	{
		key: 'ximnasio',
		mascot: 'ximnasio',
		typeName: { gl: 'Ximnasio', es: 'Gimnasio' },
		bookingMode: 'capacity',
		slotMinutes: 60,
		units: 1,
		capacity: 15,
		hours: week(days(WEEK, ['07:00', '09:00'], ['17:00', '21:00']), days([5], ['10:00', '13:00'])),
		priceResidentCents: 200,
		priceNonResidentCents: 300,
		priceSocialCents: 100
	},
	{
		key: 'sala',
		mascot: 'sala',
		typeName: { gl: 'Sala', es: 'Sala' },
		bookingMode: 'capacity',
		slotMinutes: 60,
		units: 1,
		capacity: 20,
		hours: days([0, 1, 2, 3, 4, 5], ['09:00', '21:00']),
		priceResidentCents: 0,
		priceNonResidentCents: 0,
		priceSocialCents: null
	}
];

export function templateByKey(key: string): FacilityTemplate | undefined {
	return FACILITY_TEMPLATES.find((t) => t.key === key);
}

/** Color de un tipo nuevo según la familia del deporte (los mismos tonos que la demo). */
export function typeColorFor(mascot: Mascot): string {
	if (mascot === 'sala') return '#E3B26A';
	switch (MASCOT_FAMILY[mascot]) {
		case 'raqueta':
			return '#F2762E';
		case 'balon':
			return '#2E9E4F';
		case 'auga':
			return '#1AA6C8';
		default:
			return '#9AA1A0';
	}
}
