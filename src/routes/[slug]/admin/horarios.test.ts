// SPDX-License-Identifier: EUPL-1.2
// Horarios: táboa de todas as instalacións coas franxas editables no seu sitio.
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	facilities,
	holidays,
	notifications,
	openingHours,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { listAllFacilities } from '../../../lib/server/services/admin';
import { makeEvent } from '../../../lib/server/http/test-event';
import {
	addLocalDays,
	localDateOf,
	localDateTimeToUtc,
	weekdayOf
} from '../../../lib/server/domain/time';
import { actions, load } from './horarios/+page.server';
import HorariosPage from './horarios/+page.svelte';

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;
let secondId = '';

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const ev = (user: U | null, form?: Record<string, string>, query = '') => {
	const event = makeEvent({
		db,
		user,
		params: { slug: 'ribadavila' },
		url: `http://localhost/ribadavila/admin/horarios${query}`,
		method: form ? 'POST' : 'GET'
	});
	if (form) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(form)) fd.set(k, v);
		Object.defineProperty(event, 'request', {
			value: new Request(event.url, { method: 'POST', body: fd })
		});
	}
	return event as never;
};

const props = (data: Record<string, unknown>, form?: Record<string, unknown>) => ({
	props: {
		data: {
			locale: 'gl',
			municipality: { slug: 'ribadavila', name: 'Ribadávila', hasLogo: false },
			...data
		} as never,
		form: form as never,
		params: {} as never
	}
});

const hoursOf = async (id: string) =>
	(await listAllFacilities(db, fx.municipalityId)).find((f) => f.id === id)!.hours;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Rebeca Dorrío');
	conserxe = await mkUser('cons', 'Xoán Conserxe');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
	const [second] = await db
		.insert(facilities)
		.values({
			municipalityId: fx.municipalityId,
			typeId: fx.typeId,
			name: 'Pista 2',
			slotMinutes: 60,
			priceResidentCents: 0,
			priceNonResidentCents: 0
		})
		.returning();
	secondId = second.id;
	await db.insert(openingHours).values([
		{ facilityId: secondId, weekday: 0, opens: '09:00', closes: '14:00' },
		{ facilityId: secondId, weekday: 0, opens: '16:00', closes: '23:00' }
	]);
});

describe('táboa de horarios', () => {
	it('administra festivos, incluída a precarga anual', async () => {
		const added = await actions.festivo(
			ev(admin, { date: '2026-12-31', name: 'Fin de ano', mode: 'sunday_hours' })
		);
		expect(added).toMatchObject({ holidaySaved: true });
		const fixed = await actions.festivosFixos(ev(admin, { year: '2026' }));
		expect(fixed).toMatchObject({ holidaysLoaded: true });
		const rows = await db
			.select()
			.from(holidays)
			.where(eq(holidays.municipalityId, fx.municipalityId));
		expect(rows).toHaveLength(12);
		const loaded = await load(ev(admin));
		const html = render(HorariosPage, props(loaded as never) as never).body;
		expect(html).toContain('Festivos');
		expect(html).toContain('Engadir festivos nacionais e de Galicia de');
		const removed = await actions.borrarFestivo(ev(admin, { holidayId: rows[0].id }));
		expect(removed).toMatchObject({ holidayDeleted: true });
		expect(
			await db.select().from(holidays).where(eq(holidays.municipalityId, fx.municipalityId))
		).toHaveLength(11);
	});

	it('lista todas as instalacións coas franxas de cada día', async () => {
		const data = await load(ev(admin));
		const html = render(HorariosPage, props(data as never) as never).body;
		expect(html).toContain('<table');
		expect(html).toContain('Pista 1');
		expect(html).toContain('Pista 2');
		expect(html).toContain('9–14');
		expect(html).toContain('16–23');
		expect(html).toContain(`?editar=${secondId}`);
	});

	it('en modo edición a fila ten entradas de hora ligadas ao seu formulario', async () => {
		const data = await load(ev(admin, undefined, `?editar=${secondId}`));
		const html = render(HorariosPage, props(data as never) as never).body;
		expect(html).toContain(`id="h-${secondId}"`);
		expect(html).toMatch(
			new RegExp(`type="time"[^>]*form="h-${secondId}"|form="h-${secondId}"[^>]*type="time"`)
		);
		expect(html).toMatch(
			/name="h-0-1-opens"[^>]*value="16:00"|value="16:00"[^>]*name="h-0-1-opens"/
		);
	});

	it('gardar as franxas dunha instalación non toca as outras', async () => {
		const res = await actions.horario(
			ev(admin, {
				facilityId: secondId,
				'h-0-0-opens': '10:00',
				'h-0-0-closes': '14:00',
				'h-3-0-opens': '17:00',
				'h-3-0-closes': '21:00'
			})
		);
		expect(res).toMatchObject({ hoursSaved: true, facilityId: secondId });
		expect(await hoursOf(secondId)).toEqual([
			{ weekday: 0, opens: '10:00', closes: '14:00' },
			{ weekday: 3, opens: '17:00', closes: '21:00' }
		]);
		expect(await hoursOf(fx.facilityId)).toHaveLength(7);
	});

	it('franxas mal (fin antes do comezo, solapadas) dan erros por día e non gardan', async () => {
		const res = await actions.horario(
			ev(admin, {
				facilityId: secondId,
				'h-1-0-opens': '18:00',
				'h-1-0-closes': '17:00',
				'h-2-0-opens': '10:00',
				'h-2-0-closes': '14:00',
				'h-2-1-opens': '13:00',
				'h-2-1-closes': '15:00'
			})
		);
		expect(res).toMatchObject({
			status: 400,
			data: { facilityId: secondId, dayErrors: { 1: 'orde', 2: 'solapa' } }
		});
		expect(await hoursOf(secondId)).toHaveLength(2);
		const html = render(
			HorariosPage,
			props(
				(await load(ev(admin))) as never,
				(res as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('role="alert"');
		expect(html).toContain('aria-invalid="true"');
	});

	it('unha franxa que non encaixa coa duración dá o erro «multiplo» no seu día', async () => {
		const res = await actions.horario(
			ev(admin, { facilityId: secondId, 'h-4-0-opens': '09:00', 'h-4-0-closes': '10:30' })
		);
		expect(res).toMatchObject({
			status: 400,
			data: { facilityId: secondId, error: 'INVALID_CONFIG', dayErrors: { 4: 'multiplo' } }
		});
		const html = render(
			HorariosPage,
			props(
				(await load(ev(admin))) as never,
				(res as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('Venres: Cada franxa ten que durar un número enteiro de reservas.');
	});

	it('un cambio que deixa fóra reservas pide confirmación e logo avisa', async () => {
		let monday = addLocalDays(localDateOf(new Date()), 7);
		while (weekdayOf(monday) !== 0) monday = addLocalDays(monday, 1);
		const startsAt = localDateTimeToUtc(monday, '10:00');
		await db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3_600_000),
			accessCode: '123123',
			priceCents: 300,
			channel: 'online' as const,
			createdByUserId: fx.userId
		});
		const form = { facilityId: fx.facilityId, 'h-0-0-opens': '16:00', 'h-0-0-closes': '22:00' };
		const res = await actions.horario(ev(admin, form));
		expect(res).toMatchObject({
			status: 409,
			data: { affected: 1, accion: 'horario', facilityId: fx.facilityId }
		});
		expect(await hoursOf(fx.facilityId)).toHaveLength(7);
		const html = render(
			HorariosPage,
			props(
				(await load(ev(admin))) as never,
				(res as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('Hai 1 reserva confirmada');
		expect(html).toContain('name="confirmar" value="1"');

		const saved = await actions.horario(ev(admin, { ...form, confirmar: '1' }));
		expect(saved).toMatchObject({ hoursSaved: true });
		expect(await hoursOf(fx.facilityId)).toEqual([{ weekday: 0, opens: '16:00', closes: '22:00' }]);
		const notices = await db
			.select()
			.from(notifications)
			.where(eq(notifications.kind, 'hours_changed'));
		expect(notices).toHaveLength(1);
	});

	it('instalación doutro concello: 404; conserxe: 403', async () => {
		const res = await actions.horario(
			ev(admin, { facilityId: fx.otherFacilityId, 'h-0-0-opens': '10:00', 'h-0-0-closes': '12:00' })
		);
		expect(res).toMatchObject({ status: 404 });
		await expect(load(ev(conserxe))).rejects.toMatchObject({ status: 403 });
		await expect(actions.horario(ev(conserxe, { facilityId: secondId }))).rejects.toMatchObject({
			status: 403
		});
	});
});
