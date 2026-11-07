// SPDX-License-Identifier: EUPL-1.2
// Horario del asistente en el navegador: campos `h-{día}-{tramo}-…` ↔ franjas, y la rejilla de
// medias horas que se pinta. Sin código de servidor.

export type Pair = { opens: string; closes: string };
export type Week = Pair[][];

/** Tramos por día que se pueden enviar (igual que `MAX_RANGES` en el servidor). */
export const MAX_PAIRS = 4;

/** Franjas por día a partir de los valores del asistente (vacías incluidas, en su orden). */
export function weekFromValues(values: Record<string, string>): Week {
	return [0, 1, 2, 3, 4, 5, 6].map((d) => {
		const pairs: Pair[] = [];
		for (let i = 0; i < MAX_PAIRS; i++) {
			const opens = values[`h-${d}-${i}-opens`] ?? '';
			const closes = values[`h-${d}-${i}-closes`] ?? '';
			if (opens || closes) pairs.push({ opens, closes });
		}
		return pairs;
	});
}

/** Lo completo de la semana como lista de franjas (para el resumen y la vista previa). */
export const filledRanges = (week: Week) =>
	week.flatMap((pairs, weekday) =>
		pairs.filter((p) => p.opens && p.closes).map((p) => ({ weekday, ...p }))
	);

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Rejilla: medias horas de 07:00 a 23:30 (el cierre no puede pasar de las 23:59). */
export const GRID_FROM = 7 * 60;
export const GRID_STEP = 30;
export const GRID_ROWS = (23 * 60 + 30 - GRID_FROM) / GRID_STEP;

export const rowStart = (row: number) => GRID_FROM + row * GRID_STEP;
export const rowLabel = (row: number) => toHhmm(rowStart(row));

/** ¿Está la media hora `row` abierta entera en el día? */
export function cellOpen(pairs: Pair[], row: number): boolean {
	const from = rowStart(row);
	return pairs.some(
		(p) => p.opens && p.closes && toMin(p.opens) <= from && from + GRID_STEP <= toMin(p.closes)
	);
}

const GRID_TO = rowStart(GRID_ROWS);

/** Una hora que cae en la rejilla: media hora exacta entre las 07:00 y las 23:30. */
const onGrid = (hhmm: string) => {
	if (!/^\d\d:\d\d$/.test(hhmm)) return false;
	const m = toMin(hhmm);
	return m % GRID_STEP === 0 && m >= GRID_FROM && m <= GRID_TO;
};

/**
 * ¿Se puede pintar el día sin perder nada? No, si tiene horas fuera de la rejilla (antes de las
 * 07:00, después de las 23:30 o a cuartos) o una franja a medias: esas se cambian escribiendo.
 */
export function paintable(pairs: Pair[]): boolean {
	return pairs.every((p) => (!p.opens && !p.closes) || (onGrid(p.opens) && onGrid(p.closes)));
}

/**
 * Nuevas franjas del día al pintar `row` abierta o cerrada. Si el día no es pintable o el
 * resultado pasaría de `MAX_PAIRS` franjas, devuelve el día tal cual (no recorta en silencio).
 */
export function paintCell(pairs: Pair[], row: number, open: boolean): Pair[] {
	if (!paintable(pairs)) return pairs;
	const cells = Array.from({ length: GRID_ROWS }, (_, r) => cellOpen(pairs, r));
	cells[row] = open;
	const out: Pair[] = [];
	for (let r = 0; r < GRID_ROWS;) {
		if (!cells[r]) {
			r++;
			continue;
		}
		let end = r;
		while (end + 1 < GRID_ROWS && cells[end + 1]) end++;
		out.push({ opens: toHhmm(rowStart(r)), closes: toHhmm(rowStart(end) + GRID_STEP) });
		r = end + 1;
	}
	return out.length > MAX_PAIRS ? pairs : out;
}

/** Horas de comienzo de las primeras reservas de un día (vista previa). */
export function slotStarts(pairs: Pair[], minutes: number, max: number): string[] {
	const out: string[] = [];
	if (!(minutes >= 15)) return out;
	for (const p of pairs) {
		if (!p.opens || !p.closes) continue;
		for (let m = toMin(p.opens); m + minutes <= toMin(p.closes) && out.length < max; m += minutes) {
			out.push(toHhmm(m));
		}
	}
	return out;
}
