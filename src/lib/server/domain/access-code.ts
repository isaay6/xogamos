// SPDX-License-Identifier: EUPL-1.2
import { randomInt } from 'node:crypto';
import type { Interval } from './types';

/** Minutos antes del inicio en que el código de acceso ya es válido. */
export const ACCESS_WINDOW_BEFORE_MINUTES = 15;

const MS_PER_MINUTE = 60_000;

function cryptoRandomInt(max: number): number {
	return randomInt(max);
}

/** PIN de 4 dígitos, con ceros a la izquierda. */
export function generatePin(randomIntFn: (max: number) => number = cryptoRandomInt): string {
	return String(randomIntFn(10_000)).padStart(4, '0');
}

/** Quita los espacios (también el fino de «04 07»); null si no quedan 4 cifras. */
export function normalizePin(input: string): string | null {
	const pin = input.replace(/\s/g, '');
	return /^\d{4}$/.test(pin) ? pin : null;
}

/** true desde 15 min antes del inicio hasta el final (exclusivo) de la reserva. */
export function isWithinAccessWindow(b: Interval, now: Date): boolean {
	const opensAt = b.startsAt.getTime() - ACCESS_WINDOW_BEFORE_MINUTES * MS_PER_MINUTE;
	const t = now.getTime();
	return opensAt <= t && t < b.endsAt.getTime();
}
