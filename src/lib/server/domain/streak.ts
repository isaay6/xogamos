// SPDX-License-Identifier: EUPL-1.2
import { addLocalDays, localDateOf, weekdayOf } from './time';
import type { BookingStatus } from './types';

export type StreakItem = { startsAt: Date; endsAt: Date; status: BookingStatus };

type Week = { counts: boolean; breaks: boolean };

/** Lunes (fecha local 'YYYY-MM-DD', Europe/Madrid) de la semana ISO de un instante. */
function weekOf(instant: Date): string {
	const date = localDateOf(instant);
	return addLocalDays(date, -weekdayOf(date));
}

/**
 * Semanas ISO seguidas (hora local) con al menos una reserva a la que se fue.
 * - cuenta: alguna `attended`, o `confirmed` ya terminada (sin personal nadie marca la llegada);
 * - rompe: alguna `no_show`, aunque también cuente;
 * - neutra: solo `cancelled` (ni suma ni rompe);
 * - vacía: rompe.
 * La semana actual vacía o neutra no rompe: se empieza a contar por la anterior.
 */
export function computeStreak(items: StreakItem[], now: Date): number {
	const weeks = new Map<string, Week>();
	for (const b of items) {
		const key = weekOf(b.startsAt);
		const w = weeks.get(key) ?? { counts: false, breaks: false };
		if (b.status === 'attended' || (b.status === 'confirmed' && b.endsAt <= now)) w.counts = true;
		if (b.status === 'no_show') w.breaks = true;
		weeks.set(key, w);
	}

	let week = weekOf(now);
	let streak = 0;
	const current = weeks.get(week);
	if (current?.breaks) return 0;
	if (current?.counts) streak = 1;

	for (;;) {
		week = addLocalDays(week, -7);
		const w = weeks.get(week);
		if (!w || w.breaks) return streak; // vacía o con ausencia
		if (w.counts) streak++;
		// Si no cuenta ni rompe, es neutra (solo canceladas).
	}
}
