// SPDX-License-Identifier: EUPL-1.2
// Reservas de tempada desde administración (tarefa 6): crear (varios días), editar e quitar;
// avisa antes de gardar se pisa reservas (confirmar cancelalas) ou outra tempada (bloqueado).
import { and, eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../lib/server/db/client';
import { bookings, notifications, staffRoles, users } from '../../../lib/server/db/schema';
import { localDateTimeToUtc } from '../../../lib/server/domain/time';
import { createTestDb } from '../../../lib/server/db/test-db';
import { makeEvent } from '../../../lib/server/http/test-event';
import { createBooking } from '../../../lib/server/services/bookings';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { createSeason, listSeasons } from '../../../lib/server/services/seasons';
import { load as dayLoad } from '../reservar/[typeId]/+page.server';
import { actions, load } from './temporadas/+page.server';
import TemporadasPage from './temporadas/+page.svelte';

// Venres 20 nov 2026; martes 24 e xoves 26 dentro da ventá de reserva.
const NOW = new Date('2026-11-20T10:00:00+01:00');
const TUESDAY = '2026-11-24';
const THURSDAY = '2026-11-26';
type U = { id: string; displayName: string };
type Form = Record<string, string | string[]>;
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;
let outsider: U;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const ev = (
	user: U | null,
	form?: Form,
	query = '',
	path = 'admin/temporadas',
	params: Record<string, string> = {}
) => {
	const event = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila', ...params },
		url: `http://localhost/ribadavila/${path}${query}`,
		method: form ? 'POST' : 'GET'
	});
	if (form) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(form))
			for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
		Object.defineProperty(event, 'request', {
			value: new Request(event.url, { method: 'POST', body: fd })
		});
	}
	return event as never;
};
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => Promise<T>)(event as never);

const page = async (form: unknown, query = '') => {
	const data = await call<Record<string, unknown>>(load, ev(admin, undefined, query));
	return render(TemporadasPage, {
		props: {
			data: {
				...data,
				locale: 'gl',
				municipality: { slug: 'ribadavila', name: 'Ribadávila', hasLogo: false }
			},
			form: (form as { data?: unknown })?.data ?? form,
			params: {}
		} as never
	}).body;
};

const season = (over: Form = {}): Form => ({
	entityName: 'CD Ribadávila',
	lugar: fx.facilityId,
	weekday: ['1'],
	startsTime: '19:00',
	endsTime: '20:30',
	fromDate: '2026-10-01',
	toDate: '2027-06-30',
	...over
});

/** Horas da tira de reserva da veciñanza ese día: «19:00» → libre ou non. */
const residentHours = async (date: string) => {
	const data = await call<{ hours: { time: string; free: boolean }[] }>(
		dayLoad,
		ev(null, undefined, `?date=${date}`, `reservar/${fx.typeId}`, { typeId: fx.typeId })
	);
	return Object.fromEntries(data.hours.map((h) => [h.time, h.free]));
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Rebeca Dorrío');
	conserxe = await mkUser('cons', 'Xoán Conserxe');
	outsider = await mkUser('admin-monte', 'Admin Montemaior');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: outsider.id, municipalityId: fx.otherMunicipalityId, role: 'admin' }
	]);
});

describe('tempadas', () => {
	it('unha tempada bloquea esas horas na reserva da veciñanza', async () => {
		expect((await residentHours(TUESDAY))['19:00']).toBe(true);
		const res = await call(actions.gardar, ev(admin, season()));
		expect(res).toEqual({ saved: true, cancelled: 0 });
		const hours = await residentHours(TUESDAY);
		expect([hours['18:00'], hours['19:00'], hours['20:00'], hours['21:00']]).toEqual([
			true,
			false,
			false,
			true
		]);
		const html = await page(res);
		expect(html).toContain('Tempada gardada.');
		expect(html).toContain('CD Ribadávila');
		expect(html).toContain('Martes, 19:00–20:30');
		expect(html).toContain('data-tour="tempadas"');
	});

	it('sobre reservas confirmadas pide confirmar a cancelación; ao confirmar cancela e avisa', async () => {
		const booked = await createBooking(db, {
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt: localDateTimeToUtc(THURSDAY, '19:00'),
			channel: 'online',
			createdByUserId: fx.userId,
			now: NOW
		});
		if (!booked.ok) throw new Error(booked.error);
		const form = season({ entityName: 'Escola de pádel', weekday: ['3'] });
		const res = await call(actions.gardar, ev(admin, form));
		expect(res).toMatchObject({
			status: 409,
			data: {
				error: 'CONFLICTS',
				total: 1,
				weekdays: [3],
				conflicts: [{ id: booked.value.id, date: THURSDAY, start: '19:00', end: '20:00' }]
			}
		});
		expect((await listSeasons(db, fx.municipalityId)).map((s) => s.entityName)).toEqual([
			'CD Ribadávila'
		]);
		const html = await page(res);
		expect(html).toContain('Esta tempada pisa 1 reserva confirmada:');
		expect(html).toContain('26/11/2026 · 19:00–20:00');
		expect(html).toContain('Gardar e cancelar esas reservas');
		expect(html).toContain('name="confirmar" value="1"');
		expect(html).toContain('name="weekday" value="3"');

		const ok = await call(actions.gardar, ev(admin, { ...form, confirmar: '1' }));
		expect(ok).toEqual({ saved: true, cancelled: 1 });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, booked.value.id));
		expect(row.status).toBe('cancelled');
		const notices = await db
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.bookingId, booked.value.id),
					eq(notifications.kind, 'cancelled_by_staff')
				)
			);
		expect(notices).toHaveLength(1);
		expect(notices[0].params).toMatchObject({ season: 'Escola de pádel' });
		expect(await page(ok)).toContain('Tempada gardada. Cancelouse 1 reserva e avisouse á persoa.');
	});

	it('se pisa outra tempada, bloquéase (tamén con confirmar) e lista cal', async () => {
		const form = season({ entityName: 'Club Xuvenil', startsTime: '18:00', endsTime: '19:30' });
		for (const extra of [{}, { confirmar: '1' }] as Form[]) {
			const res = await call(actions.gardar, ev(admin, { ...form, ...extra }));
			expect(res).toMatchObject({
				status: 409,
				data: { error: 'SEASON_OVERLAP', overlaps: [{ entityName: 'CD Ribadávila' }] }
			});
			const html = await page(res);
			expect(html).toContain('Non se pode gardar: coincide con outra tempada');
			expect(html).not.toContain('Gardar e cancelar esas reservas');
		}
		expect(await listSeasons(db, fx.municipalityId)).toHaveLength(2);
	});

	it('varios días dunha vez; editar (un só día) e quitar', async () => {
		const res = await call(
			actions.gardar,
			ev(
				admin,
				season({
					entityName: 'Ximnasia',
					weekday: ['5', '6'],
					startsTime: '10:00',
					endsTime: '11:00'
				})
			)
		);
		expect(res).toEqual({ saved: true, cancelled: 0 });
		const gym = (await listSeasons(db, fx.municipalityId)).filter(
			(s) => s.entityName === 'Ximnasia'
		);
		expect(gym.map((s) => s.weekday)).toEqual([5, 6]);

		const cd = (await listSeasons(db, fx.municipalityId)).find(
			(s) => s.entityName === 'CD Ribadávila'
		)!;
		const editing = await call<{ editing: { id: string } | null }>(
			load,
			ev(admin, undefined, `?editar=${cd.id}`)
		);
		expect(editing.editing?.id).toBe(cd.id);
		expect(await page(null, `?editar=${cd.id}`)).toContain('type="radio"');
		expect(
			await call(actions.gardar, ev(admin, season({ id: cd.id, weekday: ['1', '2'] })))
		).toMatchObject({ status: 400 });
		expect(
			await call(
				actions.gardar,
				ev(admin, season({ id: cd.id, startsTime: '20:00', endsTime: '21:00' }))
			)
		).toEqual({ saved: true, cancelled: 0 });
		let hours = await residentHours(TUESDAY);
		expect([hours['19:00'], hours['20:00']]).toEqual([true, false]);

		expect(await call(actions.borrar, ev(admin, { id: cd.id }))).toEqual({ deleted: true });
		hours = await residentHours(TUESDAY);
		expect(hours['20:00']).toBe(true);
		expect(await call(actions.borrar, ev(admin, { id: cd.id }))).toMatchObject({ status: 404 });
	});

	it('datos mal: 400; instalación ou tempada doutro concello: 404', async () => {
		expect(await call(actions.gardar, ev(admin, season({ weekday: [] })))).toMatchObject({
			status: 400
		});
		expect(
			await call(actions.gardar, ev(admin, season({ startsTime: '21:00', endsTime: '20:00' })))
		).toMatchObject({ status: 400 });
		expect(
			await call(actions.gardar, ev(admin, season({ lugar: fx.otherFacilityId })))
		).toMatchObject({ status: 404 });
		const foreign = await createSeason(
			db,
			fx.otherMunicipalityId,
			{
				facilityId: fx.otherFacilityId,
				entityName: 'Outro club',
				weekday: 0,
				startsTime: '10:00',
				endsTime: '11:00',
				fromDate: '2026-10-01',
				toDate: '2026-12-31',
				createdBy: outsider.id
			},
			{ confirm: false, now: NOW }
		);
		if (!foreign.ok) throw new Error(foreign.error);
		const id = foreign.value.id;
		await expect(call(load, ev(admin, undefined, `?editar=${id}`))).rejects.toMatchObject({
			status: 404
		});
		expect(await call(actions.gardar, ev(admin, season({ id })))).toMatchObject({ status: 404 });
		expect(await call(actions.borrar, ev(admin, { id }))).toMatchObject({ status: 404 });
	});

	it('garda: conserxe e admin doutro concello dan 403', async () => {
		for (const user of [conserxe, outsider]) {
			await expect(call(load, ev(user))).rejects.toMatchObject({ status: 403 });
			await expect(call(actions.gardar, ev(user, season()))).rejects.toMatchObject({
				status: 403
			});
			await expect(
				call(actions.borrar, ev(user, { id: crypto.randomUUID() }))
			).rejects.toMatchObject({ status: 403 });
		}
	});
});
