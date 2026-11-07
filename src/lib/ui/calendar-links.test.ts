// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, outlookCalendarUrl } from './calendar-links';

const event = {
	title: 'Pádel · Pista 1',
	start: new Date('2026-11-25T17:00:00Z'),
	end: new Date('2026-11-25T18:00:00Z'),
	location: 'Rúa do Campo, Viana do Bolo'
};

describe('ligazóns de calendario', () => {
	it('Google recibe o título, as horas en UTC compacto e o lugar', () => {
		const url = new URL(googleCalendarUrl(event));
		expect(url.origin).toBe('https://calendar.google.com');
		expect(url.searchParams.get('action')).toBe('TEMPLATE');
		expect(url.searchParams.get('text')).toBe('Pádel · Pista 1');
		expect(url.searchParams.get('dates')).toBe('20261125T170000Z/20261125T180000Z');
		expect(url.searchParams.get('location')).toBe('Rúa do Campo, Viana do Bolo');
	});

	it('Outlook recibe as horas en ISO', () => {
		const url = new URL(outlookCalendarUrl(event));
		expect(url.origin).toBe('https://outlook.live.com');
		expect(url.searchParams.get('subject')).toBe('Pádel · Pista 1');
		expect(url.searchParams.get('startdt')).toBe('2026-11-25T17:00:00.000Z');
		expect(url.searchParams.get('enddt')).toBe('2026-11-25T18:00:00.000Z');
	});
});
