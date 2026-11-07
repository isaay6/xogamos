// SPDX-License-Identifier: EUPL-1.2
// Cálculos de la agenda del mostrador: semana (luns–domingo), horas ocupadas y nivel de cada día.
import { addLocalDays, weekdayOf } from '../../../lib/server/domain/time';
import { unionMs, type AgendaFacility } from '../../../lib/server/services/staff';

export type Level = 'tranquila' | 'media' | 'chea' | 'pechada';

/** Los siete días locales (luns a domingo) de la semana de `date`. */
export function weekOf(date: string): string[] {
	const monday = addLocalDays(date, -weekdayOf(date));
	return Array.from({ length: 7 }, (_, i) => addLocalDays(monday, i));
}

/**
 * Minutos ocupados de una instalación en su día, comparables con sus minutos de apertura:
 * - `unit`: la media por unidad (cada unidad es la unión de sus reservas y temporadas; una
 *   temporada sin unidad ocupa todas), así que nunca pasa de lo que abre una pista;
 * - `capacity`: cada franja pesa las plazas reservadas entre el aforo (una persona en una piscina
 *   de 8 no la llena); las temporadas ocupan el aforo entero;
 * - el resto: la unión de reservas no canceladas y temporadas.
 */
export function busyMinutes(f: AgendaFacility): number {
	const live = f.bookings.filter((b) => b.status !== 'cancelled');
	const span = (s: Date, e: Date) => ({ s: s.getTime(), e: e.getTime() });
	const seasons = f.seasons.map((s) => ({ ...span(s.startsAt, s.endsAt), unit: s.unitIndex }));
	if (f.bookingMode === 'unit') {
		const units = Math.max(1, f.units);
		let ms = 0;
		for (let i = 0; i < units; i++) {
			ms += unionMs([
				...live.filter((b) => (b.unitIndex ?? 0) === i).map((b) => span(b.startsAt, b.endsAt)),
				...seasons.filter((s) => s.unit === null || s.unit === i)
			]);
		}
		return Math.round(ms / units / 60_000);
	}
	if (f.bookingMode === 'capacity') {
		const slots = new Map<number, { s: number; e: number; seats: number }>();
		for (const b of live) {
			const slot = slots.get(b.startsAt.getTime()) ?? { ...span(b.startsAt, b.endsAt), seats: 0 };
			slot.seats += b.seats;
			slots.set(b.startsAt.getTime(), slot);
		}
		const full = unionMs(seasons);
		let ms = full;
		for (const slot of slots.values()) {
			// Solo la parte de la franja que no tapa ya una temporada.
			const free = unionMs([...seasons, slot]) - full;
			ms += free * Math.min(1, slot.seats / Math.max(1, f.capacity));
		}
		return Math.round(ms / 60_000);
	}
	return Math.round(unionMs([...live.map((b) => span(b.startsAt, b.endsAt)), ...seasons]) / 60_000);
}

/** Menos de la mitad: tranquila; menos de 3/4: media; desde 3/4: chea. Sin apertura: pechada. */
export function levelOf(minutes: number, possible: number): Level {
	if (possible <= 0) return 'pechada';
	const ratio = minutes / possible;
	if (ratio < 0.5) return 'tranquila';
	if (ratio < 0.75) return 'media';
	return 'chea';
}
