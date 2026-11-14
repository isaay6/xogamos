// SPDX-License-Identifier: EUPL-1.2
// Flujo de reserva de la vecindad (tarea 6): inicio, día y hora, lo libre, confirmar y llavero.
import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { bookings, facilities, municipalityProfiles, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../lib/server/services/fixtures';
import { t } from '../../lib/i18n';
import ConfirmarPage from './confirmar/+page.svelte';
import FreeOptionCard from '../../lib/ui/FreeOptionCard.svelte';
import { formatCode } from '../../lib/ui/format';
import { load as loadInicio } from './+page.server';
import { actions as confirmarActions, load as loadConfirmar } from './confirmar/+page.server';
import { load as loadXa } from './reserva/[id]/xa/+page.server';
import XaPage from './reserva/[id]/xa/+page.svelte';
import { actions as diaActions, load as loadDia } from './reservar/[typeId]/+page.server';
import { load as loadLibre } from './reservar/[typeId]/libre/+page.server';
import { load as loadFacil } from './reservar/facil/+page.server';
import { clampDate, parseDate } from './municipality.server';

const NOW = new Date('2026-11-24T08:00:00+01:00');
const DATE = '2026-11-24';
const HOURS = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

/** Reserva confirmada insertada a mano, fuera de la transacción de la acción. */
async function occupy(
	db: Db,
	f: Fixture,
	date: string,
	hhmm: string,
	extra: { unitIndex?: number; seats?: number } = {}
): Promise<void> {
	const startsAt = localDateTimeToUtc(date, hhmm);
	await db.insert(bookings).values({
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.residentProfileId,
		unitIndex: extra.unitIndex ?? null,
		seats: extra.seats ?? 1,
		startsAt,
		endsAt: new Date(startsAt.getTime() + 3600_000),
		accessCode: '123456',
		priceCents: 300,
		channel: 'desk',
		createdByUserId: f.userId
	});
}

let db: Db;
let fx: Fixture;
let user: SessionUser;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	user = { id: fx.userId, displayName: 'Nerea Veciña' };
});

const confirmarUrl = (f: Fixture, hhmm: string, date = DATE) =>
	`http://localhost/ribadavila/confirmar?facility=${f.facilityId}&startsAt=${localDateTimeToUtc(date, hhmm).toISOString()}`;

function postForm(db: Db, user: SessionUser, url: string, fields: Record<string, string> = {}) {
	const event = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila' },
		url,
		method: 'POST'
	});
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) form.set(name, value);
	(event as { request: Request }).request = new Request(url, { method: 'POST', body: form });
	return event;
}

describe('inicio', () => {
	it('lista o deporte do fixture e non o de Montemaior', async () => {
		const out = await call<Promise<{ sports: { sport: { typeId: string } }[] }>>(
			loadInicio,
			makeEvent({ db, now: NOW, params: { slug: 'ribadavila' } })
		);
		expect(out.sports.map((s) => s.sport.typeId)).toEqual([fx.typeId]);
	});
});

describe('día e hora', () => {
	it('a acción progresiva apunta á lista de espera dunha hora completa', async () => {
		const local = await createTestDb();
		const fixture = await seedFixture(local);
		await occupy(local, fixture, DATE, '18:00');
		const event = postForm(
			local,
			{ id: fixture.userId, displayName: 'Nerea Veciña' },
			`http://localhost/ribadavila/reservar/${fixture.typeId}?date=${DATE}`,
			{ waitlist: `${fixture.facilityId}|${localDateTimeToUtc(DATE, '18:00').toISOString()}` }
		);
		(event as { params: Record<string, string> }).params = {
			slug: 'ribadavila',
			typeId: fixture.typeId
		};
		const result = await call<Promise<{ joined: boolean }>>(diaActions.waitlist, event);
		expect(result.joined).toBe(true);
	});

	it('sen date elixe 2026-11-24', async () => {
		const out = await call<Promise<{ date: string }>>(
			loadDia,
			makeEvent({
				db,
				now: NOW,
				params: { slug: 'ribadavila', typeId: fx.typeId },
				url: `http://localhost/ribadavila/reservar/${fx.typeId}`
			})
		);
		expect(out.date).toBe(DATE);
	});

	it('coa Pista 1 chea todo o día elixe 2026-11-25', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		for (const h of HOURS) await occupy(own, f, DATE, h);
		const out = await call<Promise<{ date: string }>>(
			loadDia,
			makeEvent({
				db: own,
				now: NOW,
				params: { slug: 'ribadavila', typeId: f.typeId },
				url: `http://localhost/ribadavila/reservar/${f.typeId}`
			})
		);
		expect(out.date).toBe('2026-11-25');
	});
});

describe('libre', () => {
	it('ás 19:00 coa pista ocupada: sen opcións e a primeira alternativa é o mesmo día', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		await occupy(own, f, DATE, '19:00');
		const out = await call<Promise<{ options: unknown[]; alternatives: { kind: string }[] }>>(
			loadLibre,
			makeEvent({
				db: own,
				now: NOW,
				params: { slug: 'ribadavila', typeId: f.typeId },
				url: `http://localhost/ribadavila/reservar/${f.typeId}/libre?date=${DATE}&time=19:00`
			})
		);
		expect(out.options).toEqual([]);
		expect(out.alternatives[0].kind).toBe('same_day');
	});
});

describe('datas', () => {
	it('parseDate rexeita datas imposibles e formas raras', () => {
		expect(parseDate('2026-02-31')).toBeNull();
		expect(parseDate('2026-13-01')).toBeNull();
		expect(parseDate('2026-2-01')).toBeNull();
		expect(parseDate(null)).toBeNull();
		expect(parseDate('2028-02-29')).toBe('2028-02-29');
		expect(parseDate('2026-11-24')).toBe('2026-11-24');
	});

	it('clampDate leva ao extremo máis próximo da xanela', () => {
		expect(clampDate('2026-11-01', '2026-11-24', '2026-12-08')).toBe('2026-11-24');
		expect(clampDate('2027-01-01', '2026-11-24', '2026-12-08')).toBe('2026-12-08');
		expect(clampDate('2026-11-30', '2026-11-24', '2026-12-08')).toBe('2026-11-30');
	});

	it.each([
		['2027-06-01', '2026-12-08'],
		['2026-11-01', '2026-11-24'],
		['2026-02-31', '2026-11-24']
	])('libre con date=%s fóra da xanela redirixe a %s', async (asked, clamped) => {
		const r = await outcome(() =>
			call(
				loadLibre,
				makeEvent({
					db,
					now: NOW,
					params: { slug: 'ribadavila', typeId: fx.typeId },
					url: `http://localhost/ribadavila/reservar/${fx.typeId}/libre?date=${asked}&time=19:00`
				})
			)
		);
		expect(r.thrown).toMatchObject({
			status: 303,
			location: `/ribadavila/reservar/${fx.typeId}/libre?date=${clamped}&time=19%3A00`
		});
	});
});

describe('confirmar', () => {
	it('resume as normas do concello e require aceptalas só na primeira reserva', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		const u = { id: f.userId, displayName: 'Nerea Veciña' };
		await own
			.update(municipalityProfiles)
			.set({ rulesAcceptedAt: null })
			.where(eq(municipalityProfiles.id, f.profileId));
		const url = confirmarUrl(f, '12:00');
		const data = await call<Promise<{ rules: Record<string, number | boolean> }>>(
			loadConfirmar,
			makeEvent({ db: own, now: NOW, user: u, params: { slug: 'ribadavila' }, url })
		);
		expect(data.rules).toMatchObject({
			noShowThreshold: 3,
			penaltyDays: 7,
			maxDaysAhead: 14,
			accepted: false
		});

		const refused = await call<Promise<unknown>>(confirmarActions.default, postForm(own, u, url));
		expect(isActionFailure(refused)).toBe(true);
		expect((refused as { data: { error: string } }).data.error).toBe('RULES_NOT_ACCEPTED');

		const accepted = await outcome(() =>
			call(confirmarActions.default, postForm(own, u, url, { rulesAccepted: 'yes' }))
		);
		expect(isRedirect(accepted.thrown)).toBe(true);
		const [profile] = await own
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, f.profileId));
		expect(profile.rulesAcceptedAt).not.toBeNull();

		const later = await outcome(() =>
			call(confirmarActions.default, postForm(own, u, confirmarUrl(f, '13:00')))
		);
		expect(isRedirect(later.thrown)).toBe(true);
	});

	it('en modo fácil a confirmación ten regras e un único botón grande', async () => {
		const data = await call<Promise<object>>(
			loadConfirmar,
			makeEvent({
				db,
				now: NOW,
				user,
				params: { slug: 'ribadavila' },
				url: `${confirmarUrl(fx, '12:00')}&easy=1`
			})
		);
		const body = render(ConfirmarPage as never, {
			props: {
				data: { ...data, locale: 'gl', municipality: { slug: 'ribadavila', name: 'Ribadávila' } }
			} as never
		}).body;
		expect(body).toMatch(/class="confirmar[^"]*\beasy\b/);
		expect(body).toContain('Antes de reservar');
		expect(body).toContain('Reservar');
	});
	it('a ficha mostra Sen comprobar cando a accesibilidade é nula', async () => {
		const out = await call<Promise<Record<string, unknown>>>(
			loadConfirmar,
			makeEvent({
				db,
				now: NOW,
				params: { slug: 'ribadavila' },
				url: confirmarUrl(fx, '12:00')
			})
		);
		const body = render(
			ConfirmarPage as never,
			{
				props: { data: { ...out, locale: 'gl', municipality: { name: 'Ribadávila' } }, form: null }
			} as never
		).body;
		expect(body).toContain('Sen comprobar');
	});
	it('a ficha pública inclúe JSON-LD schema.org con xeolocalización e accesibilidade', async () => {
		await db
			.update(facilities)
			.set({ latitude: 42.34, longitude: -7.86, stepFreeAccess: 'yes' })
			.where(eq(facilities.id, fx.facilityId));
		const out = await call<Promise<Record<string, unknown>>>(
			loadConfirmar,
			makeEvent({
				db,
				now: NOW,
				params: { slug: 'ribadavila' },
				url: confirmarUrl(fx, '12:00')
			})
		);
		const body = render(ConfirmarPage as never, {
			props: {
				data: { ...out, locale: 'gl', municipality: { slug: 'ribadavila', name: 'Ribadávila' } },
				form: null
			} as never
		}).head;
		expect(body).toContain('type="application/ld+json"');
		expect(body).toContain('SportsActivityLocation');
		expect(body).toContain('GeoCoordinates');
		expect(body).toContain('42.34');
		expect(body).toContain('isAccessibleForFree');
	});
	it('unha reserva de balde non ofrece pagamento', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		await own
			.update(facilities)
			.set({ priceResidentCents: 0, priceNonResidentCents: 0, priceSocialCents: 0 })
			.where(eq(facilities.id, f.facilityId));
		const data = await call<Promise<object>>(
			loadConfirmar,
			makeEvent({
				db: own,
				now: NOW,
				user: { id: f.userId, displayName: 'Nerea Veciña' },
				params: { slug: 'ribadavila' },
				url: confirmarUrl(f, '12:00')
			})
		);
		const body = render(ConfirmarPage as never, {
			props: {
				data: { ...data, locale: 'gl', municipality: { name: 'Ribadávila' } },
				form: null
			} as never
		}).body;
		expect(body).toContain('De balde');
		expect(body).not.toContain('Págase na instalación');
		expect(body).not.toContain('name="paymentMethod"');
	});
	it('sen sesión: needsLogin e redirectTo coa URL completa', async () => {
		const url = confirmarUrl(fx, '12:00');
		const out = await call<Promise<{ needsLogin: boolean; redirectTo: string }>>(
			loadConfirmar,
			makeEvent({ db, now: NOW, params: { slug: 'ribadavila' }, url })
		);
		const u = new URL(url);
		expect(out.needsLogin).toBe(true);
		expect(out.redirectTo).toBe(u.pathname + u.search);
	});

	it('Review Focus 1: alguén colle a franxa entre o load e a acción → 303 a libre con cheo=1', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		const u = { id: f.userId, displayName: 'Nerea Veciña' };
		const url = confirmarUrl(f, '19:00');
		const page = await call<Promise<{ needsLogin: boolean }>>(
			loadConfirmar,
			makeEvent({ db: own, now: NOW, user: u, params: { slug: 'ribadavila' }, url })
		);
		expect(page.needsLogin).toBe(false);
		await occupy(own, f, DATE, '19:00');
		const r = await outcome(() =>
			call(
				confirmarActions.default,
				makeEvent({
					db: own,
					now: NOW,
					user: u,
					params: { slug: 'ribadavila' },
					url,
					method: 'POST'
				})
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		expect(r.thrown).toMatchObject({
			status: 303,
			location: `/ribadavila/reservar/${f.typeId}/libre?date=2026-11-24&time=19:00&cheo=1`
		});
	});

	it.each([
		{ mode: 'unit' as const, code: 'UNIT_UNAVAILABLE', unit: 0 },
		{ mode: 'capacity' as const, code: 'CAPACITY_EXCEEDED', unit: undefined }
	])(
		'Review Focus 1 en modo $mode: $code entre o load e a acción → 303 a libre con cheo=1',
		async ({ mode, unit }) => {
			const own = await createTestDb();
			const f = await seedFixture(own, { bookingMode: mode, units: 2, capacity: 2 });
			const u = { id: f.userId, displayName: 'Nerea Veciña' };
			const url = confirmarUrl(f, '19:00') + (unit === undefined ? '' : `&unit=${unit}`);
			const page = await call<Promise<{ needsLogin: boolean }>>(
				loadConfirmar,
				makeEvent({ db: own, now: NOW, user: u, params: { slug: 'ribadavila' }, url })
			);
			expect(page.needsLogin).toBe(false);
			// Outra persoa colle a rúa 1 ou as dúas prazas.
			await occupy(own, f, DATE, '19:00', mode === 'unit' ? { unitIndex: 0 } : { seats: 2 });
			const r = await outcome(() =>
				call(
					confirmarActions.default,
					makeEvent({
						db: own,
						now: NOW,
						user: u,
						params: { slug: 'ribadavila' },
						url,
						method: 'POST'
					})
				)
			);
			expect(isRedirect(r.thrown)).toBe(true);
			expect(r.thrown).toMatchObject({
				status: 303,
				location: `/ribadavila/reservar/${f.typeId}/libre?date=2026-11-24&time=19:00&cheo=1`
			});
		}
	);

	it('modo day: o load atopa a franxa do día enteiro e a acción resérvaa', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own, { bookingMode: 'day' });
		const u = { id: f.userId, displayName: 'Nerea Veciña' };
		const url = confirmarUrl(f, '09:00');
		const page = await call<Promise<{ startsAt: Date; endsAt: Date }>>(
			loadConfirmar,
			makeEvent({ db: own, now: NOW, user: u, params: { slug: 'ribadavila' }, url })
		);
		expect(page.startsAt.getTime()).toBe(localDateTimeToUtc(DATE, '09:00').getTime());
		expect(page.endsAt.getTime()).toBe(localDateTimeToUtc(DATE, '22:00').getTime());
		const r = await outcome(() =>
			call(
				confirmarActions.default,
				makeEvent({
					db: own,
					now: NOW,
					user: u,
					params: { slug: 'ribadavila' },
					url,
					method: 'POST'
				})
			)
		);
		const [row] = await own.select().from(bookings).where(eq(bookings.facilityId, f.facilityId));
		expect(row.channel).toBe('online');
		expect(row.endsAt.getTime()).toBe(localDateTimeToUtc(DATE, '22:00').getTime());
		expect(r.thrown).toMatchObject({ status: 303, location: `/ribadavila/reserva/${row.id}/xa` });
	});

	it('unha acción sen sesión redirixe a entrar', async () => {
		const url = confirmarUrl(fx, '13:00');
		const r = await outcome(() =>
			call(
				confirmarActions.default,
				makeEvent({ db, now: NOW, params: { slug: 'ribadavila' }, url, method: 'POST' })
			)
		);
		expect(isRedirect(r.thrown)).toBe(true);
		const u = new URL(url);
		expect(r.thrown).toMatchObject({
			status: 303,
			location: `/ribadavila/entrar?redirectTo=${encodeURIComponent(u.pathname + u.search)}`
		});
	});

	it('unha persoa penalizada recibe fail(403) con penaltyUntil', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		const until = new Date('2026-12-01T00:00:00+01:00');
		await own
			.update(municipalityProfiles)
			.set({ penaltyUntil: until })
			.where(eq(municipalityProfiles.id, f.profileId));
		const res = await call<Promise<unknown>>(
			confirmarActions.default,
			makeEvent({
				db: own,
				now: NOW,
				user: { id: f.userId, displayName: 'Nerea Veciña' },
				params: { slug: 'ribadavila' },
				url: confirmarUrl(f, '12:00'),
				method: 'POST'
			})
		);
		expect(isActionFailure(res)).toBe(true);
		const failure = res as { status: number; data: { penaltyUntil: Date } };
		expect(failure.status).toBe(403);
		expect(new Date(failure.data.penaltyUntil).getTime()).toBe(until.getTime());

		// A data da penalización escríbese en galego sen Intl: «decembro», nunca «diciembre».
		const real = Intl.DateTimeFormat;
		Intl.DateTimeFormat = (() => {
			throw new Error('Intl non debe usarse');
		}) as never;
		try {
			const user = { id: f.userId, displayName: 'Nerea Veciña' };
			const data = await call<Promise<object>>(
				loadConfirmar,
				makeEvent({
					db: own,
					now: NOW,
					user,
					params: { slug: 'ribadavila' },
					url: confirmarUrl(f, '12:00')
				})
			);
			const body = render(ConfirmarPage as never, {
				props: {
					data: {
						...data,
						municipality: { slug: 'ribadavila', name: 'Ribadávila' },
						locale: 'gl'
					},
					form: failure.data
				} as never
			}).body;
			expect(body).toContain('1 de decembro');
			expect(body).not.toMatch(/octubre|diciembre/);
		} finally {
			Intl.DateTimeFormat = real;
		}
	});

	it('unha acción válida crea unha reserva online e redirixe ao chaveiro', async () => {
		const startsAt = localDateTimeToUtc(DATE, '17:00');
		const r = await outcome(() =>
			call(
				confirmarActions.default,
				makeEvent({
					db,
					now: NOW,
					user,
					params: { slug: 'ribadavila' },
					url: confirmarUrl(fx, '17:00'),
					method: 'POST'
				})
			)
		);
		const [row] = await db
			.select()
			.from(bookings)
			.where(and(eq(bookings.facilityId, fx.facilityId), eq(bookings.startsAt, startsAt)));
		expect(row.channel).toBe('online');
		expect(row.profileId).toBe(fx.profileId);
		expect(r.thrown).toMatchObject({ status: 303, location: `/ribadavila/reserva/${row.id}/xa` });
	});
});

describe('reserva fácil', () => {
	it('pide sesión e avanza deporte, día e hora ata confirmar', async () => {
		const unauthenticated = await outcome(() =>
			call(
				loadFacil,
				makeEvent({
					db,
					now: NOW,
					params: { slug: 'ribadavila' },
					url: 'http://localhost/ribadavila/reservar/facil'
				})
			)
		);
		expect(unauthenticated.thrown).toMatchObject({ status: 303 });

		const initial = await call<Promise<{ sport: null; sports: unknown[] }>>(
			loadFacil,
			makeEvent({
				db,
				now: NOW,
				user,
				params: { slug: 'ribadavila' },
				url: 'http://localhost/ribadavila/reservar/facil'
			})
		);
		expect(initial.sport).toBeNull();
		expect(initial.sports).toHaveLength(1);
		const sport = await call<Promise<{ sport: { typeId: string }; selectedDate: null }>>(
			loadFacil,
			makeEvent({
				db,
				now: NOW,
				user,
				params: { slug: 'ribadavila' },
				url: `http://localhost/ribadavila/reservar/facil?tipo=${fx.typeId}`
			})
		);
		expect(sport).toMatchObject({ sport: { typeId: fx.typeId }, selectedDate: null });
		const date = await call<Promise<{ selectedDate: string; time: null }>>(
			loadFacil,
			makeEvent({
				db,
				now: NOW,
				user,
				params: { slug: 'ribadavila' },
				url: `http://localhost/ribadavila/reservar/facil?tipo=${fx.typeId}&date=${DATE}`
			})
		);
		expect(date).toMatchObject({ selectedDate: DATE, time: null });
		const confirmed = await outcome(() =>
			call(
				loadFacil,
				makeEvent({
					db,
					now: NOW,
					user,
					params: { slug: 'ribadavila' },
					url: `http://localhost/ribadavila/reservar/facil?tipo=${fx.typeId}&date=${DATE}&time=12:00`
				})
			)
		);
		expect(confirmed.thrown).toMatchObject({ status: 303 });
		expect(confirmed.thrown).toMatchObject({ location: expect.stringContaining('/confirmar?') });
		expect(confirmed.thrown).toMatchObject({ location: expect.stringContaining('easy=1') });
	});
});

describe('xa é túa', () => {
	it('a reserva doutra persoa dá 404; a propia devolve o código', async () => {
		const own = await createTestDb();
		const f = await seedFixture(own);
		const owner = { id: f.userId, displayName: 'Nerea Veciña' };
		const r = await outcome(() =>
			call(
				confirmarActions.default,
				makeEvent({
					db: own,
					now: NOW,
					user: owner,
					params: { slug: 'ribadavila' },
					url: confirmarUrl(f, '18:00'),
					method: 'POST'
				})
			)
		);
		const location = (r.thrown as { location: string }).location;
		const id = location.split('/')[3];

		const [other] = await own
			.insert(users)
			.values({ provider: 'local', subject: 'xa-outra', displayName: 'Antía Outra' })
			.returning();
		await own
			.insert(municipalityProfiles)
			.values({ municipalityId: f.municipalityId, userId: other.id, isResident: true });
		const ev = (u: SessionUser) =>
			makeEvent({
				db: own,
				now: NOW,
				user: u,
				params: { slug: 'ribadavila', id },
				url: `http://localhost${location}`
			});

		const foreign = await outcome(() => call(loadXa, ev({ id: other.id, displayName: 'Antía' })));
		expect(isHttpError(foreign.thrown, 404)).toBe(true);

		const mine = await call<Promise<{ code: string }>>(loadXa, ev(owner));
		expect(mine.code).toMatch(/^\d{4}$/);
		// O texto non promete que o código abra a porta: o mesmo que o detalle.
		const shown = render(XaPage as never, {
			props: {
				data: { ...mine, municipality: { slug: 'ribadavila', name: 'Ribadávila' }, locale: 'gl' }
			} as never
		}).body;
		expect(shown).toContain('Ensina o QR ou di o PIN se cho piden.');
		expect(shown).not.toMatch(/abre a porta/i);
		for (const locale of ['gl', 'es'] as const) {
			expect(t(locale, 'vec.xa.texto')).toContain(
				t(locale, 'vec.reserva.amosar').replace(/\.$/, '')
			);
			expect(t(locale, 'vec.xa.texto')).not.toMatch(/abre (a|la) puerta|abre a porta/i);
		}

		// Cancelada: sin código; la página no pinta el chaveiro y lleva al detalle.
		await own.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id));
		const gone = await call<Promise<{ code: string | null }>>(loadXa, ev(owner));
		expect(gone.code).toBeNull();
		const out = render(XaPage as never, {
			props: {
				data: {
					...gone,
					municipality: { slug: 'ribadavila', name: 'Ribadávila' },
					locale: 'gl'
				}
			} as never
		}).body;
		expect(out).not.toContain(formatCode(mine.code));
		expect(out).not.toContain(t('gl', 'vec.xa.texto'));
		expect(out).toContain(t('gl', 'vec.xa.sen_codigo'));
		expect(out).toContain(`href="/ribadavila/reserva/${id}"`);
	});
});

describe('FreeOptionCard', () => {
	const option = {
		facilityName: 'Pista 1',
		location: 'Polideportivo Municipal',
		unitIndex: null,
		remainingSeats: null,
		startsAt: localDateTimeToUtc(DATE, '19:00'),
		priceResidentCents: 300,
		priceNonResidentCents: 600
	};

	it('sen sesión amosa os dous prezos e «Esta» leva a confirmar', () => {
		const { body } = render(FreeOptionCard, {
			props: { option, href: '/ribadavila/confirmar?x=1', resident: null, locale: 'gl' }
		});
		expect(body).toContain('3 € empadroados · 6 € non empadroados');
		expect(body).toContain('href="/ribadavila/confirmar?x=1"');
		expect(body).toContain('Esta');
	});

	it('empadroada: só o prezo de empadroados; sen href non hai botón', () => {
		const { body } = render(FreeOptionCard, { props: { option, resident: true } });
		expect(body).toContain('3 €');
		expect(body).not.toContain('6 €');
		expect(body).not.toContain('<a');
	});
});
