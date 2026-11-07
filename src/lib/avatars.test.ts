// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { AVATARS, avatarLabel, isAvatarKey } from './avatars';
import { MASCOTS } from './mascots';

describe('catálogo de avatares', () => {
	it('ten persoas, polo menos 4 nenos e personaxes de deporte', () => {
		expect(AVATARS).toContain('muller-lentes');
		expect(AVATARS.filter((k) => /^(neno|nena)-/.test(k)).length).toBeGreaterThanOrEqual(4);
		const sports = AVATARS.filter((k) => k.startsWith('deporte-'));
		expect(sports.length).toBeGreaterThan(0);
		for (const k of sports) expect(MASCOTS as readonly string[]).toContain(k.slice(8));
		expect(new Set(AVATARS).size).toBe(AVATARS.length);
	});

	it('cada avatar ten nome en galego e en castelán', () => {
		for (const key of AVATARS) {
			expect(avatarLabel(key, 'gl').trim(), key).not.toBe('');
			expect(avatarLabel(key, 'es').trim(), key).not.toBe('');
		}
		expect(avatarLabel('muller-lentes', 'gl')).toBe('Muller con lentes');
		expect(avatarLabel('muller-lentes', 'es')).toBe('Mujer con gafas');
	});

	it('isAvatarKey só acepta claves do catálogo', () => {
		expect(isAvatarKey('muller-lentes')).toBe(true);
		expect(isAvatarKey('non-existe')).toBe(false);
		expect(isAvatarKey(null)).toBe(false);
	});
});
