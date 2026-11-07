// SPDX-License-Identifier: EUPL-1.2
// Aleatoriedade determinista para a semente de demostración.

/** PRNG mulberry32: mesma semente, mesma secuencia. */
export function prng(seed: number): () => number {
	let a = seed | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Hash FNV-1a de 32 bits dun texto: semente estable para cada (concello, día). */
export function hashSeed(text: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export const pick = <T>(rand: () => number, list: readonly T[]): T =>
	list[Math.floor(rand() * list.length)];
