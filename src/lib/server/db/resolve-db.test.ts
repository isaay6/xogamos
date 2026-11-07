// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it, vi } from 'vitest';
import { resolveDb } from './resolve-db';

describe('resolveDb', () => {
	// Que hooks.server.ts só pase `loadDemo` en dev: ver src/hooks.server.test.ts.
	it('sen DATABASE_URL e sen respaldo falla con DATABASE_URL', async () => {
		await expect(resolveDb({ databaseUrl: undefined, loadDemo: undefined })).rejects.toThrow(
			'DATABASE_URL'
		);
	});

	it('con DATABASE_URL non carga o respaldo aínda que exista', async () => {
		const loadDemo = vi.fn();
		const db = await resolveDb({
			databaseUrl: 'postgres://u:p@localhost:1/db',
			loadDemo
		});
		expect(db).toBeDefined();
		expect(loadDemo).not.toHaveBeenCalled();
	});

	it('en dev sen DATABASE_URL usa o respaldo', async () => {
		const fake = {} as never;
		const loadDemo = vi.fn(async () => fake);
		await expect(resolveDb({ databaseUrl: undefined, loadDemo })).resolves.toBe(fake);
		expect(loadDemo).toHaveBeenCalledOnce();
	});
});
