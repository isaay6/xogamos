// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import {
	applyNoShow,
	canCancel,
	isPenalized,
	priceFor,
	withinBookingWindow,
	type Policy
} from './policies';

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const now = new Date('2026-10-21T10:00:00Z');
const policy: Policy = {
	cancellationDeadlineMinutes: 120,
	maxDaysAhead: 14,
	noShowThreshold: 3,
	penaltyDays: 7
};
const facility = { priceResidentCents: 300, priceNonResidentCents: 600, priceSocialCents: null };
const general = { isResident: false, socialTariff: null };
const resident = { isResident: true, socialTariff: null };

describe('priceFor', () => {
	it('price resident', () => {
		expect(priceFor(facility, resident, 1)).toBe(300);
	});
	it('price non-resident with seats', () => {
		expect(priceFor(facility, general, 2)).toBe(1200);
	});
	it('throws RangeError for seats < 1', () => {
		expect(() => priceFor(facility, resident, 0)).toThrow(RangeError);
	});
	it('a tarifa social aplícase só se a persoa a ten e a instalación ten prezo social', () => {
		const social = { ...facility, priceSocialCents: 150 };
		expect(priceFor(social, { isResident: false, socialTariff: 'maior' }, 2)).toBe(300);
		expect(priceFor(social, general, 1)).toBe(600);
		expect(priceFor(facility, { isResident: false, socialTariff: 'xove' }, 1)).toBe(600);
	});
	it('colle o prezo máis baixo dos aplicables', () => {
		const dearSocial = { ...facility, priceSocialCents: 400 };
		expect(priceFor(dearSocial, { isResident: true, socialTariff: 'familia' }, 1)).toBe(300);
		expect(priceFor(dearSocial, { isResident: false, socialTariff: 'familia' }, 1)).toBe(400);
		const free = { ...facility, priceSocialCents: 0 };
		expect(priceFor(free, { isResident: true, socialTariff: 'maior' }, 3)).toBe(0);
		// Un prezo de non empadroado máis baixo (configuración rara) tamén vale para quen o está.
		const odd = { priceResidentCents: 500, priceNonResidentCents: 450, priceSocialCents: null };
		expect(priceFor(odd, resident, 1)).toBe(450);
	});
});

describe('canCancel', () => {
	const startsAt = new Date(now.getTime() + 10 * DAY);
	it('cancel deadline', () => {
		expect(canCancel(startsAt, new Date(startsAt.getTime() - 121 * MIN), policy)).toBe(true);
		expect(canCancel(startsAt, new Date(startsAt.getTime() - 119 * MIN), policy)).toBe(false);
	});
	it('exactly at the deadline is allowed', () => {
		expect(canCancel(startsAt, new Date(startsAt.getTime() - 120 * MIN), policy)).toBe(true);
	});
});

describe('withinBookingWindow', () => {
	it('window', () => {
		expect(withinBookingWindow(new Date(now.getTime() - 60 * MIN), now, policy)).toBe('IN_PAST');
		expect(withinBookingWindow(new Date(now.getTime() + 15 * DAY), now, policy)).toBe(
			'TOO_FAR_AHEAD'
		);
		expect(withinBookingWindow(new Date(now.getTime() + DAY), now, policy)).toBeNull();
	});
	it('startsAt == now is in the past; exactly max is allowed', () => {
		expect(withinBookingWindow(now, now, policy)).toBe('IN_PAST');
		expect(withinBookingWindow(new Date(now.getTime() + 14 * DAY), now, policy)).toBeNull();
	});
});

describe('withinBookingWindow (calendar days)', () => {
	const morning = new Date('2026-11-21T08:00:00+01:00');
	it('counts maxDaysAhead in local calendar days', () => {
		expect(withinBookingWindow(new Date('2026-12-05T20:00:00+01:00'), morning, policy)).toBeNull();
		expect(withinBookingWindow(new Date('2026-12-06T09:00:00+01:00'), morning, policy)).toBe(
			'TOO_FAR_AHEAD'
		);
	});
});

describe('applyNoShow', () => {
	it('third no-show penalizes', () => {
		const input = { noShowCount: 2, penaltyUntil: null };
		const r = applyNoShow(input, now, policy);
		expect(r.noShowCount).toBe(0);
		expect(r.penaltyUntil).toEqual(new Date(now.getTime() + 7 * DAY));
		expect(input.noShowCount).toBe(2);
	});
	it('below threshold increments and keeps penaltyUntil', () => {
		const prev = new Date('2026-01-01T00:00:00Z');
		expect(applyNoShow({ noShowCount: 0, penaltyUntil: prev }, now, policy)).toEqual({
			noShowCount: 1,
			penaltyUntil: prev
		});
	});
});

describe('isPenalized', () => {
	it('penalty expires', () => {
		expect(isPenalized(new Date(now.getTime() - 1), now)).toBe(false);
		expect(isPenalized(null, now)).toBe(false);
		expect(isPenalized(new Date(now.getTime() + DAY), now)).toBe(true);
	});
});
