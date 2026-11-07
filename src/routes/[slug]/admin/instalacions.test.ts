// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { bookings, notifications, staffRoles, users } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import {
	listAllFacilities,
	listClosures,
	listFacilityTypes
} from '../../../lib/server/services/admin';
import { listActiveFacilities } from '../../../lib/server/services/facilities';
import { facilities, facilityTypes } from '../../../lib/server/db/schema';
import { makeEvent } from '../../../lib/server/http/test-event';
import { MASCOTS } from '../../../lib/mascots';
import {
	addLocalDays,
	localDateOf,
	localDateTimeToUtc,
	weekdayOf
} from '../../../lib/server/domain/time';
import { load as listLoad } from './instalacions/+page.server';
import { actions as novaActions, load as novaLoad } from './instalacions/nova/+page.server';
import { actions as editActions, load as editLoad } from './instalacions/[id]/+page.server';
import { actions as tipoActions, load as tipoLoad } from './instalacions/tipos/[id]/+page.server';
import { load as horariosLoad } from './horarios/+page.server';
import { actions as asisActions, load as asisLoad } from './instalacions/asistente/+page.server';
import AsisPage from './instalacions/asistente/+page.svelte';
import { createFacilityWithType } from '../../../lib/server/services/admin';
import { FACILITY_TEMPLATES } from '../../../lib/server/services/facility-templates';
import ListPage from './instalacions/+page.svelte';
import NovaPage from './instalacions/nova/+page.svelte';
import EditPage from './instalacions/[id]/+page.svelte';
import TipoPage from './instalacions/tipos/[id]/+page.svelte';
import HorariosPage from './horarios/+page.svelte';

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const ev = (
	user: U | null,
	form?: Record<string, string>,
	path = 'admin/instalacions',
	params: Record<string, string> = {}
) => {
	const event = makeEvent({
		db,
		user,
		params: { slug: 'ribadavila', ...params },
		url: `http://localhost/ribadavila/${path}`,
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

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Rebeca Dorrío');
	conserxe = await mkUser('cons', 'Xoán Conserxe');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
});

const typeForm = (over: Record<string, string> = {}) => ({
	nameGl: 'Bolos',
	nameEs: 'Bolos',
	mascot: 'bolos',
	color: '#E3B26A',
	bookingMode: 'slot',
	...over
});

const facilityForm = (typeId: string, over: Record<string, string> = {}) => ({
	typeId,
	name: 'Bolera municipal',
	location: 'Polideportivo, planta baixa',
	address: 'Rúa do Deporte 3',
	units: '1',
	capacity: '1',
	slotMinutes: '60',
	priceResident: '3',
	priceNonResident: '6,50',
	accessible: 'on',
	rules: 'Calzado limpo.',
	...over
});

let bolosTypeId = '';
let bolosFacilityId = '';

describe('tipos', () => {
	it('crear un tipo con mascot bolos funciona', async () => {
		await expect(
			tipoActions.default(ev(admin, typeForm(), 'admin/instalacions/tipos/novo', { id: 'novo' }))
		).rejects.toMatchObject({ status: 303 });
		const types = await listFacilityTypes(db, fx.municipalityId);
		const t = types.find((x) => x.nameGl === 'Bolos');
		expect(t).toMatchObject({ mascot: 'bolos', color: '#E3B26A', bookingMode: 'slot' });
		bolosTypeId = t!.id;
	});

	it('un tipo con mascot vacío usa sala', async () => {
		await expect(
			tipoActions.default(
				ev(admin, typeForm({ nameGl: 'Sala', nameEs: 'Sala', mascot: '' }), 'x', { id: 'novo' })
			)
		).rejects.toMatchObject({ status: 303 });
		const t = (await listFacilityTypes(db, fx.municipalityId)).find((x) => x.nameGl === 'Sala');
		expect(t?.mascot).toBe('sala');
	});

	it('mascot desconocido, color o modo inválidos dan 400', async () => {
		for (const bad of [
			{ mascot: 'dragon' },
			{ color: 'azul' },
			{ bookingMode: 'x' },
			{ nameGl: ' ' }
		] as Record<string, string>[]) {
			const res = await tipoActions.default(ev(admin, typeForm(bad), 'x', { id: 'novo' }));
			expect(res).toMatchObject({ status: 400 });
		}
	});

	it('editar un tipo existente y 404 con id ajeno', async () => {
		const res = await tipoActions.default(
			ev(admin, typeForm({ nameGl: 'Bolos e petanca' }), 'x', { id: bolosTypeId })
		);
		expect(res).toMatchObject({ saved: true });
		const data = await tipoLoad(ev(admin, undefined, 'x', { id: bolosTypeId }));
		expect(data).toMatchObject({ type: { nameGl: 'Bolos e petanca' } });
		await expect(
			tipoLoad(ev(admin, undefined, 'x', { id: crypto.randomUUID() }))
		).rejects.toMatchObject({
			status: 404
		});
	});

	it('cambiar el modo con configuración incompatible muestra INVALID_CONFIG con issues', async () => {
		const res = await tipoActions.default(
			ev(admin, typeForm({ bookingMode: 'unit' }), 'x', { id: fx.typeId })
		);
		expect(res).toMatchObject({ status: 400, data: { error: 'INVALID_CONFIG' } });
		const data = (res as unknown as { data: { issues: unknown[] } }).data;
		expect(data.issues.length).toBeGreaterThan(0);
	});
});

describe('instalacións', () => {
	it('crear una instalación con todos los campos la lista con location', async () => {
		let redirectTo = '';
		try {
			await novaActions.default(ev(admin, facilityForm(bolosTypeId), 'admin/instalacions/nova'));
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
			redirectTo = (e as { location: string }).location;
		}
		const all = await listAllFacilities(db, fx.municipalityId);
		const f = all.find((x) => x.name === 'Bolera municipal');
		expect(f).toMatchObject({
			location: 'Polideportivo, planta baixa',
			address: 'Rúa do Deporte 3',
			priceResidentCents: 300,
			priceNonResidentCents: 650,
			accessible: true,
			rules: 'Calzado limpo.',
			slotMinutes: 60,
			units: 1,
			capacity: 1
		});
		bolosFacilityId = f!.id;
		expect(redirectTo).toContain(`/ribadavila/admin/instalacions/${f!.id}`);
		const data = (await listLoad(ev(admin))) as never as { facilities: { location: string }[] };
		expect(data.facilities.some((x) => x.location === 'Polideportivo, planta baixa')).toBe(true);
	});

	it('datos inválidos dan 400 con issues y no crean nada', async () => {
		const before = (await listAllFacilities(db, fx.municipalityId)).length;
		const res = await novaActions.default(
			ev(admin, facilityForm(bolosTypeId, { slotMinutes: '20' }), 'admin/instalacions/nova')
		);
		expect(res).toMatchObject({ status: 400, data: { error: 'INVALID_CONFIG' } });
		const bad = await novaActions.default(
			ev(admin, facilityForm(bolosTypeId, { priceResident: 'gratis' }), 'x')
		);
		expect(bad).toMatchObject({ status: 400 });
		expect((await listAllFacilities(db, fx.municipalityId)).length).toBe(before);
	});

	it('editar guarda los cambios de accesibilidad y marca la comprobación hoy', async () => {
		const today = localDateOf(new Date());
		const res = await editActions.gardar(
			ev(
				admin,
				facilityForm(bolosTypeId, {
					name: 'Bolera nova',
					accessible: '',
					stepFreeAccess: 'partial',
					adaptedToilet: 'yes',
					adaptedChangingRoom: 'no',
					accessibleParkingNearby: 'yes',
					hearingLoop: 'no',
					supportContact: 'Conserxaría',
					accessibilityNotes: 'Entrada lateral sen chanzos.'
				}),
				'x',
				{ id: bolosFacilityId }
			)
		);
		expect(res).toMatchObject({ saved: true });
		const f = (await listAllFacilities(db, fx.municipalityId)).find(
			(x) => x.id === bolosFacilityId
		);
		expect(f).toMatchObject({
			name: 'Bolera nova',
			accessible: false,
			stepFreeAccess: 'partial',
			adaptedToilet: true,
			adaptedChangingRoom: false,
			accessibleParkingNearby: true,
			hearingLoop: false,
			supportContact: 'Conserxaría',
			accessibilityNotes: 'Entrada lateral sen chanzos.',
			accessibilityCheckedAt: today
		});
	});

	it('replaceHours con 2 tramos el lunes los guarda', async () => {
		const res = await editActions.horario(
			ev(
				admin,
				{
					'h-0-0-opens': '09:00',
					'h-0-0-closes': '13:00',
					'h-0-1-opens': '17:00',
					'h-0-1-closes': '23:00',
					'h-5-0-opens': '10:00',
					'h-5-0-closes': '17:00'
				},
				'x',
				{ id: bolosFacilityId }
			)
		);
		expect(res).toMatchObject({ hoursSaved: true });
		const f = (await listAllFacilities(db, fx.municipalityId)).find(
			(x) => x.id === bolosFacilityId
		);
		expect(f?.hours).toEqual([
			{ weekday: 0, opens: '09:00', closes: '13:00' },
			{ weekday: 0, opens: '17:00', closes: '23:00' },
			{ weekday: 5, opens: '10:00', closes: '17:00' }
		]);
	});

	it('un tramo con closes <= opens da 400 y no cambia el horario', async () => {
		const res = await editActions.horario(
			ev(admin, { 'h-1-0-opens': '18:00', 'h-1-0-closes': '18:00' }, 'x', { id: bolosFacilityId })
		);
		expect(res).toMatchObject({ status: 400, data: { error: 'INVALID_CONFIG' } });
		const half = await editActions.horario(
			ev(admin, { 'h-1-0-opens': '18:00', 'h-1-0-closes': '' }, 'x', { id: bolosFacilityId })
		);
		expect(half).toMatchObject({ status: 400 });
		const f = (await listAllFacilities(db, fx.municipalityId)).find(
			(x) => x.id === bolosFacilityId
		);
		expect(f?.hours).toHaveLength(3);
	});

	it('desactivar con reservas futuras da 409 con count; sin ellas desactiva', async () => {
		const start = new Date(Date.now() + 3 * 86_400_000);
		const end = new Date(start.getTime() + 3_600_000);
		await db.insert(bookings).values(
			[1, 2].map((i) => ({
				municipalityId: fx.municipalityId,
				facilityId: bolosFacilityId,
				profileId: fx.profileId,
				startsAt: new Date(start.getTime() + i * 7_200_000),
				endsAt: new Date(end.getTime() + i * 7_200_000),
				accessCode: `12345${i}`,
				priceCents: 300,
				channel: 'online' as const,
				createdByUserId: fx.userId
			}))
		);
		const res = await editActions.pechar(ev(admin, {}, 'x', { id: bolosFacilityId }));
		expect(res).toMatchObject({ status: 409, data: { error: 'HAS_FUTURE_BOOKINGS', count: 2 } });
		let f = (await listAllFacilities(db, fx.municipalityId)).find((x) => x.id === bolosFacilityId);
		expect(f?.active).toBe(true);

		const html = render(
			EditPage,
			props(
				{ ...(await editLoad(ev(admin, undefined, 'x', { id: bolosFacilityId }))) },
				(res as unknown as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('Ten 2 reservas futuras. Cancélaas ou espera a que pasen');

		await db.delete(bookings);
		const ok = await editActions.pechar(ev(admin, {}, 'x', { id: bolosFacilityId }));
		expect(ok).toMatchObject({ closed: true });
		f = (await listAllFacilities(db, fx.municipalityId)).find((x) => x.id === bolosFacilityId);
		expect(f?.active).toBe(false);
	});

	it('crear y borrar un cierre funciona', async () => {
		const res = await editActions.peche(
			ev(admin, { from: '2026-12-01', to: '2026-12-31', reason: 'Obras no tellado' }, 'x', {
				id: bolosFacilityId
			})
		);
		expect(res).toMatchObject({ closureSaved: true });
		let list = await listClosures(db, fx.municipalityId, bolosFacilityId);
		expect(list.ok && list.value).toHaveLength(1);
		const c = list.ok ? list.value[0] : null;
		// 1 dic 00:00 → 1 ene 00:00 hora de Madrid (CET = UTC+1)
		expect(c?.startsAt.toISOString()).toBe('2026-11-30T23:00:00.000Z');
		expect(c?.endsAt.toISOString()).toBe('2026-12-31T23:00:00.000Z');
		expect(c?.reason).toBe('Obras no tellado');

		const data = await editLoad(ev(admin, undefined, 'x', { id: bolosFacilityId }));
		expect(data).toMatchObject({ closures: [{ id: c!.id, from: '2026-12-01', to: '2026-12-31' }] });

		const bad = await editActions.peche(
			ev(admin, { from: '2026-12-10', to: '2026-12-01', reason: '' }, 'x', { id: bolosFacilityId })
		);
		expect(bad).toMatchObject({ status: 400 });

		const del = await editActions.borrarPeche(
			ev(admin, { closureId: c!.id }, 'x', { id: bolosFacilityId })
		);
		expect(del).toMatchObject({ closureDeleted: true });
		list = await listClosures(db, fx.municipalityId, bolosFacilityId);
		expect(list.ok && list.value).toHaveLength(0);
		const gone = await editActions.borrarPeche(
			ev(admin, { closureId: c!.id }, 'x', { id: bolosFacilityId })
		);
		expect(gone).toMatchObject({ status: 404 });
	});

	it('editar una instalación de otro concello devuelve 404', async () => {
		await expect(
			editLoad(ev(admin, undefined, 'x', { id: fx.otherFacilityId }))
		).rejects.toMatchObject({ status: 404 });
		const res = await editActions.gardar(
			ev(admin, facilityForm(bolosTypeId), 'x', { id: fx.otherFacilityId })
		);
		expect(res).toMatchObject({ status: 404 });
	});
});

describe('conserxe', () => {
	it('da 403 en todas las acciones y cargas', async () => {
		const id = { id: bolosFacilityId };
		const calls = [
			() => listLoad(ev(conserxe)),
			() => novaLoad(ev(conserxe)),
			() => novaActions.default(ev(conserxe, facilityForm(bolosTypeId))),
			() => editLoad(ev(conserxe, undefined, 'x', id)),
			() => editActions.gardar(ev(conserxe, facilityForm(bolosTypeId), 'x', id)),
			() => editActions.horario(ev(conserxe, {}, 'x', id)),
			() => editActions.pechar(ev(conserxe, {}, 'x', id)),
			() => editActions.peche(ev(conserxe, { from: '2026-12-01', to: '2026-12-02' }, 'x', id)),
			() => editActions.borrarPeche(ev(conserxe, { closureId: 'x' }, 'x', id)),
			() => editActions.reactivar(ev(conserxe, {}, 'x', id)),
			() => tipoLoad(ev(conserxe, undefined, 'x', { id: 'novo' })),
			() => tipoActions.default(ev(conserxe, typeForm(), 'x', { id: 'novo' })),
			() => horariosLoad(ev(conserxe))
		];
		for (const call of calls) await expect(call()).rejects.toMatchObject({ status: 403 });
	});
});

describe('páginas', () => {
	it('a táboa di cómo se reserva en texto chan, con precios, estado e o botón de nova', async () => {
		const data = await listLoad(ev(admin));
		const rows = (data as never as { facilities: { name: string }[] }).facilities;
		expect(rows.length).toBeGreaterThan(1);
		const html = render(ListPage, props(data as never) as never).body;
		expect(html).toContain('+ Nova instalación');
		expect(html).toContain('Enteira, 1 h');
		expect(html).toContain('3 € / 6,50 €');
		expect(html).toContain('Desactivada');
		expect(html).toContain('Activa');
		expect(html).toContain('Bolera nova');
		expect(html).toContain('Polideportivo, planta baixa');
		expect(html).toContain(`/ribadavila/admin/instalacions/${bolosFacilityId}`);
		expect(html).toContain('/ribadavila/admin/instalacions/tipos/novo');
	});

	it('«Por rúas (4)», «Por aforo (25)» e «Por días»', async () => {
		const row = (mode: string, over: Record<string, unknown>) => ({
			id: mode,
			name: mode,
			typeId: mode,
			location: '',
			active: true,
			units: 1,
			capacity: 1,
			slotMinutes: 60,
			priceResidentCents: 0,
			priceNonResidentCents: 0,
			hours: [],
			bookingMode: mode,
			...over
		});
		const types = ['unit', 'capacity', 'day'].map((m) => ({
			id: m,
			nameGl: m,
			nameEs: m,
			mascot: m === 'unit' ? 'natacion' : m === 'capacity' ? 'ximnasio' : 'sala',
			color: '#1AA6C8',
			bookingMode: m
		}));
		const html = render(
			ListPage,
			props({
				facilities: [row('unit', { units: 4 }), row('capacity', { capacity: 25 }), row('day', {})],
				types
			}) as never
		).body;
		expect(html).toContain('Por rúas (4)');
		expect(html).toContain('Por aforo (25)');
		expect(html).toContain('Por días');
		expect(html).toContain('De balde');
	});

	it('editar: preview con FreeOptionCard, WeekHours con 2 tramos, cierres y personaxes', async () => {
		const data = await editLoad(ev(admin, undefined, 'x', { id: bolosFacilityId }));
		const html = render(EditPage, props(data as never) as never).body;
		expect(html).toContain('Bolera nova');
		expect(html).toContain('name="h-0-1-opens"');
		expect(html).toContain('type="time"');
		expect(html).toContain('Pechar unha temporada');
		expect(html).toContain('Así a ve a veciñanza');
		expect(html).toContain('class="opcion svelte');
		expect(html).not.toContain('class="esta svelte');
		expect(html).toContain('name="location"');
		expect(html).toContain('name="address"');
	});

	it('o INVALID_CONFIG amosa os issues no formulario', async () => {
		const data = await novaLoad(ev(admin));
		const html = render(
			NovaPage,
			props(data as never, {
				error: 'INVALID_CONFIG',
				issues: [{ path: '', message: 'slotMinutes must be an integer' }]
			}) as never
		).body;
		expect(html).toContain('slotMinutes must be an integer');
		expect(html).toContain('role="alert"');
	});

	it('tipo: MascotPicker con 21 radios con nome, cores e modo', async () => {
		const data = await tipoLoad(ev(admin, undefined, 'x', { id: 'novo' }));
		const html = render(TipoPage, props(data as never) as never).body;
		expect((html.match(/type="radio" name="mascot"/g) ?? []).length).toBe(MASCOTS.length);
		expect(html).toContain('name="nameGl"');
		expect(html).toContain('name="nameEs"');
		expect(html).toContain('name="color"');
		expect(html).toContain('name="bookingMode"');
		expect(html).toContain('aria-hidden="true"');
	});

	it('tipo existente: nome, personaxe e eco do formulario saen no HTML de servidor', async () => {
		const data = await tipoLoad(ev(admin, undefined, 'x', { id: bolosTypeId }));
		const html = render(TipoPage, props(data as never) as never).body;
		expect(html).toContain('value="Bolos e petanca"');
		expect(html).toMatch(/type="radio" name="mascot" value="bolos"[^>]*checked/);
		const echoed = render(
			TipoPage,
			props(data as never, {
				error: 'INVALID',
				values: { nameGl: 'Eco gl', mascot: 'golf' }
			}) as never
		).body;
		expect(echoed).toContain('value="Eco gl"');
		expect(echoed).toMatch(/value="golf"[^>]*checked/);
	});

	it('horarios: vista semanal de todas as instalacións con ligazón á ficha', async () => {
		const data = await horariosLoad(ev(admin));
		const html = render(HorariosPage, props(data as never) as never).body;
		expect(html).toContain('Horarios e peches');
		expect(html).toContain(`/ribadavila/admin/instalacions/${bolosFacilityId}`);
		expect(html).toContain('Bolera nova');
	});
});

describe('avisos de reservas afectadas', () => {
	// Próximo lunes (al menos dentro de 7 días) a las 10:00 locales.
	const nextMonday = (() => {
		let d = addLocalDays(localDateOf(new Date()), 7);
		while (weekdayOf(d) !== 0) d = addLocalDays(d, 1);
		return d;
	})();
	const startsAt = localDateTimeToUtc(nextMonday, '10:00');
	const ofFacility = () => ({ id: bolosFacilityId });

	const addBooking = () =>
		db.insert(bookings).values({
			municipalityId: fx.municipalityId,
			facilityId: bolosFacilityId,
			profileId: fx.profileId,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3_600_000),
			accessCode: '777888',
			priceCents: 300,
			channel: 'online' as const,
			createdByUserId: fx.userId
		});

	it('peche sobre unha reserva confirmada: 409 co número; con confirmar=1 gárdase', async () => {
		await addBooking();
		const form = { from: nextMonday, to: nextMonday, reason: 'Obras' };
		const res = await editActions.peche(ev(admin, form, 'x', ofFacility()));
		expect(res).toMatchObject({
			status: 409,
			data: { affected: 1, accion: 'peche', values: form }
		});
		const none = await listClosures(db, fx.municipalityId, bolosFacilityId);
		expect(none.ok && none.value).toHaveLength(0);
		// El primer envío (sin confirmar) no avisa a nadie.
		expect(await db.select().from(notifications)).toHaveLength(0);

		const html = render(
			EditPage,
			props(
				{ ...(await editLoad(ev(admin, undefined, 'x', ofFacility()))) },
				(res as unknown as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('Hai 1 reserva confirmada nese período. Gárdase igualmente?');
		expect(html).toContain('name="confirmar" value="1"');

		const saved = await editActions.peche(
			ev(admin, { ...form, confirmar: '1' }, 'x', ofFacility())
		);
		expect(saved).toMatchObject({ closureSaved: true });
		const list = await listClosures(db, fx.municipalityId, bolosFacilityId);
		expect(list.ok && list.value).toHaveLength(1);
		// O peche bloquea o uso: cancela a reserva e invalida o seu PIN/QR.
		const [row] = await db.select().from(bookings);
		expect(row.status).toBe('cancelled');
		const notices = await db.select().from(notifications);
		expect(notices).toHaveLength(1);
		expect(notices[0]).toMatchObject({ kind: 'cancelled_by_staff', userId: fx.userId });
		expect(notices[0].params).toMatchObject({
			time: '10:00',
			date: nextMonday,
			reason: 'Obras'
		});
	});

	it('peche sen reservas no período gárdase directamente', async () => {
		const later = addLocalDays(nextMonday, 14);
		const res = await editActions.peche(
			ev(admin, { from: later, to: later, reason: '' }, 'x', ofFacility())
		);
		expect(res).toMatchObject({ closureSaved: true });
	});

	it('horario que deixa fóra a reserva: 409; con confirmar=1 gárdase; dentro, directo', async () => {
		// Esta proba é independente do peche anterior, que agora cancela a súa reserva.
		await addBooking();
		const outside = { 'h-0-0-opens': '14:00', 'h-0-0-closes': '18:00' };
		const res = await editActions.horario(ev(admin, outside, 'x', ofFacility()));
		expect(res).toMatchObject({
			status: 409,
			data: { affected: 1, accion: 'horario', values: outside }
		});
		const unchanged = (await listAllFacilities(db, fx.municipalityId)).find(
			(x) => x.id === bolosFacilityId
		);
		expect(unchanged?.hours).toHaveLength(3);
		// El 409 no avisa a nadie.
		const kind = (k: string) =>
			db
				.select()
				.from(notifications)
				.where(eq(notifications.kind, k as 'hours_changed'));
		expect(await kind('hours_changed')).toHaveLength(0);

		const saved = await editActions.horario(
			ev(admin, { ...outside, confirmar: '1' }, 'x', ofFacility())
		);
		expect(saved).toMatchObject({ hoursSaved: true });
		// Confirmado: avisa una vez a la persona titular (mismo conjunto que el 409).
		const hoursNotices = await kind('hours_changed');
		expect(hoursNotices).toHaveLength(1);
		expect(hoursNotices[0]).toMatchObject({ userId: fx.userId });
		expect(hoursNotices[0].params).toMatchObject({ time: '10:00', date: nextMonday });

		// Un horario que a cubre non avisa.
		const inside = await editActions.horario(
			ev(admin, { 'h-0-0-opens': '09:00', 'h-0-0-closes': '13:00' }, 'x', ofFacility())
		);
		expect(inside).toMatchObject({ hoursSaved: true });
		expect(await kind('hours_changed')).toHaveLength(1);
		await db.delete(bookings);
	});
});

describe('asistente de nova instalación', () => {
	type StepOk = { paso: number; values: Record<string, string> };
	type StepFail = { status: number; data: StepOk & { errors: Record<string, string> } };
	const path = 'admin/instalacions/asistente';
	const step = (form: Record<string, string>) => asisActions.paso(ev(admin, form, path));
	const counts = async () => ({
		types: (await db.select().from(facilityTypes)).length,
		facilities: (await db.select().from(facilities)).length
	});
	const padel = FACILITY_TEMPLATES.find((x) => x.key === 'padel')!;

	it('o modelo de pádel enche os pasos e «Crear» fai unha instalación con 2 pistas e o seu horario', async () => {
		const first = (await step({ paso: '0', ir: '1', modelo: 'padel' })) as StepOk;
		expect(first.paso).toBe(1);
		expect(first.values).toMatchObject({
			modelo: 'padel',
			mascota: 'padel',
			modo: 'unit',
			unidades: '2',
			minutos: '90',
			prezoRes: '4',
			prezoNon: '7',
			prezoSocial: '2',
			'h-0-0-opens': '09:00',
			'h-0-1-closes': '22:30'
		});
		// O estado vai en campos ocultos, nunca na URL.
		const html = render(
			AsisPage,
			props({ ...(await asisLoad(ev(admin, undefined, `${path}?paso=1`))) }, first) as never
		).body;
		expect(html).toMatch(/type="hidden" name="h-0-0-opens" value="09:00"/);
		expect(html).toMatch(/name="nome"/);
		expect(html).not.toMatch(/action="[^"]*nome=/);

		const values: Record<string, string> = {
			...first.values,
			nome: 'Pádel do asistente',
			edificio: 'novo'
		};
		values.lugar = 'Pistas novas';
		values.enderezo = 'Rúa Nova 1';
		const before = await counts();
		let location = '';
		try {
			await asisActions.crear(ev(admin, { ...values, paso: '6' }, path));
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
			location = (e as { location: string }).location;
		}
		const f = (await listAllFacilities(db, fx.municipalityId)).find(
			(x) => x.name === 'Pádel do asistente'
		);
		expect(f).toMatchObject({
			units: 2,
			slotMinutes: 90,
			bookingMode: 'unit',
			location: 'Pistas novas',
			address: 'Rúa Nova 1',
			priceResidentCents: 400,
			priceNonResidentCents: 700,
			priceSocialCents: 200
		});
		expect(f?.hours).toEqual(padel.hours);
		expect(location).toContain(`/ribadavila/admin/instalacions/${f!.id}`);
		const after = await counts();
		expect(after).toEqual({ types: before.types + 1, facilities: before.facilities + 1 });

		// Un segundo pádel reutiliza o tipo xa creado.
		try {
			await asisActions.crear(ev(admin, { ...values, nome: 'Pádel 2', paso: '6' }, path));
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		expect(await counts()).toEqual({ types: after.types, facilities: after.facilities + 1 });
	});

	it('«desde cero» valida cada paso con erros por campo e non crea nada', async () => {
		const before = await counts();
		const s0 = (await step({ paso: '0', ir: '1', modelo: 'cero' })) as StepOk;
		expect(s0.paso).toBe(1);
		expect(s0.values.nome ?? '').toBe('');
		let v = s0.values;

		const e1 = (await step({ ...v, paso: '1', ir: '2' })) as unknown as StepFail;
		expect(e1.status).toBe(400);
		expect(e1.data.paso).toBe(1);
		expect(e1.data.errors).toMatchObject({ mascota: expect.any(String), nome: expect.any(String) });
		v = ((await step({ ...v, paso: '1', ir: '2', mascota: 'bolos', nome: 'Bolera' })) as StepOk)
			.values;

		const e2 = (await step({ ...v, paso: '2', ir: '3', edificio: 'novo' })) as unknown as StepFail;
		expect(e2.status).toBe(400);
		expect(e2.data.errors).toHaveProperty('lugar');
		v = (
			(await step({ ...v, paso: '2', ir: '3', edificio: 'novo', lugar: 'Local social' })) as StepOk
		).values;

		const e3 = (await step({
			...v,
			paso: '3',
			ir: '4',
			modo: 'unit',
			unidades: '1',
			minutos: '20'
		})) as unknown as StepFail;
		expect(e3.status).toBe(400);
		expect(e3.data.errors).toMatchObject({
			unidades: expect.any(String),
			minutos: expect.any(String)
		});
		v = ((await step({ ...v, paso: '3', ir: '4', modo: 'slot', minutos: '60' })) as StepOk).values;

		const e4 = (await step({ ...v, paso: '4', ir: '5' })) as unknown as StepFail;
		expect(e4.status).toBe(400);
		expect(e4.data.errors).toHaveProperty('horario');
		const bad = (await step({
			...v,
			paso: '4',
			ir: '5',
			'h-1-0-opens': '18:00',
			'h-1-0-closes': '17:00',
			'h-2-0-opens': '10:00',
			'h-2-0-closes': '14:00',
			'h-2-1-opens': '13:00',
			'h-2-1-closes': '15:00'
		})) as unknown as StepFail;
		expect(bad.status).toBe(400);
		expect(bad.data.errors).toMatchObject({ 'h-1': 'orde', 'h-2': 'solapa' });
		v = (
			(await step({
				...v,
				paso: '4',
				ir: '5',
				'h-0-0-opens': '10:00',
				'h-0-0-closes': '14:00'
			})) as StepOk
		).values;

		const e5 = (await step({
			...v,
			paso: '5',
			ir: '6',
			prezoRes: 'gratis',
			prezoNon: ''
		})) as unknown as StepFail;
		expect(e5.status).toBe(400);
		expect(e5.data.errors).toMatchObject({
			prezoRes: expect.any(String),
			prezoNon: expect.any(String)
		});

		// «Crear» revalida todo: cun campo mal volve ao seu paso.
		const c = (await asisActions.crear(
			ev(admin, { ...v, nome: '', paso: '6', prezoRes: '0', prezoNon: '0' }, path)
		)) as unknown as StepFail;
		expect(c.status).toBe(400);
		expect(c.data.paso).toBe(1);
		expect(await counts()).toEqual(before);
	});

	it('ir cara atrás garda os valores e non volve aplicar o modelo', async () => {
		const s0 = (await step({ paso: '0', ir: '1', modelo: 'padel' })) as StepOk;
		const edited = { ...s0.values, unidades: '5', nome: 'Pádel cuberto' };
		const back = (await step({ ...edited, paso: '3', ir: '2' })) as StepOk;
		expect(back.paso).toBe(2);
		expect(back.values).toMatchObject({ unidades: '5', nome: 'Pádel cuberto' });
		// Volver ao modelo e seguir co mesmo modelo non pisa o editado.
		const again = (await step({ ...back.values, paso: '0', ir: '1' })) as StepOk;
		expect(again.values).toMatchObject({ unidades: '5', nome: 'Pádel cuberto' });
		// Outro modelo si enche cos seus valores.
		const other = (await step({ ...back.values, paso: '0', ir: '1', modelo: 'piscina' })) as StepOk;
		expect(other.values).toMatchObject({ modo: 'capacity', aforo: '25', mascota: 'natacion' });
	});

	it('o paso 4 ten a grella e, sen JS, entradas de hora por día', async () => {
		const s0 = (await step({ paso: '0', ir: '1', modelo: 'padel' })) as StepOk;
		const data = await asisLoad(ev(admin, undefined, `${path}?paso=4`));
		const html = render(
			AsisPage,
			props(data as never, { paso: 4, values: s0.values }) as never
		).body;
		expect(html).toMatch(/type="time"[^>]*name="h-0-0-opens"|name="h-0-0-opens"[^>]*type="time"/);
		expect(html).toContain('Cando está aberta?');
		expect(html).toMatch(/type="hidden" name="nome"/);
	});

	it('o paso 0 ofrece os sete modelos e «Desde cero»', async () => {
		const data = await asisLoad(ev(admin, undefined, path));
		const html = render(AsisPage, props(data as never) as never).body;
		expect((html.match(/type="radio" name="modelo"/g) ?? []).length).toBe(8);
		expect(html).toContain('Que tipo de instalación é?');
	});

	it('createFacilityWithType é unha transacción: unha configuración mala non deixa tipo', async () => {
		const before = await counts();
		const res = await createFacilityWithType(
			db,
			fx.municipalityId,
			{ nameGl: 'Golf', nameEs: 'Golf', mascot: 'golf', color: '#9AA1A0', bookingMode: 'unit' },
			{
				name: 'Golf',
				location: '',
				address: '',
				units: 1,
				capacity: 1,
				slotMinutes: 60,
				priceResidentCents: 0,
				priceNonResidentCents: 0,
				priceSocialCents: null,
				accessible: false,
				rules: ''
			},
			[]
		);
		expect(res).toMatchObject({ ok: false, error: 'INVALID_CONFIG' });
		expect(await counts()).toEqual(before);
	});

	it('conserxe: 403 no asistente', async () => {
		await expect(asisLoad(ev(conserxe, undefined, path))).rejects.toMatchObject({ status: 403 });
		await expect(
			asisActions.paso(ev(conserxe, { paso: '0', ir: '1' }, path))
		).rejects.toMatchObject({ status: 403 });
		await expect(asisActions.crear(ev(conserxe, { paso: '6' }, path))).rejects.toMatchObject({
			status: 403
		});
	});
});

describe('WeekHours editable', () => {
	it('un día con 3 franxas (pintadas no asistente) amosa as 3 para non perdelas ao gardar', async () => {
		const { default: WeekHours } = await import('../../../lib/ui/WeekHours.svelte');
		const html = render(WeekHours, {
			props: {
				editable: true,
				locale: 'gl',
				hours: [
					{ weekday: 6, opens: '08:00', closes: '09:30' },
					{ weekday: 6, opens: '10:00', closes: '14:30' },
					{ weekday: 6, opens: '16:30', closes: '22:30' }
				]
			}
		}).body;
		expect(html).toMatch(
			/name="h-6-2-opens"[^>]*value="16:30"|value="16:30"[^>]*name="h-6-2-opens"/
		);
		expect(html).toContain('name="h-0-1-opens"');
	});
});

describe('pulido tras a revisión', () => {
	const path = 'admin/instalacions/asistente';

	it('un tipo novo co mesmo nome ca outro (noutro modo) leva o modo no nome', async () => {
		const s0 = (await asisActions.paso(
			ev(admin, { paso: '0', ir: '1', modelo: 'padel' }, path)
		)) as unknown as { values: Record<string, string> };
		const values = {
			...s0.values,
			nome: 'Pádel por aforo',
			edificio: 'novo',
			lugar: 'Pistas',
			modo: 'capacity',
			aforo: '4'
		};
		await expect(
			asisActions.crear(ev(admin, { ...values, paso: '6' }, path))
		).rejects.toMatchObject({ status: 303 });
		const types = await listFacilityTypes(db, fx.municipalityId);
		const padel = types.filter((x) => x.mascot === 'padel').map((x) => [x.nameGl, x.nameEs]);
		expect(padel).toContainEqual(['Pádel', 'Pádel']);
		expect(padel).toContainEqual(['Pádel · por aforo', 'Pádel · por aforo']);
	});

	it('a ficha dá os mesmos erros por día ca Horarios («múltiplo»)', async () => {
		const res = await editActions.horario(
			ev(admin, { 'h-0-0-opens': '09:00', 'h-0-0-closes': '10:30' }, 'x', {
				id: bolosFacilityId
			})
		);
		expect(res).toMatchObject({
			status: 400,
			data: { error: 'INVALID_CONFIG', dayErrors: { 0: 'multiplo' } }
		});
	});
});

describe('peche con cancelación, tarifa social e reactivar (tarefa 6)', () => {
	// Un luns dentro de 5 semanas, sen outras reservas.
	const day = (() => {
		let d = addLocalDays(localDateOf(new Date()), 35);
		while (weekdayOf(d) !== 0) d = addLocalDays(d, 1);
		return d;
	})();
	const startsAt = localDateTimeToUtc(day, '10:00');
	const ofFacility = () => ({ id: bolosFacilityId });
	let bookingId = '';

	beforeAll(async () => {
		const [b] = await db
			.insert(bookings)
			.values({
				municipalityId: fx.municipalityId,
				facilityId: bolosFacilityId,
				profileId: fx.profileId,
				startsAt,
				endsAt: new Date(startsAt.getTime() + 3_600_000),
				accessCode: '606060',
				priceCents: 300,
				channel: 'online' as const,
				createdByUserId: fx.userId
			})
			.returning();
		bookingId = b.id;
	});

	it('o aviso «hai 1 reserva» só ofrece confirmar a cancelación', async () => {
		const form = { from: day, to: day, reason: 'Obras' };
		const res = await editActions.peche(ev(admin, form, 'x', ofFacility()));
		expect(res).toMatchObject({ status: 409, data: { affected: 1, accion: 'peche' } });
		const html = render(
			EditPage,
			props(
				{ ...(await editLoad(ev(admin, undefined, 'x', ofFacility()))) },
				(res as unknown as { data: Record<string, unknown> }).data
			) as never
		).body;
		expect(html).toContain('Gardar e cancelar esas reservas');
		expect(html).toContain('name="confirmar" value="1"');
	});

	it('a confirmación garda o peche, cancela a reserva e avisa á persoa', async () => {
		const res = await editActions.peche(
			ev(admin, { from: day, to: day, reason: 'Obras', confirmar: '1' }, 'x', ofFacility())
		);
		expect(res).toEqual({ closureSaved: true });
		const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
		expect(row.status).toBe('cancelled');
		const notices = await db
			.select()
			.from(notifications)
			.where(eq(notifications.bookingId, bookingId));
		// Un só aviso: o da cancelación co motivo (non tamén o do peche).
		expect(notices).toHaveLength(1);
		expect(notices[0]).toMatchObject({ kind: 'cancelled_by_staff', userId: fx.userId });
		expect(notices[0].params).toMatchObject({ reason: 'Obras' });
		const html = render(
			EditPage,
			props(
				{ ...(await editLoad(ev(admin, undefined, 'x', ofFacility()))) },
				res as Record<string, unknown>
			) as never
		).body;
		expect(html).toContain('Peche gardado.');
	});

	it('a tarifa social gárdase, vólvese a ver no formulario e baleira quítase', async () => {
		const save = (priceSocial: string) =>
			editActions.gardar(ev(admin, facilityForm(bolosTypeId, { priceSocial }), 'x', ofFacility()));
		expect(await save('1,50')).toMatchObject({ saved: true });
		const social = async () =>
			(await listAllFacilities(db, fx.municipalityId)).find((f) => f.id === bolosFacilityId)
				?.priceSocialCents;
		expect(await social()).toBe(150);
		const html = render(
			EditPage,
			props({ ...(await editLoad(ev(admin, undefined, 'x', ofFacility()))) }) as never
		).body;
		expect(html).toContain('Tarifa social (opcional)');
		// O formulario da ficha vai á acción «gardar» aínda que a URL traia outra (`?/peche`).
		expect(html).toMatch(/<form id="fac-form" method="POST" action="\?\/gardar"/);
		expect(html).toMatch(/name="priceSocial"[^>]*value="1,50"/);
		expect(await save('tres')).toMatchObject({ status: 400 });
		expect(await social()).toBe(150);
		expect(await save('')).toMatchObject({ saved: true });
		expect(await social()).toBeNull();
		// Sen o campo (cliente vello), non se toca.
		await save('2');
		await editActions.gardar(ev(admin, facilityForm(bolosTypeId), 'x', ofFacility()));
		expect(await social()).toBe(200);
	});

	it('reactivar: a instalación pechada volve á lista de activas', async () => {
		await db.update(facilities).set({ active: false }).where(eq(facilities.id, bolosFacilityId));
		const html = render(
			EditPage,
			props({ ...(await editLoad(ev(admin, undefined, 'x', ofFacility()))) }) as never
		).body;
		expect(html).toContain('action="?/reactivar"');
		expect(html).toContain('Reactivar instalación');
		const res = await editActions.reactivar(ev(admin, {}, 'x', ofFacility()));
		expect(res).toEqual({ reactivated: true });
		const active = await listActiveFacilities(db, fx.municipalityId);
		expect(active.map((f) => f.id)).toContain(bolosFacilityId);
		const list = (await listLoad(ev(admin))) as { facilities: { id: string; active: boolean }[] };
		expect(list.facilities.find((f) => f.id === bolosFacilityId)?.active).toBe(true);
	});

	it('admin doutro concello: 403; recurso doutro concello: 404', async () => {
		const outsider = await mkUser('admin-monte', 'Admin Montemaior');
		await db
			.insert(staffRoles)
			.values({ userId: outsider.id, municipalityId: fx.otherMunicipalityId, role: 'admin' });
		const id = ofFacility();
		for (const call of [
			() => editActions.reactivar(ev(outsider, {}, 'x', id)),
			() =>
				editActions.peche(
					ev(outsider, { from: day, to: day, cancelar: '1', cancelReason: 'x' }, 'x', id)
				),
			() => editActions.gardar(ev(outsider, facilityForm(bolosTypeId), 'x', id))
		]) {
			await expect(call()).rejects.toMatchObject({ status: 403 });
		}
		const other = { id: fx.otherFacilityId };
		expect(await editActions.reactivar(ev(admin, {}, 'x', other))).toMatchObject({ status: 404 });
		expect(
			await editActions.peche(
				ev(admin, { from: day, to: day, cancelar: '1', cancelReason: 'x' }, 'x', other)
			)
		).toMatchObject({ status: 404 });
	});
});
