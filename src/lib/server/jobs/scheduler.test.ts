// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import { createMailTransport } from '../services/mailer';
import { startBackgroundJobs } from './scheduler';

describe('trabajos periódicos', () => {
	it('no arrancan bajo Vitest', async () => {
		expect(process.env.VITEST).toBeTruthy();
		expect(startBackgroundJobs(await createTestDb(), {})).toBe(false);
	});

	it('sin SMTP_URL no hay transporte: el buzón solo acumula', async () => {
		expect(await createMailTransport(undefined, undefined)).toBeNull();
		expect(await createMailTransport('', 'a@b.c')).toBeNull();
	});
});
