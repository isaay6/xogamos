// SPDX-License-Identifier: EUPL-1.2
// Intervalos de la comparativa, en fechas locales de Europe/Madrid (no es una ruta).
import { PERIODS, periodRange } from '../../lib/server/domain/periods';

export const RANGES = PERIODS;
export type Range = (typeof RANGES)[number];

/**
 * Definición común de los períodos, con mes por defecto.
 */
export function rangeFor(
	param: string | null,
	today: string
): { rango: Range; from: string; to: string } {
	const { period: rango, from, to } = periodRange(param, today);
	return { rango, from, to };
}
