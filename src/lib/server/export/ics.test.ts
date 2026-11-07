// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { toIcs } from './ics';

const ev = (over: Partial<Parameters<typeof toIcs>[1][number]> = {}) => ({
	uid: 'abc@plataforma-reservas',
	start: new Date('2026-11-24T17:00:00Z'),
	end: new Date('2026-11-24T18:00:00Z'),
	summary: 'Pista 1',
	location: 'Ribadávila',
	description: 'Código 123456',
	status: 'CONFIRMED' as const,
	...over
});

const unfold = (s: string) => s.replace(/\r\n /g, '');

describe('toIcs', () => {
	it('cabecera, evento y horas UTC', () => {
		const ics = toIcs('Reservas', [ev()]);
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		for (const l of [
			'VERSION:2.0',
			'PRODID:-//plataforma-reservas//GL',
			'CALSCALE:GREGORIAN',
			'UID:abc@plataforma-reservas',
			'DTSTART:20261124T170000Z',
			'DTEND:20261124T180000Z',
			'STATUS:CONFIRMED'
		]) {
			expect(ics).toContain(l + '\r\n');
		}
		expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
		expect(ics).not.toMatch(/[^\r]\n/);
	});

	it('escapa comas, punto y coma, barras y saltos de línea', () => {
		const ics = toIcs('c', [ev({ summary: 'Pista 1, pádel; norte\n', description: 'a\\b' })]);
		expect(ics).toContain('SUMMARY:Pista 1\\, pádel\\; norte\\n\r\n');
		expect(ics).toContain('DESCRIPTION:a\\\\b\r\n');
	});

	it('pliega a 75 octetos sin partir caracteres', () => {
		const summary = 'ñ'.repeat(200);
		const ics = toIcs('c', [ev({ summary })]);
		const lines = ics.split('\r\n');
		const idx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
		expect(lines[idx + 1].startsWith(' ')).toBe(true);
		for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
		expect(unfold(ics)).toContain('SUMMARY:' + summary + '\r\n');
		expect(ics).not.toContain('�');
	});
});
