// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const contrast = (a: string, b: string) => {
	const luminance = (color: string) => {
		const channels = color.match(/[a-f\d]{2}/gi)?.map((part) => parseInt(part, 16) / 255) ?? [];
		return channels
			.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
			.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
	};
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
};

describe('tokens de alto contraste', () => {
	it('mantén unha relación de polo menos 7:1 nos pares principais', () => {
		const block = /html\[data-contraste='alto'\]\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
		const value = (token: string) =>
			new RegExp(`${token}:\\s*(#[0-9a-f]{3,6})`, 'i').exec(block)?.[1] ?? '';
		for (const foreground of ['--txt', '--gris', '--texto-suave', '--perigo']) {
			expect(contrast(value(foreground), '#ffffff'), foreground).toBeGreaterThanOrEqual(7);
		}
	});
});
