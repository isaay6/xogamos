// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import {
	ACCESS_WINDOW_BEFORE_MINUTES,
	generatePin,
	isWithinAccessWindow,
	normalizePin
} from './access-code';
import type { Interval } from './types';

const MIN = 60_000;
const booking: Interval = {
	startsAt: new Date(Date.UTC(2026, 10, 20, 18, 0)),
	endsAt: new Date(Date.UTC(2026, 10, 20, 19, 0))
};

describe('generatePin', () => {
	it('four digits with leading zeros', () => {
		expect(generatePin(() => 7)).toBe('0007');
	});

	it('format', () => {
		for (let i = 0; i < 1000; i++) {
			expect(generatePin()).toMatch(/^\d{4}$/);
		}
	});
});

describe('normalizePin', () => {
	it('strips whitespace', () => {
		expect(normalizePin(' 04 07 ')).toBe('0407');
		expect(normalizePin('04\u200907')).toBe('0407');
	});

	it('rejects anything but four digits', () => {
		expect(normalizePin('12345')).toBeNull();
		expect(normalizePin('123')).toBeNull();
		expect(normalizePin('12a4')).toBeNull();
		expect(normalizePin('')).toBeNull();
	});
});

describe('isWithinAccessWindow', () => {
	it('uses a 15 minute lead window', () => {
		expect(ACCESS_WINDOW_BEFORE_MINUTES).toBe(15);
	});

	it('16 min before start is false', () => {
		expect(isWithinAccessWindow(booking, new Date(booking.startsAt.getTime() - 16 * MIN))).toBe(
			false
		);
	});

	it('15 min before start is true', () => {
		expect(isWithinAccessWindow(booking, new Date(booking.startsAt.getTime() - 15 * MIN))).toBe(
			true
		);
	});

	it('middle of the booking is true', () => {
		expect(isWithinAccessWindow(booking, new Date(booking.startsAt.getTime() + 30 * MIN))).toBe(
			true
		);
	});

	it('exactly at the end is false', () => {
		expect(isWithinAccessWindow(booking, booking.endsAt)).toBe(false);
	});
});
