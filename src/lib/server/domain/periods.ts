// SPDX-License-Identifier: EUPL-1.2
import { addLocalDays, addLocalMonths, isLocalMonth } from './time';

export const PERIODS = ['semana', 'mes', 'tres'] as const;
export type Period = (typeof PERIODS)[number];

const DAYS: Record<Period, number> = { semana: 7, mes: 30, tres: 91 };

/** Períodos inclusivos comunes para administración y Deputación. */
export function periodRange(param: string | null, today: string) {
	const period = PERIODS.find((value) => value === param) ?? 'mes';
	return { period, from: addLocalDays(today, -(DAYS[period] - 1)), to: today };
}

/** Mes completo para informes, con el mismo calendario local que los períodos de Resumo. */
export function monthRange(param: string | null, today: string) {
	const month = isLocalMonth(param) ? param : today.slice(0, 7);
	return { month, from: `${month}-01`, to: `${addLocalMonths(month, 1)}-01` };
}
