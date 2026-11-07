// SPDX-License-Identifier: EUPL-1.2
// Convención de guardas: en las zonas del personal, `load` y cada acción de todo `+page.server.ts`
// llaman a una guarda (SvelteKit ejecuta el layout y la página en paralelo, y las acciones no
// pasan por el layout, así que cada una debe comprobar por su cuenta). Es un análisis estático.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * Guardas aceptadas:
 * - `requirePageStaff` (`page-guards.ts`): la base de todas;
 * - `requireAdminPage` (`admin/guard.ts`), `staffContext` y `deskContext` (`conserxeria/guard.ts`):
 *   sus envoltorios (`deskContext` deja fuera al rol de apertura);
 * - `requirePageDeputacion` (`page-guards.ts`): la de la zona `deputacion/`, fuera de `[slug]`;
 * - `requireConserxe` y `requireAdmin`: nombres reservados por si se añaden guardas con ese nombre.
 * Un ayudante local (`function x`) también cuenta si su cuerpo llama a una guarda (transitivo).
 */
const GUARDS = [
	'requirePageStaff',
	'requireAdminPage',
	'staffContext',
	'deskContext',
	'requireConserxe',
	'requireAdmin',
	'requirePageDeputacion'
];

function pagesUnder(zone: string): string[] {
	// `deputacion/` cuelga de `src/routes`, no de `[slug]`.
	const root = zone === 'deputacion' ? join(HERE, '..', zone) : join(HERE, zone);
	return (readdirSync(root, { recursive: true }) as string[])
		.filter((f) => f.endsWith('+page.server.ts'))
		.map((f) => join(root, f))
		.sort();
}

/** Trozos de primer nivel: cada uno empieza en una línea sin sangría y llega hasta la siguiente. */
function topLevel(src: string): { head: string; body: string }[] {
	const lines = src.split('\n');
	const starts = lines
		.map((l, i) => (/^(export |async function |function |const |let |type )/.test(l) ? i : -1))
		.filter((i) => i >= 0);
	return starts.map((s, n) => ({
		head: lines[s],
		body: lines.slice(s, starts[n + 1] ?? lines.length).join('\n')
	}));
}

const calls = (body: string, names: string[]) =>
	names.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(body));

/** Nombres de ayudantes locales que acaban llamando a una guarda. */
function guardedHelpers(chunks: { head: string; body: string }[]): string[] {
	const helpers = chunks
		.map((c) => ({ name: /^(?:async )?function (\w+)/.exec(c.head)?.[1], body: c.body }))
		.filter((h): h is { name: string; body: string } => Boolean(h.name));
	const guarded: string[] = [];
	for (let changed = true; changed;) {
		changed = false;
		for (const h of helpers) {
			if (!guarded.includes(h.name) && calls(h.body, [...GUARDS, ...guarded])) {
				guarded.push(h.name);
				changed = true;
			}
		}
	}
	return guarded;
}

/** Cuerpos de las acciones: propiedades de una sangría dentro de `export const actions`. */
function actionBodies(body: string): { name: string; body: string }[] {
	const lines = body.split('\n');
	const starts = lines
		.map((l, i) => ({ m: /^\t(?:async )?(\w+)\s*[:(]/.exec(l), i }))
		.filter((x) => x.m)
		.map((x) => ({ name: x.m![1], i: x.i }));
	return starts.map((s, n) => ({
		name: s.name,
		body: lines.slice(s.i, starts[n + 1]?.i ?? lines.length).join('\n')
	}));
}

const files = [...pagesUnder('conserxeria'), ...pagesUnder('admin'), ...pagesUnder('deputacion')];

describe('guardas de las zonas conserxeria, admin y deputacion', () => {
	it('encuentra las páginas del personal', () => {
		expect(files.length).toBeGreaterThanOrEqual(12);
		expect(files.filter((f) => f.includes('/deputacion/')).length).toBeGreaterThanOrEqual(3);
	});

	for (const file of files) {
		const rel = relative(HERE, file);
		it(`${rel}: load y cada acción llaman a una guarda`, () => {
			const chunks = topLevel(readFileSync(file, 'utf8'));
			const accepted = [...GUARDS, ...guardedHelpers(chunks)];
			const load = chunks.find((c) => /^export const load\b/.test(c.head));
			const actions = chunks.find((c) => /^export const actions\b/.test(c.head));
			expect(load || actions, 'sin load ni actions').toBeTruthy();
			if (load) expect(calls(load.body, accepted), 'load sin guarda').toBe(true);
			if (actions) {
				const list = actionBodies(actions.body);
				expect(list.length, 'actions sin acciones reconocibles').toBeGreaterThan(0);
				for (const a of list) {
					expect(calls(a.body, accepted), `acción «${a.name}» sin guarda`).toBe(true);
				}
			}
		});
	}

	it('el análisis detecta una acción sin guarda', () => {
		const src = [
			'export const actions: Actions = {',
			'\tok: async (event) => {',
			'\t\tawait requireAdminPage(event);',
			'\t},',
			'\tnoGuard: async (event) => {',
			'\t\treturn {};',
			'\t}',
			'};'
		].join('\n');
		const [chunk] = topLevel(src);
		const bad = actionBodies(chunk.body).filter((a) => !calls(a.body, GUARDS));
		expect(bad.map((a) => a.name)).toEqual(['noGuard']);
	});
});
