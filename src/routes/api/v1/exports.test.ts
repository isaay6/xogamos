// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import {
	bookings,
	municipalities,
	municipalityProfiles,
	sessions,
	staffRoles,
	users
} from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { setLogo } from '../../../lib/server/services/logo';
import { GET as exportJson } from './m/[slug]/admin/export/+server';
import { GET as exportTable } from './m/[slug]/admin/export/[table]/+server';
import { GET as exportXlsx } from './m/[slug]/admin/export.xlsx/+server';
import { GET as myIcs } from './m/[slug]/me/bookings.ics/+server';

const NOW = new Date('2026-11-20T10:00:00+01:00');
type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserje: U;
let vecina: U;
const SUBJECT = 'fixture-user';

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Admin Ribadávila');
	conserje = await mkUser('conserje', 'Conserxe Ribadávila');
	const [v] = await db.select().from(users).where(eq(users.id, fx.userId));
	vecina = { id: v.id, displayName: v.displayName };
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserje.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
	// La vecina tiene también perfil en Montemaior.
	const [otherProfile] = await db
		.insert(municipalityProfiles)
		.values({ municipalityId: fx.otherMunicipalityId, userId: fx.userId, isResident: true })
		.returning();
	const mk = (
		m: string,
		f: string,
		p: string,
		h: number,
		status: 'confirmed' | 'cancelled' = 'confirmed'
	) => ({
		municipalityId: m,
		facilityId: f,
		profileId: p,
		startsAt: new Date(`2026-11-2${h}T17:00:00Z`),
		endsAt: new Date(`2026-11-2${h}T18:00:00Z`),
		status,
		accessCode: '12345' + h,
		priceCents: 300,
		channel: 'online' as const,
		createdByUserId: fx.userId
	});
	await db
		.insert(bookings)
		.values([
			mk(fx.municipalityId, fx.facilityId, fx.profileId, 4),
			mk(fx.municipalityId, fx.facilityId, fx.profileId, 5),
			mk(fx.municipalityId, fx.facilityId, fx.profileId, 6, 'cancelled'),
			mk(fx.otherMunicipalityId, fx.otherFacilityId, otherProfile.id, 7)
		]);
	await db
		.insert(sessions)
		.values({ id: 'f'.repeat(64), userId: fx.userId, expiresAt: new Date('2027-01-01') });
});

const ev = (user: U | null, params: Record<string, string>) =>
	makeEvent({ db, now: NOW, user, params }) as never;

describe('exportación JSON', () => {
	it('conserje 403, sin sesión 401, concello inexistente 404', async () => {
		expect((await exportJson(ev(conserje, { slug: 'ribadavila' }))).status).toBe(403);
		expect((await exportJson(ev(null, { slug: 'ribadavila' }))).status).toBe(401);
		expect((await exportJson(ev(admin, { slug: 'nada' }))).status).toBe(404);
	});

	it('administrador de otro concello 403', async () => {
		expect((await exportJson(ev(admin, { slug: 'montemaior-do-rio' }))).status).toBe(403);
	});

	it('solo datos de Ribadávila y nunca sesiones ni subject', async () => {
		const res = await exportJson(ev(admin, { slug: 'ribadavila' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(res.headers.get('content-disposition')).toContain('attachment');
		expect(res.headers.get('cache-control')).toBe('no-store');
		const text = await res.text();
		const data = JSON.parse(text);
		expect(data.format).toBe('plataforma-reservas/export');
		expect(data.version).toBe(1);
		expect(data.municipality.slug).toBe('ribadavila');
		expect(data.profiles).toHaveLength(2);
		const mine = data.profiles.filter((p: { userId: string }) => p.userId === fx.userId);
		expect(mine).toHaveLength(1);
		expect(mine[0].municipalityId).toBe(fx.municipalityId);
		expect(mine[0].displayName).toBe(vecina.displayName);
		expect(data.bookings).toHaveLength(3);
		for (const f of data.facilities) expect(f.municipalityId).toBe(fx.municipalityId);
		for (const b of data.bookings) {
			expect(b.municipalityId).toBe(fx.municipalityId);
			expect(b.facilityId).toBe(fx.facilityId);
		}
		expect(text).not.toContain(fx.otherMunicipalityId);
		expect(text).not.toContain(fx.otherFacilityId);
		expect(text).not.toContain('f'.repeat(64));
		expect(text).not.toContain(SUBJECT);
		expect(data).not.toHaveProperty('sessions');
		expect(data.staffRoles.map((r: { userId: string }) => r.userId).sort()).toEqual(
			[admin.id, conserje.id].sort()
		);
	});
});

describe('exportación JSON: escudo', () => {
	it('sen chave numérica `logo`: o escudo vai como logoBase64 con logoMime', async () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
		expect((await setLogo(db, fx.municipalityId, png)).ok).toBe(true);
		const text = await (await exportJson(ev(admin, { slug: 'ribadavila' }))).text();
		const { municipality } = JSON.parse(text);
		expect(municipality).not.toHaveProperty('logo');
		expect(municipality.logoMime).toBe('image/png');
		expect(Buffer.from(municipality.logoBase64, 'base64')).toEqual(Buffer.from(png));
		// Ningún objeto con claves numéricas (un Uint8Array serializado).
		expect(text).not.toMatch(/"0":\s*137/);
	});

	it('sen escudo: logoBase64 e logoMime son null', async () => {
		await db
			.update(municipalities)
			.set({ logo: null, logoMime: null })
			.where(eq(municipalities.id, fx.municipalityId));
		const { municipality } = JSON.parse(
			await (await exportJson(ev(admin, { slug: 'ribadavila' }))).text()
		);
		expect(municipality.logoBase64).toBeNull();
		expect(municipality.logoMime).toBeNull();
	});
});

describe('exportación CSV', () => {
	it('cabeceras y filas', async () => {
		const res = await exportTable(ev(admin, { slug: 'ribadavila', table: 'bookings' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(res.headers.get('content-disposition')).toBe(
			'attachment; filename="ribadavila-bookings-2026-11-20.csv"'
		);
		const bytes = new Uint8Array(await res.clone().arrayBuffer());
		expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
		const text = await res.text();
		expect(text.trim().split('\r\n')).toHaveLength(4);
		expect(text).toContain(';');
		expect(text).not.toContain(fx.otherFacilityId);
	});

	it('facilities y profiles; sin subject', async () => {
		const f = await (
			await exportTable(ev(admin, { slug: 'ribadavila', table: 'facilities' }))
		).text();
		expect(f).toContain('Pista 1');
		expect(f).not.toContain('Pista central');
		const p = await (
			await exportTable(ev(admin, { slug: 'ribadavila', table: 'profiles' }))
		).text();
		expect(p.trim().split('\r\n')).toHaveLength(3);
		expect(p).not.toContain(SUBJECT);
	});

	it('tabla desconocida 400, conserje 403', async () => {
		expect((await exportTable(ev(admin, { slug: 'ribadavila', table: 'sessions' }))).status).toBe(
			400
		);
		expect(
			(await exportTable(ev(conserje, { slug: 'ribadavila', table: 'bookings' }))).status
		).toBe(403);
	});
});

describe('exportación Excel', () => {
	it('administrador recibe as sete follas con cabeceiras', async () => {
		const res = await exportXlsx(ev(admin, { slug: 'ribadavila' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
		const content = new TextDecoder().decode(await res.arrayBuffer());
		for (const name of [
			'Reservas',
			'Persoas',
			'Instalacións',
			'Horarios',
			'Peches',
			'Abonos',
			'Tempadas'
		]) {
			expect(content).toContain(`name="${name}"`);
		}
		expect(content).toContain('Instalación');
		expect(content).toContain('state="frozen"');
	});

	it('conserxe e outro concello non poden exportar', async () => {
		expect((await exportXlsx(ev(conserje, { slug: 'ribadavila' }))).status).toBe(403);
		expect((await exportXlsx(ev(admin, { slug: 'montemaior-do-rio' }))).status).toBe(403);
	});
});

describe('me/bookings.ics', () => {
	it('sin sesión 401', async () => {
		expect((await myIcs(ev(null, { slug: 'ribadavila' }))).status).toBe(401);
	});

	it('una VEVENT por reserva no cancelada', async () => {
		const res = await myIcs(ev(vecina, { slug: 'ribadavila' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		const text = await res.text();
		expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
		expect(text).toContain('@plataforma-reservas');
		expect(text).toContain('123454');
		expect(text).not.toContain('123456');
		expect(text).not.toContain('123457');
	});

	it('sin perfil: calendario vacío', async () => {
		const res = await myIcs(ev(admin, { slug: 'ribadavila' }));
		expect(res.status).toBe(200);
		expect((await res.text()).match(/BEGIN:VEVENT/g)).toBeNull();
	});
});
