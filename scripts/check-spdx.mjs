// SPDX-License-Identifier: EUPL-1.2
// Fails (exit 1) if any .ts/.js/.svelte/.css file under src/ or scripts/ lacks the
// SPDX-License-Identifier: EUPL-1.2 marker in its first three lines.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.js', '.svelte', '.css']);
const MARKER = 'SPDX-License-Identifier: EUPL-1.2';

function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (EXTENSIONS.has(extname(entry.name))) yield path;
	}
}

const missing = [];
for (const root of ROOTS) {
	for (const file of walk(root)) {
		const head = readFileSync(file, 'utf8').split('\n').slice(0, 3).join('\n');
		if (!head.includes(MARKER)) missing.push(file);
	}
}

if (missing.length > 0) {
	console.error(`Missing "${MARKER}" in:\n${missing.map((f) => `  ${f}`).join('\n')}`);
	process.exit(1);
}
console.log('SPDX headers OK');
