// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
	it('admite rutas locales', () => {
		expect(safeRedirect('/m/ribadavila')).toBe('/m/ribadavila');
		expect(safeRedirect('/m/x?a=1#b')).toBe('/m/x?a=1#b');
	});
	it.each([
		'//evil.example',
		'/\\evil.example',
		'https://evil.example',
		'javascript:alert(1)',
		'',
		'/\tevil',
		'/\n/evil.example',
		null
	])('rechaza %j', (t) => {
		expect(safeRedirect(t)).toBe('/');
	});
});
