// SPDX-License-Identifier: EUPL-1.2
import { addLocalDays, localDateOf } from './time';

// Políticas del concello (mismos campos que la tabla municipalities).
// `maxDaysAhead` cuenta días naturales locales; `penaltyDays` periodos de 24 h en milisegundos.
export type Policy = {
	cancellationDeadlineMinutes: number;
	maxDaysAhead: number;
	noShowThreshold: number;
	penaltyDays: number;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type SocialTariff = 'xove' | 'maior' | 'familia';

/** Categoría comprobada por el personal (nunca la declarada por la persona). */
export type PriceCategory = { isResident: boolean; socialTariff: SocialTariff | null };

/** Sin perfil en el concello: ni empadronada ni con tarifa social. */
export const GENERAL: PriceCategory = { isResident: false, socialTariff: null };

/**
 * Precio total en céntimos: el menor de los precios aplicables por plaza. El de no empadronado
 * vale siempre; el de empadronado, si lo está; el social, si tiene tarifa social y la instalación
 * tiene precio social.
 */
export function priceFor(
	f: { priceResidentCents: number; priceNonResidentCents: number; priceSocialCents: number | null },
	category: PriceCategory,
	seats: number
): number {
	if (!Number.isInteger(seats) || seats < 1) {
		throw new RangeError(`seats must be an integer >= 1, got ${seats}`);
	}
	const applicable = [f.priceNonResidentCents];
	if (category.isResident) applicable.push(f.priceResidentCents);
	if (category.socialTariff !== null && f.priceSocialCents !== null) {
		applicable.push(f.priceSocialCents);
	}
	return Math.min(...applicable) * seats;
}

/** Se puede cancelar si falta al menos el plazo (el límite exacto vale). */
export function canCancel(startsAt: Date, now: Date, p: Policy): boolean {
	return now.getTime() <= startsAt.getTime() - p.cancellationDeadlineMinutes * MINUTE_MS;
}

export function withinBookingWindow(
	startsAt: Date,
	now: Date,
	p: Policy
): 'IN_PAST' | 'TOO_FAR_AHEAD' | null {
	if (startsAt.getTime() <= now.getTime()) return 'IN_PAST';
	// Se puede reservar hasta el final del día local `hoy + maxDaysAhead`.
	if (localDateOf(startsAt) > addLocalDays(localDateOf(now), p.maxDaysAhead)) {
		return 'TOO_FAR_AHEAD';
	}
	return null;
}

/** Registra una ausencia; al llegar al umbral penaliza y reinicia el contador. No muta. */
export function applyNoShow(
	profile: { noShowCount: number; penaltyUntil: Date | null },
	now: Date,
	p: Policy
): { noShowCount: number; penaltyUntil: Date | null } {
	const count = profile.noShowCount + 1;
	if (count >= p.noShowThreshold) {
		return { noShowCount: 0, penaltyUntil: new Date(now.getTime() + p.penaltyDays * DAY_MS) };
	}
	return { noShowCount: count, penaltyUntil: profile.penaltyUntil };
}

export function isPenalized(penaltyUntil: Date | null, now: Date): boolean {
	return penaltyUntil !== null && penaltyUntil.getTime() > now.getTime();
}
