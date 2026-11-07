// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { noticeDate, noticeText, postedDay } from './notice-text';

describe('noticeDate', () => {
	it('escribe o mes en cada idioma, sen depender dos datos do navegador', () => {
		expect(noticeDate('gl', '2026-10-28')).toBe('28 de outubro');
		expect(noticeDate('es', '2026-10-28')).toBe('28 de octubre');
		expect(noticeDate('gl', '2026-12-01')).toBe('1 de decembro');
		expect(noticeDate('gl', 'non-é-data')).toBe('');
	});
});

describe('noticeText', () => {
	it('nunca deixa a data ISO sen formatar', () => {
		const text = noticeText('gl', 'cancelled_by_staff', {
			facilityName: 'Pista de tenis',
			date: '2026-10-28',
			time: '18:00',
			reason: 'Mantemento'
		});
		expect(text).toBe(
			'O concello cancelou a túa reserva de Pista de tenis, o 28 de outubro ás 18:00. Motivo: Mantemento'
		);
		expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
	});

	it('conserva o motivo dun peche na cancelación', () => {
		expect(
			noticeText('gl', 'cancelled_by_staff', {
				closureId: 'peche-1',
				reason: 'Avaría'
			})
		).toBe('O concello cancelou a túa reserva por un peche: Avaría. Non conta como falta.');
		expect(
			noticeText('es', 'cancelled_by_staff', {
				closureId: 'peche-1',
				reason: 'Avería'
			})
		).toBe('El ayuntamiento ha cancelado tu reserva por un cierre: Avería. No cuenta como falta.');
	});

	it('inclúe o título nos tres avisos de torneo', () => {
		for (const kind of [
			'tournament_published',
			'tournament_cancelled',
			'tournament_reminder'
		] as const) {
			expect(noticeText('gl', kind, { tournamentTitle: 'Copa do Sil' })).toContain('Copa do Sil');
		}
	});
});

describe('postedDay', () => {
	const TODAY = '2026-10-22';

	it('ata 6 días: hoxe, mañá ou o día da semana', () => {
		expect(postedDay('gl', TODAY, TODAY)).toBe('Hoxe');
		expect(postedDay('gl', '2026-10-21', TODAY)).toMatch(/21/);
		expect(postedDay('gl', '2026-10-16', TODAY)).not.toContain('de outubro');
	});

	it('máis de 6 días: o día e o mes', () => {
		expect(postedDay('gl', '2026-10-15', TODAY)).toBe('15 de outubro');
		expect(postedDay('gl', '2026-10-09', TODAY)).toBe('9 de outubro');
		expect(postedDay('es', '2026-10-09', TODAY)).toBe('9 de octubre');
		expect(postedDay('gl', '2025-12-30', '2026-01-10')).toBe('30 de decembro');
	});
});
