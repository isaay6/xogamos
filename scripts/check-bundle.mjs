// SPDX-License-Identifier: EUPL-1.2
// Tras `npm run build`: el respaldo de demostración (PGlite + seed) no debe estar en el servidor.
import { readdirSync } from 'node:fs';

const dir = '.svelte-kit/output/server/chunks';
const bad = readdirSync(dir).filter((f) => /dev-demo|seed-data|pglite/i.test(f));
if (bad.length > 0) {
	console.error(`Dev-only chunks in the production server build: ${bad.join(', ')}`);
	process.exit(1);
}
console.log('Production server build has no dev-demo, seed or PGlite chunks.');
