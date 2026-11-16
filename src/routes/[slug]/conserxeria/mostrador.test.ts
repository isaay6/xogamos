// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ PUBLIC_ORIGIN: undefined as string | undefined }));
vi.mock('$app/env/private', () => ({
	OIDC_SCOPES: undefined,
	OIDC_SUBJECT_CLAIM: undefined,
	OIDC_CLAVE_ISSUER: undefined,
	OIDC_CLAVE_CLIENT_ID: undefined,
	OIDC_CLAVE_CLIENT_SECRET: undefined,
	OIDC_CHAVE365_ISSUER: undefined,
	OIDC_CHAVE365_CLIENT_ID: undefined,
	OIDC_CHAVE365_CLIENT_SECRET: undefined,
	DATABASE_URL: 'postgres://x',
	IDENTITY_MODE: undefined,
	AUTH_SECRET: 'k'.repeat(40),
	get PUBLIC_ORIGIN() {
		return env.PUBLIC_ORIGIN;
	}
}));

import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	municipalityProfiles,
	notifications,
	passTypes,
	passes,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { dniSecret } from '../../../lib/server/auth/dni-secret';
import { hashDni } from '../../../lib/server/domain/dni';
import { createLocalPerson } from '../../../lib/server/services/staff';
import { makeEvent } from '../../../lib/server/http/test-event';
import { SIMULATED_IDENTITIES } from '../../../lib/server/auth/simulated-identities';
import { DEMO_SLUGS, DEMO_STAFF } from '../../../lib/server/db/seed-data';
import { bookingQrSecret, publicOrigin } from '../../../lib/server/auth/booking-qr-secret';
import { signBookingQr } from '../../../lib/server/domain/booking-qr';
import { createBooking } from '../../../lib/server/services/bookings';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { render } from 'svelte/server';
import Qr from '../../../lib/ui/Qr.svelte';
import ValidarPage from './validar/+page.svelte';
import NovaPage from './nova/+page.svelte';
import Detalle from '../reserva/[id]/+page.svelte';
import { load as reservaLoad } from '../reserva/[id]/+page.server';
import Receipt from './nova/[id]/xustificante/+page.svelte';
import { actions as validarActions, load as validarLoad } from './validar/+page.server';
import { actions as novaActions, load as novaLoad } from './nova/+page.server';
import { load as receiptLoad } from './nova/[id]/xustificante/+page.server';
import { actions as persoaActions, load as persoaLoad } from './persoa/+page.server';

const CREATED = new Date('2026-11-20T10:00:00+01:00');
const NOW = new Date('2026-11-24T10:00:00+01:00');
const ARRIVAL = new Date('2026-11-24T17:50:00+01:00');
const TODAY_SLOT = new Date('2026-11-24T18:00:00+01:00');
const TOMORROW_SLOT = new Date('2026-11-25T18:00:00+01:00');
const BASE = 'http://localhost/ribadavila/conserxeria';

type U = { id: string; displayName: string };

const mkUser = async (db: Db, subject: string, name: string, phone?: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name, phone })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const thrown = async (fn: () => unknown): Promise<{ status: number }> => {
	try {
		await fn();
	} catch (e) {
		return e as { status: number };
	}
	throw new Error('no ha lanzado');
};

const get = (db: Db, user: U | null, path: string, params: Record<string, string> = {}) =>
	makeEvent({
		db,
		user,
		now: NOW,
		url: `${BASE}${path}`,
		params: { slug: 'ribadavila', ...params }
	}) as never;

const post = (
	db: Db,
	user: U | null,
	path: string,
	fields: Record<string, string>,
	params: Record<string, string> = {},
	now = NOW
) => {
	const base = makeEvent({
		db,
		user,
		now,
		url: `${BASE}${path}`,
		method: 'POST',
		params: { slug: 'ribadavila', ...params }
	});
	return {
		...base,
		request: new Request(`${BASE}${path}`, { method: 'POST', body: new URLSearchParams(fields) })
	} as never;
};

describe('simulador: un conserje de demo por concello', () => {
	it('lista a un conserje por cada concello de la demo', () => {
		for (const slug of DEMO_SLUGS) {
			const staff = DEMO_STAFF.find((s) => s.municipality === slug && s.role === 'conserxe')!;
			const found = SIMULATED_IDENTITIES.find(
				(i) => i.subject === staff.subject && i.provider === staff.provider
			);
			expect(found?.displayName).toBe(staff.name);
			expect(found?.note).toContain('Conserxería');
		}
		const rua = SIMULATED_IDENTITIES.find((i) => i.displayName === 'Ermitas Valcarce')!;
		expect(rua.note).toBe('Conserxería da Rúa');
		const viana = SIMULATED_IDENTITIES.find((i) => i.displayName === 'Baltasar Gesto')!;
		expect(viana.note).toBe('Conserxería de Viana do Bolo');
	});
});

describe('simulador: notas neutras', () => {
	it('a nota por concello non depende do xénero', () => {
		const uxia = SIMULATED_IDENTITIES.find((i) => i.displayName === 'Nerea Cabaleiro')!;
		expect(uxia.note).toBe('Viana do Bolo (empadroamento: si), A Rúa (empadroamento: non)');
		for (const i of SIMULATED_IDENTITIES) expect(i.note).not.toMatch(/empadroad/);
	});
});

describe('mostrador', () => {
	let db: Db;
	let fx: Fixture;
	let conserje: U;
	let other: U;
	let manuel: U;

	beforeAll(async () => {
		db = await createTestDb();
		fx = await seedFixture(db);
		conserje = await mkUser(db, 'conserje', 'Telmo Novo');
		other = await mkUser(db, 'conserje-m', 'Conserxe Montemaior');
		manuel = await mkUser(db, 'manuel', 'Celestino Pereira Castro', '600111222');
		await db.insert(staffRoles).values([
			{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' },
			{ userId: other.id, municipalityId: fx.otherMunicipalityId, role: 'conserxe' }
		]);
		await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.municipalityId, userId: manuel.id, isResident: true });
	});

	const book = async (startsAt: Date, profileId = fx.profileId) => {
		const r = await createBooking(db, {
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId,
			startsAt,
			channel: 'phone',
			createdByUserId: conserje.id,
			now: CREATED
		});
		if (!r.ok) throw new Error(r.error);
		return r.value;
	};

	describe('validar', () => {
		it('sin sesión redirige y sin rol da 403', async () => {
			expect((await thrown(() => validarLoad(get(db, null, '/validar')))).status).toBe(303);
			expect((await thrown(() => validarLoad(get(db, other, '/validar')))).status).toBe(403);
			expect(
				(
					await thrown(() =>
						validarActions.buscar(post(db, other, '/validar?/buscar', { codigo: '1' }))
					)
				).status
			).toBe(403);
		});
		it('un código de hoy da una coincidencia', async () => {
			const b = await book(TODAY_SLOT);
			const r = (await validarActions.buscar(
				post(db, conserje, '/validar?/buscar', {
					codigo: b.accessCode.replace(/(...)(...)/, '$1 $2')
				})
			)) as any;
			expect(r.matches).toHaveLength(1);
			expect(r.matches[0].bookingId).toBe(b.id);
			await db.delete(bookings);
		});
		it('chegada deja la reserva en attended', async () => {
			const b = await book(TODAY_SLOT);
			const r = (await validarActions.chegada(
				post(db, conserje, '/validar?/chegada', { bookingId: b.id }, {}, ARRIVAL)
			)) as any;
			expect(r.attended).toBe(true);
			const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
			expect(row.status).toBe('attended');
			await db.delete(bookings);
		});
		it('si chegada falla, devuelve el error y mantiene la tarjeta (codigo y matches)', async () => {
			const b = await book(TODAY_SLOT);
			// A las 10:00 aún es pronto para marcar la llegada de las 18:00.
			const r = (await validarActions.chegada(
				post(db, conserje, '/validar?/chegada', { bookingId: b.id, codigo: b.accessCode })
			)) as any;
			expect(r.status).toBe(422);
			expect(r.data.chegadaError).toBe('OUTSIDE_WINDOW');
			expect(r.data.codigo).toBe(b.accessCode);
			expect(r.data.matches.map((x: any) => x.bookingId)).toEqual([b.id]);
			await db.delete(bookings);
		});
		it('un PIN que solo coincide con una reserva de mañana da NOT_FOUND', async () => {
			// El PIN solo es único dentro del día: la de mañana puede ser de otra persona.
			const b = await book(TOMORROW_SLOT);
			const r = (await validarActions.buscar(
				post(db, conserje, '/validar?/buscar', { codigo: b.accessCode })
			)) as any;
			expect(r.status).toBe(422);
			expect(r.data.error).toBe('NOT_FOUND');
			expect(r.data.date).toBeNull();
			await db.delete(bookings);
		});
		it('el QR de una reserva de mañana da NOT_TODAY con su fecha', async () => {
			const b = await book(TOMORROW_SLOT);
			const r = (await validarActions.buscar(
				post(db, conserje, '/validar?/buscar', {
					codigo: signBookingQr(b.id, bookingQrSecret()!)
				})
			)) as any;
			expect(r.status).toBe(422);
			expect(r.data).toMatchObject({ error: 'NOT_TODAY', date: '2026-11-25' });
			await db.delete(bookings);
		});
		describe('lo que teclea un lector de QR (la URL entera)', () => {
			// Lo mismo que lleva la página de la reserva: la cadena exacta que codifica Qr.svelte.
			const encodedFor = async (id: string) => {
				const data = (await reservaLoad(
					makeEvent({
						db,
						user: { id: fx.userId, displayName: 'Nerea' },
						now: NOW,
						url: `https://reservas.exemplo.gal/ribadavila/reserva/${id}`,
						params: { slug: 'ribadavila', id }
					}) as never
				)) as { qr: string };
				// La página de la reserva tal cual se pinta: su SVG es el QR de esa cadena.
				const page = render(Detalle, {
					props: {
						data: {
							...data,
							locale: 'gl',
							municipality: {
								slug: 'ribadavila',
								name: 'Ribadávila',
								primaryColor: '#1d4ed8',
								hasLogo: false
							}
						}
					} as never
				}).body;
				const svg = /<svg[^>]*role="img"[^>]*>[\s\S]*?<\/svg>/.exec(page)?.[0] ?? '';
				return { qr: data.qr, svg };
			};
			const buscar = (codigo: string) =>
				validarActions.buscar(post(db, conserje, '/validar?/buscar', { codigo })) as any;

			it('la URL absoluta del QR de la reserva encuentra la tarjeta', async () => {
				const b = await book(TODAY_SLOT);
				const { qr, svg } = await encodedFor(b.id);
				expect(qr).toMatch(
					/^https:\/\/reservas\.exemplo\.gal\/ribadavila\/conserxeria\/validar\?qr=/
				);
				// El SVG de la página es exactamente el QR de esa cadena.
				const d = (h: string) => /<path d="([^"]+)"/.exec(h)?.[1];
				expect(d(svg)).toBeTruthy();
				expect(d(svg)).toBe(d(render(Qr, { props: { value: qr, label: 'x', quiet: 4 } }).body));
				const r = await buscar(qr);
				expect(r.matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				await db.delete(bookings);
			});
			it('con PUBLIC_ORIGIN el QR usa ese origen y sigue encontrando la tarjeta', async () => {
				env.PUBLIC_ORIGIN = 'https://reservas.concello.gal';
				try {
					expect(publicOrigin(new URL('http://10.0.0.5:3000/x'))).toBe(
						'https://reservas.concello.gal'
					);
					const b = await book(TODAY_SLOT);
					const { qr } = await encodedFor(b.id);
					expect(qr.startsWith('https://reservas.concello.gal/ribadavila/')).toBe(true);
					expect((await buscar(qr)).matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				} finally {
					env.PUBLIC_ORIGIN = undefined;
					await db.delete(bookings);
				}
			});
			it('también la relativa y la URL con espacios alrededor', async () => {
				const b = await book(TODAY_SLOT);
				const { qr } = await encodedFor(b.id);
				const relative = qr.slice('https://reservas.exemplo.gal'.length);
				expect(relative.startsWith('/ribadavila/conserxeria/validar?qr=')).toBe(true);
				expect((await buscar(relative)).matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				expect((await buscar(` ${qr}\n`)).matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				await db.delete(bookings);
			});
			it('el campo admite la URL entera sin JavaScript (sin maxlength ni pattern)', () => {
				const body = render(ValidarPage, {
					props: { data: { locale: 'gl', lookup: null }, form: null } as never
				}).body;
				const input = /<input[^>]*id="codigo"[^>]*>/.exec(body)?.[0] ?? '';
				expect(input).not.toBe('');
				expect(input).not.toContain('maxlength');
				expect(input).not.toContain('pattern');
			});
			it('un PIN tecleado sigue funcionando', async () => {
				const b = await book(TODAY_SLOT);
				expect((await buscar(b.accessCode)).matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				await db.delete(bookings);
			});
		});
		describe('con QR (?qr=<token>)', () => {
			const tokenOf = (id: string) => signBookingQr(id, bookingQrSecret()!);
			const lookupOf = async (qr: string) =>
				((await validarLoad(get(db, conserje, `/validar?qr=${qr}`))) as any).lookup;

			it('un token válido muestra la misma tarjeta que un PIN', async () => {
				const b = await book(TODAY_SLOT);
				const lookup = await lookupOf(tokenOf(b.id));
				expect(lookup.error).toBeNull();
				expect(lookup.matches.map((m: any) => m.bookingId)).toEqual([b.id]);
				expect(lookup.codigo).toBe(tokenOf(b.id));
				await db.delete(bookings);
			});
			it('sin ?qr= la carga no hace búsqueda', async () => {
				expect(((await validarLoad(get(db, conserje, '/validar'))) as any).lookup).toBeNull();
			});
			it('un token manipulado da NOT_FOUND', async () => {
				const b = await book(TODAY_SLOT);
				const t = tokenOf(b.id);
				// Primer carácter de la firma: el último de base64url lleva bits sin uso y puede no cambiar.
				const at = t.indexOf('.') + 1;
				const bad = t.slice(0, at) + (t[at] === 'A' ? 'B' : 'A') + t.slice(at + 1);
				const lookup = await lookupOf(bad);
				expect(lookup.error).toBe('NOT_FOUND');
				expect(lookup.matches).toEqual([]);
				await db.delete(bookings);
			});
			it('la guarda sigue aplicándose con ?qr=', async () => {
				const b = await book(TODAY_SLOT);
				const url = `/validar?qr=${tokenOf(b.id)}`;
				expect((await thrown(() => validarLoad(get(db, null, url)))).status).toBe(303);
				expect((await thrown(() => validarLoad(get(db, other, url)))).status).toBe(403);
				await db.delete(bookings);
			});
			it('chegada tras una búsqueda QR marca la llegada', async () => {
				const b = await book(TODAY_SLOT);
				const r = (await validarActions.chegada(
					post(
						db,
						conserje,
						'/validar?/chegada',
						{ bookingId: b.id, codigo: tokenOf(b.id) },
						{},
						ARRIVAL
					)
				)) as any;
				expect(r.attended).toBe(true);
				await db.delete(bookings);
			});
			it('si chegada falla tras un QR, la tarjeta se mantiene con el token', async () => {
				const b = await book(TODAY_SLOT);
				const token = tokenOf(b.id);
				const r = (await validarActions.chegada(
					post(db, conserje, '/validar?/chegada', { bookingId: b.id, codigo: token })
				)) as any;
				expect(r.status).toBe(422);
				expect(r.data.chegadaError).toBe('OUTSIDE_WINDOW');
				expect(r.data.codigo).toBe(token);
				expect(r.data.matches.map((x: any) => x.bookingId)).toEqual([b.id]);
				await db.delete(bookings);
			});
		});
		it('un código que no existe da NOT_FOUND', async () => {
			const r = (await validarActions.buscar(
				post(db, conserje, '/validar?/buscar', { codigo: '0000' })
			)) as any;
			expect(r.data.error).toBe('NOT_FOUND');
		});
	});

	describe('nova reserva', () => {
		it('amosa o resumo das normas do concello ao confirmar', async () => {
			const data = (await novaLoad(
				get(
					db,
					conserje,
					`/nova?persoa=${fx.profileId}&tipo=${fx.typeId}&date=2026-11-24&time=18:00`
				)
			)) as any;
			expect(data.rules).toMatchObject({
				cancellationMinutes: 120,
				noShowThreshold: 3,
				penaltyDays: 7,
				maxDaysAhead: 14
			});
			const body = render(NovaPage, {
				props: {
					data: {
						...data,
						locale: 'gl',
						municipality: { slug: 'ribadavila', name: 'Ribadávila' }
					}
				} as never
			}).body;
			expect(body).toContain('Antes de reservar');
			expect(body).toContain('Podes cancelar ata 2 h antes sen penalización.');
		});

		it('novaPersoa crea un usuario local con teléfono y redirige a ?persoa=', async () => {
			const r = await thrown(() =>
				novaActions.novaPersoa(
					post(db, conserje, '/nova?/novaPersoa', { nome: 'Xoán Lago', telefono: '655 000 111' })
				)
			);
			expect(r.status).toBe(303);
			const loc = (r as any).location as string;
			const id = new URL(loc, 'http://localhost').searchParams.get('persoa')!;
			const [p] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.id, id));
			expect(p.municipalityId).toBe(fx.municipalityId);
			const [u] = await db.select().from(users).where(eq(users.id, p.userId));
			expect(u.provider).toBe('local');
			expect(u.phone).toBe('655 000 111');
		});
		it('reservar crea una reserva por teléfono con el conserje como autor', async () => {
			const [p] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.userId, manuel.id));
			const r = (await novaActions.reservar(
				post(db, conserje, '/nova?/reservar', {
					persoa: p.id,
					opcion: `${fx.facilityId}||${TODAY_SLOT.toISOString()}`,
					canle: 'phone'
				})
			)) as any;
			expect(r.booked.accessCode).toMatch(/^\d{4}$/);
			const [row] = await db.select().from(bookings).where(eq(bookings.id, r.booked.id));
			expect(row.channel).toBe('phone');
			expect(row.createdByUserId).toBe(conserje.id);
			expect(row.profileId).toBe(p.id);
		});
		it('una reserva ya ocupada da el error del servicio', async () => {
			const r = (await novaActions.reservar(
				post(db, conserje, '/nova?/reservar', {
					persoa: fx.profileId,
					opcion: `${fx.facilityId}||${TODAY_SLOT.toISOString()}`,
					canle: 'desk'
				})
			)) as any;
			expect(r.status).toBe(422);
			expect(r.data.error).toBe('SLOT_UNAVAILABLE');
			await db.delete(bookings);
		});
		it('para una persona de otro concello da 404', async () => {
			const [otherUser] = await db.select().from(users).where(eq(users.id, fx.userId));
			const [p] = await db
				.insert(municipalityProfiles)
				.values({ municipalityId: fx.otherMunicipalityId, userId: otherUser.id })
				.returning();
			expect((await thrown(() => novaLoad(get(db, conserje, `/nova?persoa=${p.id}`)))).status).toBe(
				404
			);
			expect(
				(
					await thrown(() =>
						novaActions.reservar(
							post(db, conserje, '/nova?/reservar', {
								persoa: p.id,
								opcion: `${fx.facilityId}||${TODAY_SLOT.toISOString()}`,
								canle: 'phone'
							})
						)
					)
				).status
			).toBe(404);
		});
		it('load con persona, deporte y día ofrece horas y opciones', async () => {
			const d = (await novaLoad(
				get(
					db,
					conserje,
					`/nova?persoa=${fx.profileId}&tipo=${fx.typeId}&date=2026-11-24&time=18:00`
				)
			)) as any;
			expect(d.person.displayName).toBe('Nerea Veciña');
			expect(d.hours.length).toBeGreaterThan(0);
			expect(d.options).toHaveLength(1);
			expect(d.options[0].value).toBe(`${fx.facilityId}||${TODAY_SLOT.toISOString()}`);
		});
		it('buscar por teléfono en el paso 1', async () => {
			const r = (await novaActions.buscar(post(db, conserje, '/nova', { q: ' 600 111 ' }))) as any;
			expect(r.busca.people.map((x: any) => x.displayName)).toEqual(['Celestino Pereira Castro']);
			expect(r.busca.q).toBe('600 111');
		});
		it('el load de nova ya no lee q de la URL', async () => {
			const d = (await novaLoad(get(db, conserje, '/nova?q=600%20111'))) as any;
			expect(d.people).toBeUndefined();
			expect(d.q).toBeUndefined();
		});
	});

	describe('xustificante', () => {
		it('muestra el código, la instalación y el precio', async () => {
			const b = await book(TODAY_SLOT);
			const d = (await receiptLoad(
				get(db, conserje, `/nova/${b.id}/xustificante`, { id: b.id })
			)) as any;
			expect(d.receipt.accessCode).toBe(b.accessCode);
			expect(d.receipt.facilityName).toBe('Pista 1');
			expect(d.receipt.priceCents).toBe(b.priceCents);
			await db.delete(bookings);
		});
		it('una unidad de pádel se rotula «Pista 2»', () => {
			const at = new Date('2026-11-24T18:00:00+01:00');
			const { body } = render(Receipt, {
				props: {
					data: {
						locale: 'gl',
						municipality: { slug: 'ribadavila', name: 'Ribadávila' },
						receipt: {
							id: 'x',
							accessCode: '123456',
							facilityName: 'Pistas de pádel',
							location: '',
							address: '',
							unitIndex: 1,
							seats: 1,
							startsAt: at,
							endsAt: new Date(at.getTime() + 3_600_000),
							priceCents: 300,
							displayName: 'Nerea',
							color: '#F2762E',
							mascot: 'padel'
						}
					}
				} as never
			});
			expect(body).toContain('Pistas de pádel · Pista 2');
		});
		it('una reserva de otro concello da 404', async () => {
			const [otherUser] = await db.select().from(users).where(eq(users.id, fx.userId));
			const [p] = await db
				.insert(municipalityProfiles)
				.values({ municipalityId: fx.otherMunicipalityId, userId: otherUser.id })
				.onConflictDoNothing()
				.returning();
			const profileId =
				p?.id ??
				(
					await db
						.select()
						.from(municipalityProfiles)
						.where(eq(municipalityProfiles.municipalityId, fx.otherMunicipalityId))
				)[0].id;
			const [b] = await db
				.insert(bookings)
				.values({
					municipalityId: fx.otherMunicipalityId,
					facilityId: fx.otherFacilityId,
					profileId,
					startsAt: TODAY_SLOT,
					endsAt: new Date(TODAY_SLOT.getTime() + 3_600_000),
					channel: 'online',
					priceCents: 300,
					accessCode: '654321',
					createdByUserId: otherUser.id,
					createdAt: CREATED
				})
				.returning();
			expect(
				(
					await thrown(() =>
						receiptLoad(get(db, conserje, `/nova/${b.id}/xustificante`, { id: b.id }))
					)
				).status
			).toBe(404);
			expect(
				(await thrown(() => receiptLoad(get(db, conserje, '/nova/xx/xustificante', { id: 'xx' }))))
					.status
			).toBe(404);
		});
	});

	describe('persoa', () => {
		it('buscar por «600 11» encuentra el teléfono 600111222', async () => {
			const r = (await persoaActions.buscar(post(db, conserje, '/persoa', { q: '600 11' }))) as any;
			expect(r.busca.people.map((p: any) => p.phone)).toEqual(['600111222']);
		});
		it('el load de persoa ya no lee q de la URL', async () => {
			const d = (await persoaLoad(get(db, conserje, '/persoa?q=600%2011'))) as any;
			expect(d.people).toBeUndefined();
			expect(d.q).toBeUndefined();
		});
		it('buscar exige conserje (sin sesión redirige, vecina 403)', async () => {
			expect(
				(await thrown(() => persoaActions.buscar(post(db, null, '/persoa', { q: 'x' })))).status
			).toBe(303);
		});
		it('al elegir a una persona muestra reservas, historial, faltas y penalización', async () => {
			const [p] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.userId, manuel.id));
			await book(TOMORROW_SLOT, p.id);
			const d = (await persoaLoad(get(db, conserje, `/persoa?persoa=${p.id}`))) as any;
			expect(d.person.displayName).toBe('Celestino Pereira Castro');
			expect(d.person.noShowCount).toBe(0);
			expect(d.person.penaltyUntil).toBeNull();
			expect(d.upcoming).toHaveLength(1);
			expect(d.past).toHaveLength(0);
			await db.delete(bookings);
		});
		it('una persona de otro concello da 404', async () => {
			const [other2] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.municipalityId, fx.otherMunicipalityId));
			expect(
				(await thrown(() => persoaLoad(get(db, conserje, `/persoa?persoa=${other2.id}`)))).status
			).toBe(404);
		});
		it('vende un abono desde la ficha y muestra su PIN', async () => {
			const [p] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.userId, manuel.id));
			const [type] = await db
				.insert(passTypes)
				.values({
					municipalityId: fx.municipalityId,
					facilityTypeId: fx.typeId,
					name: 'Mensual',
					days: 30,
					priceCents: 2550
				})
				.returning();
			const sold = (await persoaActions.venderAbono(
				post(db, conserje, `/persoa?/venderAbono&persoa=${p.id}`, {
					passTypeId: type.id,
					startsOn: '2026-11-24'
				})
			)) as any;
			expect(sold.done).toBe('abono');
			const d = (await persoaLoad(get(db, conserje, `/persoa?persoa=${p.id}`))) as any;
			expect(d.passes).toHaveLength(1);
			expect(d.passes[0].pin).toMatch(/^\d{4}$/);
			await db.delete(passes).where(eq(passes.passTypeId, type.id));
			await db.delete(passTypes).where(eq(passTypes.id, type.id));
		});
		it('no vende un abono a una persona de otro concello', async () => {
			const [otherProfile] = await db
				.select()
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.municipalityId, fx.otherMunicipalityId));
			expect(
				(
					await thrown(() =>
						persoaActions.venderAbono(
							post(db, conserje, `/persoa?/venderAbono&persoa=${otherProfile.id}`, {
								passTypeId: fx.typeId,
								startsOn: '2026-11-24'
							})
						)
					)
				).status
			).toBe(404);
		});
	});
});

describe('mostrador con aforo', () => {
	it('seats en capacity reserva varias plazas', async () => {
		const db = await createTestDb();
		const fx = await seedFixture(db, { bookingMode: 'capacity', capacity: 10 });
		const c = await mkUser(db, 'conserje', 'Telmo Novo');
		await db
			.insert(staffRoles)
			.values({ userId: c.id, municipalityId: fx.municipalityId, role: 'conserxe' });
		const r = (await novaActions.reservar(
			post(db, c, '/nova?/reservar', {
				persoa: fx.profileId,
				opcion: `${fx.facilityId}||${TODAY_SLOT.toISOString()}`,
				canle: 'phone',
				seats: '3'
			})
		)) as any;
		expect(r.booked?.id, JSON.stringify(r)).toBeTruthy();
		const [row] = await db.select().from(bookings).where(eq(bookings.id, r.booked.id));
		expect(row.seats).toBe(3);
	});
});

describe('mostrador v1: DNI, empadroamento, tarifa e cancelación con motivo', () => {
	const DNI = '34987654P';
	// O mesmo número con dúas cifras trocadas: a letra non cadra (sería E).
	const SWAPPED = '34987645P';
	let db: Db;
	let fx: Fixture;
	let conserje: U;
	let xoan: U;
	let xoanProfile: string;

	beforeAll(async () => {
		db = await createTestDb();
		fx = await seedFixture(db);
		conserje = await mkUser(db, 'conserje', 'Telmo Novo');
		await db
			.insert(staffRoles)
			.values({ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' });
		const created = await createLocalPerson(
			db,
			fx.municipalityId,
			{ displayName: 'Hadrián Seixo Mouriño', phone: '600 123 447', dni: DNI },
			dniSecret()!
		);
		if (!created.ok) throw new Error(created.error);
		xoan = { id: created.value.userId, displayName: created.value.displayName };
		xoanProfile = created.value.profileId;
	});

	const page = async (form: unknown) => {
		const data = (await novaLoad(get(db, conserje, '/nova'))) as object;
		return render(NovaPage, {
			props: {
				data: {
					...data,
					locale: 'gl',
					municipality: {
						slug: 'ribadavila',
						name: 'Ribadávila',
						primaryColor: '#1d4ed8',
						hasLogo: false
					}
				},
				form
			} as never
		}).body;
	};

	it('un DNI enteiro atopa á persoa sen devolver o DNI no HTML nin na URL', async () => {
		const ev = post(db, conserje, '/nova?/buscar', { q: ' 34987654-p ' });
		const r = (await novaActions.buscar(ev)) as any;
		expect(r.busca.mode).toBe('dni');
		expect(r.busca.card.displayName).toBe('Hadrián Seixo Mouriño');
		expect(r.busca.card.profileId).toBe(xoanProfile);
		expect(r.busca.card.dniMasked).toBe('*****654P');
		expect(r.busca.q).toBe('');
		expect(JSON.stringify(r)).not.toContain('34987654');
		expect((ev as { url: URL }).url.href).not.toContain('34987654');
		const html = await page(r);
		expect(html).toContain('Hadrián Seixo Mouriño');
		expect(html).toContain('*****654P');
		expect(html).not.toContain('34987654');
		// A comprobación do teléfono: só as dúas últimas cifras.
		expect(html).toContain('47');
		expect(html).not.toContain('600 123 447');
	});

	it('un anaco de DNI é unha busca por nome ou teléfono, nunca por prefixo de DNI', async () => {
		const r = (await novaActions.buscar(
			post(db, conserje, '/nova?/buscar', { q: '3498765' })
		)) as any;
		expect(r.busca.mode).toBe('texto');
		expect(r.busca.people).toEqual([]);
		const byName = (await novaActions.buscar(
			post(db, conserje, '/nova?/buscar', { q: 'seixo' })
		)) as any;
		expect(byName.busca.mode).toBe('texto');
		expect(byName.busca.people.map((p: any) => p.displayName)).toEqual(['Hadrián Seixo Mouriño']);
	});

	it('coa letra mal avisa da letra e suxire DNI con dúas cifras trocadas', async () => {
		const r = (await novaActions.buscar(
			post(db, conserje, '/nova?/buscar', { q: SWAPPED })
		)) as any;
		expect(r.busca.mode).toBe('sen-dni');
		expect(r.busca.letra).toBe('E');
		expect(r.busca.suggestions).toContain(DNI);
		expect(r.busca.suggestions.length).toBeLessThanOrEqual(3);
		const html = await page(r);
		expect(html).toContain('Ninguén con este DNI');
		expect(html).toMatch(/name="q"[^>]*value="34987654P"|value="34987654P"[^>]*name="q"/);
	});

	it('rexistrar unha persoa nova co DNI; un DNI repetido dá DNI_EXISTS', async () => {
		const bad = (await novaActions.novaPersoa(
			post(db, conserje, '/nova?/novaPersoa', {
				nome: 'Ana Nova',
				telefono: '600999888',
				dni: '12345678A'
			})
		)) as any;
		expect(bad.status).toBe(400);
		expect(bad.data.dniError).toBe(true);
		const dup = (await novaActions.novaPersoa(
			post(db, conserje, '/nova?/novaPersoa', { nome: 'Outro', telefono: '600999888', dni: DNI })
		)) as any;
		expect(dup.status).toBe(409);
		expect(dup.data.error).toBe('DNI_EXISTS');
		const okNew = await thrown(() =>
			novaActions.novaPersoa(
				post(db, conserje, '/nova?/novaPersoa', {
					nome: 'Ana Nova',
					telefono: '600999888',
					dni: '12345678Z'
				})
			)
		);
		expect(okNew.status).toBe(303);
		const found = (await novaActions.buscar(
			post(db, conserje, '/nova?/buscar', { q: '12345678z' })
		)) as any;
		expect(found.busca.card.displayName).toBe('Ana Nova');
	});

	it('alguén doutro concello: nome abreviado e «Si» crea o perfil (non empadroado) coa sinatura', async () => {
		const outsider = await mkUser(db, 'fora', 'Lois Fora Lonxe');
		await db
			.update(users)
			.set({ dniHash: hashDni('11223344B', dniSecret()!) })
			.where(eq(users.id, outsider.id));
		await db
			.insert(municipalityProfiles)
			.values({ municipalityId: fx.otherMunicipalityId, userId: outsider.id, isResident: true });
		const r = (await novaActions.buscar(
			post(db, conserje, '/nova?/buscar', { q: '11223344B' })
		)) as any;
		expect(r.busca.card.profileId).toBeNull();
		expect(r.busca.card.displayName).toBe('Lois F. L.');
		// Sen sinatura válida non se crea nada.
		expect(
			(
				await thrown(() =>
					novaActions.confirmarDni(
						post(db, conserje, '/nova?/confirmarDni', { usuario: outsider.id, sinal: 'x' })
					)
				)
			).status
		).toBe(404);
		const res = await thrown(() =>
			novaActions.confirmarDni(
				post(db, conserje, '/nova?/confirmarDni', {
					usuario: outsider.id,
					sinal: r.busca.card.sinal
				})
			)
		);
		expect(res.status).toBe(303);
		const [p] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.userId, outsider.id));
		const mine = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.municipalityId, fx.municipalityId));
		const created = mine.find((m) => m.userId === outsider.id)!;
		expect(p).toBeTruthy();
		expect(created.isResident).toBe(false);
		expect((res as unknown as { location: string }).location).toBe(
			`/ribadavila/conserxeria/nova?persoa=${created.id}`
		);
	});

	it('comprobar o empadroamento cambia o prezo da seguinte reserva', async () => {
		const prices = async () =>
			(
				(await novaLoad(
					get(
						db,
						conserje,
						`/nova?persoa=${xoanProfile}&tipo=${fx.typeId}&date=2026-11-24&time=18:00`
					)
				)) as any
			).options.map((o: any) => o.priceCents);
		expect(await prices()).toEqual([600]);
		const d = (await persoaLoad(get(db, conserje, `/persoa?persoa=${xoanProfile}`))) as any;
		expect(d.person.isResident).toBe(false);
		expect(d.person.avatar).toEqual({ key: null, hasPhoto: false });
		const r = (await persoaActions.empadroamento(
			post(db, conserje, `/persoa?/empadroamento&persoa=${xoanProfile}`, {})
		)) as any;
		expect(r.done).toBe('empadroamento');
		expect(await prices()).toEqual([300]);
		const [row] = await db
			.select()
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, xoanProfile));
		expect(row.residencyVerifiedBy).toBe(conserje.id);
	});

	it('a tarifa social gárdase e un valor descoñecido dá 400', async () => {
		const r = (await persoaActions.tarifa(
			post(db, conserje, `/persoa?/tarifa&persoa=${xoanProfile}`, { tarifa: 'maior' })
		)) as any;
		expect(r.done).toBe('tarifa');
		const d = (await persoaLoad(get(db, conserje, `/persoa?persoa=${xoanProfile}`))) as any;
		expect(d.person.socialTariff).toBe('maior');
		const bad = (await persoaActions.tarifa(
			post(db, conserje, `/persoa?/tarifa&persoa=${xoanProfile}`, { tarifa: 'vip' })
		)) as any;
		expect(bad.status).toBe(400);
		await persoaActions.tarifa(
			post(db, conserje, `/persoa?/tarifa&persoa=${xoanProfile}`, { tarifa: '' })
		);
		const after = (await persoaLoad(get(db, conserje, `/persoa?persoa=${xoanProfile}`))) as any;
		expect(after.person.socialTariff).toBeNull();
	});

	it('cancelar dende a ficha pide confirmación e motivo; co motivo avisa á persoa', async () => {
		const b = await createBooking(db, {
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: xoanProfile,
			startsAt: TOMORROW_SLOT,
			channel: 'phone',
			createdByUserId: conserje.id,
			now: CREATED
		});
		if (!b.ok) throw new Error(b.error);
		const path = `/persoa?/cancelar&persoa=${xoanProfile}`;
		const first = (await persoaActions.cancelar(
			post(db, conserje, path, { reserva: b.value.id })
		)) as any;
		expect(first.status).toBe(409);
		expect(first.data.confirmCancel).toBe(b.value.id);
		const empty = (await persoaActions.cancelar(
			post(db, conserje, path, { reserva: b.value.id, confirmar: '1', motivo: '  ' })
		)) as any;
		expect(empty.status).toBe(400);
		expect(empty.data.confirmCancel).toBe(b.value.id);
		const done = (await persoaActions.cancelar(
			post(db, conserje, path, { reserva: b.value.id, confirmar: '1', motivo: 'Pista en obras' })
		)) as any;
		expect(done.done).toBe('cancelar');
		const [row] = await db.select().from(bookings).where(eq(bookings.id, b.value.id));
		expect(row.status).toBe('cancelled');
		const sent = await db.select().from(notifications).where(eq(notifications.userId, xoan.id));
		expect(sent.map((n) => n.kind)).toContain('cancelled_by_staff');
	});

	it('cancelar unha reserva doutra persoa dende a ficha dá 404', async () => {
		const b = await createBooking(db, {
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt: TOMORROW_SLOT,
			channel: 'phone',
			createdByUserId: conserje.id,
			now: CREATED
		});
		if (!b.ok) throw new Error(b.error);
		expect(
			(
				await thrown(() =>
					persoaActions.cancelar(
						post(db, conserje, `/persoa?/cancelar&persoa=${xoanProfile}`, {
							reserva: b.value.id,
							confirmar: '1',
							motivo: 'x'
						})
					)
				)
			).status
		).toBe(404);
	});

	it('validar: o escáner é só unha mellora, o formulario manual sempre está', () => {
		const body = render(ValidarPage, {
			props: { data: { locale: 'gl', lookup: null }, form: null } as never
		}).body;
		expect(body).toMatch(/<form[^>]*action="\?\/buscar"/);
		expect(body).toMatch(/<input[^>]*id="codigo"/);
		// Sen JavaScript (render do servidor) non hai cámara nin botón para abrila.
		expect(body).not.toContain('<video');
		expect(body).not.toContain('Escanear QR');
		expect(body).toContain('data-qr-scanner');
	});
});
