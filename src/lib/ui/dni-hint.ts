// SPDX-License-Identifier: EUPL-1.2
// Comprobación da letra do DNI/NIE no navegador (sen node:crypto): o buscador do mostrador
// avisa antes de buscar. A mesma táboa mod 23 que `src/lib/server/domain/dni.ts`.

const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const DNI = /^[0-9]{8}[A-Z]$/;
const NIE = /^[XYZ][0-9]{7}[A-Z]$/;

export type DniHint = { ok: boolean; letra: string; escrita: string };

/**
 * Se `q` ten forma de DNI ou NIE enteiro (con espazos ou guións), a letra que lle tocaría e se
 * cadra coa escrita; se non (un anaco, un nome, un teléfono), null.
 */
export function dniHint(q: string): DniHint | null {
	const s = q.replace(/[\s-]/g, '').toUpperCase();
	if (!DNI.test(s) && !NIE.test(s)) return null;
	const n = Number('XYZ'.includes(s[0]) ? 'XYZ'.indexOf(s[0]) + s.slice(1, 8) : s.slice(0, 8));
	const letra = LETTERS[n % 23];
	return { ok: letra === s[8], letra, escrita: s[8] };
}
