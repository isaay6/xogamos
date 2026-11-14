// SPDX-License-Identifier: EUPL-1.2
import { defineConfig, devices } from '@playwright/test';

// Probas no navegador contra a demo (PGlite en memoria, identidade simulada).
// Os ficheiros chámanse *.e2e.ts para que Vitest non os colla.
const PORT = 5199;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: `http://127.0.0.1:${PORT}`, locale: 'gl-ES', timezoneId: 'Europe/Madrid' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run dev:demo -- --host 127.0.0.1 --port ${PORT} --strictPort`,
		url: `http://127.0.0.1:${PORT}/healthz`,
		timeout: 180_000,
		reuseExistingServer: !process.env.CI
	}
});
