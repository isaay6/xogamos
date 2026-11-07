// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../lib/server/db/test-db';
import { staffRoles, users } from '../../lib/server/db/schema';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture } from '../../lib/server/services/fixtures';
import { load as adminLoad } from './admin/+page.server';
import { load as agendaLoad, actions as agendaActions } from './conserxeria/+page.server';
import { load as follaLoad } from './conserxeria/folla/+page.server';
import { load as monederoLoad } from './conserxeria/monedero/+page.server';
import { load as novaLoad } from './conserxeria/nova/+page.server';
import { load as persoaLoad } from './conserxeria/persoa/+page.server';
import { load as validarLoad } from './conserxeria/validar/+page.server';

const NOW = new Date('2026-11-24T10:00:00+01:00');

const statusOf = async (fn: () => unknown) => {
	try {
		await fn();
	} catch (error) {
		return (error as { status: number }).status;
	}
	throw new Error('A ruta non rexeitou o acceso');
};

describe('rol de apertura', () => {
	it('só pode ver a axenda e validar, e non pode mutar reservas', async () => {
		const db = await createTestDb();
		const fixture = await seedFixture(db);
		const [opener] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'opener', displayName: 'Iria Apertura' })
			.returning();
		await db
			.insert(staffRoles)
			.values({ userId: opener.id, municipalityId: fixture.municipalityId, role: 'apertura' });
		const event = (path: string, method = 'GET') =>
			makeEvent({
				db,
				user: opener,
				now: NOW,
				method,
				url: `http://localhost/ribadavila/${path}`,
				params: { slug: 'ribadavila' }
			}) as never;

		await expect(agendaLoad(event('conserxeria'))).resolves.toBeTruthy();
		await expect(validarLoad(event('conserxeria/validar'))).resolves.toBeTruthy();
		for (const load of [novaLoad, persoaLoad, monederoLoad, follaLoad, adminLoad]) {
			expect(await statusOf(() => load(event('prohibida')))).toBe(403);
		}
		expect(
			await statusOf(() => agendaActions.cancelar(event('conserxeria?reserva=x', 'POST')))
		).toBe(403);
		for (const action of [agendaActions.chegou, agendaActions.nonVeu]) {
			expect(
				await statusOf(() =>
					action(event('conserxeria?reserva=00000000-0000-4000-8000-000000000000', 'POST'))
				)
			).toBe(403);
		}
	});
});
