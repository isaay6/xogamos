// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { fitWithin, PHOTO_MAX_SIDE } from './photo-resize';

describe('fitWithin', () => {
	it('reduces the longest side to 512 px keeping the proportion', () => {
		expect(PHOTO_MAX_SIDE).toBe(512);
		expect(fitWithin(4032, 3024)).toEqual({ width: 512, height: 384 });
		expect(fitWithin(3024, 4032)).toEqual({ width: 384, height: 512 });
		expect(fitWithin(2000, 2000)).toEqual({ width: 512, height: 512 });
	});

	it('never enlarges a small image', () => {
		expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
		expect(fitWithin(512, 100)).toEqual({ width: 512, height: 100 });
	});

	it('rounds to whole pixels and never gives 0', () => {
		expect(fitWithin(1000, 333)).toEqual({ width: 512, height: 170 });
		expect(fitWithin(10000, 1)).toEqual({ width: 512, height: 1 });
	});

	it('accepts another limit', () => {
		expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50 });
	});
});
