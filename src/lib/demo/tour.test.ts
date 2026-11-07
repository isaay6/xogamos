// SPDX-License-Identifier: EUPL-1.2
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { esZones, glZones } from '../i18n';
import {
	TOURS,
	TOUR_KEYS,
	isTourKey,
	matchesStep,
	stepHref,
	stepPattern,
	tourForPath
} from './tour';

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return svelteFiles(p);
		return p.endsWith('.svelte') ? [p] : [];
	});
}

describe('datos dos percorridos', () => {
	it('cada perfil ten entre 5 e 10 pasos', () => {
		for (const key of TOUR_KEYS) {
			const n = TOURS[key].steps.length;
			expect(n >= 5 && n <= 10, `${key}: ${n}`).toBe(true);
		}
	});

	it('cada título e texto existe en gl e en es', () => {
		const gl = glZones.demo as Record<string, string>;
		const es = esZones.demo as Record<string, string>;
		for (const key of TOUR_KEYS)
			for (const s of TOURS[key].steps)
				for (const k of [s.title, s.body]) {
					expect(gl[k], `gl ${k}`).toBeTruthy();
					expect(es[k], `es ${k}`).toBeTruthy();
				}
	});

	it('cada `target` (e cada `via`) é un data-tour dalgunha pantalla de src/', () => {
		const source = svelteFiles('src').map((f) => readFileSync(f, 'utf8'));
		for (const key of TOUR_KEYS)
			for (const s of TOURS[key].steps)
				for (const name of [s.target, s.via].filter(Boolean)) {
					const attr = `data-tour="${name}"`;
					expect(
						source.some((src) => src.includes(attr)),
						`${key}: falta ${attr}`
					).toBe(true);
				}
	});

	it('as rutas con parámetros chegan por unha ligazón (`via`) do paso anterior', () => {
		for (const key of TOUR_KEYS) {
			const steps = TOURS[key].steps;
			steps.forEach((s, i) => {
				if (stepHref(key, s, 'viana-do-bolo') !== null) return;
				expect(s.via, `${key} paso ${i + 1}`).toBeTruthy();
				expect(steps[i - 1]?.target, `${key} paso ${i + 1}`).toBe(s.via);
			});
		}
	});
});

describe('rutas dos pasos', () => {
	const [inicio, dia] = TOURS.vecina.steps;
	it('os de concello van detrás do concello; os da deputación son absolutos', () => {
		expect(stepPattern('vecina', inicio, 'viana-do-bolo')).toBe('/viana-do-bolo');
		expect(stepHref('vecina', inicio, 'viana-do-bolo')).toBe('/viana-do-bolo');
		expect(stepHref('deputacion', TOURS.deputacion.steps[0], 'viana-do-bolo')).toBe('/deputacion');
		expect(stepHref('vecina', dia, 'viana-do-bolo')).toBeNull();
	});

	it('casa segmento a segmento, cos [parámetros] como comodín', () => {
		expect(matchesStep('vecina', inicio, 'viana-do-bolo', '/viana-do-bolo')).toBe(true);
		expect(matchesStep('vecina', inicio, 'viana-do-bolo', '/viana-do-bolo/')).toBe(true);
		expect(matchesStep('vecina', inicio, 'viana-do-bolo', '/a-rua')).toBe(false);
		expect(matchesStep('vecina', dia, 'viana-do-bolo', '/viana-do-bolo/reservar/abc')).toBe(true);
		expect(matchesStep('vecina', dia, 'viana-do-bolo', '/viana-do-bolo/reservar/abc/libre')).toBe(
			false
		);
		expect(matchesStep('vecina', dia, 'viana-do-bolo', '/viana-do-bolo/reservar')).toBe(false);
	});

	it('o percorrido por defecto segue a zona da ruta', () => {
		expect(tourForPath('/deputacion/novo')).toBe('deputacion');
		expect(tourForPath('/viana-do-bolo/admin/normas')).toBe('concello');
		expect(tourForPath('/viana-do-bolo/conserxeria')).toBe('conserxe');
		expect(tourForPath('/viana-do-bolo/eu')).toBe('vecina');
		expect(isTourKey('vecina')).toBe(true);
		expect(isTourKey('outro')).toBe(false);
	});
});
