// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esZones, glZones } from '../lib/i18n';

describe('PWA', () => {
	it('enlaza un manifest e declara os datos de instalación', () => {
		expect(readFileSync('src/app.html', 'utf8')).toContain('manifest.webmanifest');
		const manifest = readFileSync('src/routes/manifest.webmanifest/+server.ts', 'utf8');
		expect(manifest).toContain("name: 'Reservas deportivas'");
		expect(manifest).toContain("display: 'standalone'");
	});

	it('ten os textos PWA en galego e castelán', () => {
		for (const key of ['vec.pwa.banner', 'vec.pwa.offline.titulo', 'vec.eu.instalar'] as const) {
			expect(glZones.vecinanza[key]).toBeTruthy();
			expect(esZones.vecinanza[key]).toBeTruthy();
		}
	});
});
