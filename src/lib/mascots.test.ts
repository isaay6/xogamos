// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT, LEGACY_MASCOT, MASCOTS, MASCOT_FAMILY } from './mascots';

describe('mascots', () => {
	it('tiene 21 claves únicas e incluye sala', () => {
		expect(MASCOTS).toHaveLength(21);
		expect(new Set(MASCOTS).size).toBe(21);
		expect(MASCOTS).toContain('sala');
		expect(DEFAULT_MASCOT).toBe('sala');
	});
	it('cada clave tiene familia', () => {
		for (const m of MASCOTS) expect(MASCOT_FAMILY[m]).toBeTruthy();
		expect(Object.keys(MASCOT_FAMILY).sort()).toEqual([...MASCOTS].sort());
	});
	it('cada valor heredado está en el catálogo', () => {
		for (const v of Object.values(LEGACY_MASCOT)) expect(MASCOTS).toContain(v);
	});
});
