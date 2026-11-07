// SPDX-License-Identifier: EUPL-1.2
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// En GitHub Codespaces la demo se abre desde https://<codespace>-5180.<dominio>: hay que fiarse de ese
// origen para los formularios y de ese host en Vite. Fuera de Codespaces no cambia nada.
const codespaceHost = process.env.CODESPACE_NAME
	? `${process.env.CODESPACE_NAME}-5180.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
	: undefined;

export default defineConfig({
	server: codespaceHost ? { allowedHosts: [codespaceHost] } : undefined,
	test: {
		// PGlite tarda en arrancar con la máquina cargada.
		testTimeout: 30000,
		hookTimeout: 30000
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter(),
			csrf: codespaceHost ? { trustedOrigins: [`https://${codespaceHost}`] } : undefined
		})
	]
});
