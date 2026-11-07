// SPDX-License-Identifier: EUPL-1.2
// Tipos estructurales que usan los componentes. Coinciden con los de
// `server/services/search.ts`, pero aquí no se importa código de servidor.

/** Peche con el motivo que escribió el concello («Pechada ata o verán»). */
export type ClosedInfo = { reason: string; startsOn: string; endsOn: string; holiday?: true };

/**
 * Una hora del día elegido: libre o llena, y plazas que quedan en las de aforo. `closed`: no se
 * puede escoger porque un peche la tapa.
 */
export type HourStatus = {
	time: string;
	free: boolean;
	remainingSeats: number | null;
	closed?: ClosedInfo;
	past?: boolean;
};

/** Un día de la tira: `full` si no queda ningún hueco; `closed` si es por un peche. */
export type DayStatus = { date: string; full: boolean; closed?: ClosedInfo };
