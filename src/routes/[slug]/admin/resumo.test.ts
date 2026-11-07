// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { bookings, staffRoles, users } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { makeEvent } from '../../../lib/server/http/test-event';
import { load as layoutLoad } from './+layout.server';
import { load as pageLoad } from './+page.server';
import Page from './+page.svelte';
import ExportPage from './exportar/+page.svelte';

const NOW = new Date('2026-11-20T10:00:00+01:00');
type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;
let code = 0;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

/** `n` reservas de una hora en días y horas distintos (de luns 16 a domingo 22 de novembro). */
async function book(skip: number, n: number) {
	const slots: { day: string; hour: number }[] = [];
	for (let d = 16; d <= 22; d++)
		for (let h = 9; h < 22; h++) slots.push({ day: `2026-11-${d}`, hour: h });
	const pad = (h: number) => String(h).padStart(2, '0');
	await db.insert(bookings).values(
		slots.slice(skip, skip + n).map((s) => ({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			startsAt: new Date(`${s.day}T${pad(s.hour)}:00:00+01:00`),
			endsAt: new Date(`${s.day}T${pad(s.hour + 1)}:00:00+01:00`),
			status: 'confirmed' as const,
			accessCode: String(200000 + ++code),
			priceCents: 300,
			channel: 'online' as const,
			createdByUserId: fx.userId
		}))
	);
}

const ev = (user: U | null, url = 'http://localhost/ribadavila/admin') =>
	makeEvent({ db, now: NOW, user, params: { slug: 'ribadavila' }, url }) as never;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;
const run = async (periodo: string) =>
	(await pageLoad(ev(admin, `http://localhost/ribadavila/admin?periodo=${periodo}`))) as Data;

const props = (data: Record<string, unknown>) => ({
	props: {
		data: {
			locale: 'gl',
			municipality: { slug: 'ribadavila', name: 'Ribadávila' },
			...data
		} as never
	}
});

describe('admin: resumo', () => {
	it('o layout con un conserxe dá 403 e sen sesión redirixe', async () => {
		await expect(layoutLoad(ev(conserxe))).rejects.toMatchObject({ status: 403 });
		await expect(pageLoad(ev(conserxe))).rejects.toMatchObject({ status: 403 });
		await expect(layoutLoad(ev(null))).rejects.toMatchObject({ status: 303 });
		expect(await layoutLoad(ev(admin))).toBeDefined();
	});

	it('periodo=tres pide un rango de 91 días; semana 7, mes 30 e mes por defecto', async () => {
		const days = (d: Data) => (Date.parse(d.to) - Date.parse(d.from)) / 86_400_000 + 1;
		expect(days(await run('tres'))).toBe(91);
		expect(days(await run('semana'))).toBe(7);
		const def = (await pageLoad(ev(admin))) as Data;
		expect(def.periodo).toBe('mes');
		expect(days(def)).toBe(30);
		expect(def.to).toBe('2026-11-20');
		expect((await run('rubbish')).periodo).toBe('mes');
	});

	it('o aviso aparece cunha ocupación do 9 % e non cunha do 40 %', async () => {
		await book(0, 8); // 8 de 91 franjas ≈ 9 %
		const low = await run('semana');
		expect(low.bars[0].occupancy).toBeCloseTo(0.088, 2);
		expect(low.warning).toMatchObject({ name: 'Pista 1' });
		const html = render(Page, props(low) as never).body;
		expect(html).toContain(
			'Pista 1 case non se usa. Probades a cambiar o horario ou abrila a un club?'
		);
		expect(html).toContain('aria-label="Pista 1: 9 % de ocupación"');
		expect(html).not.toContain('Descargar CSV');
		expect(html).not.toContain('/api/v1/m/ribadavila/admin/indicators.csv');

		await book(8, 28); // 36 reservas en total ≈ 40 %
		const high = await run('semana');
		expect(high.bars[0].occupancy).toBeGreaterThan(0.39);
		expect(high.warning).toBeNull();
		expect(render(Page, props(high) as never).body).not.toContain('case non se usa');
	});

	it('cifras: reservas, ausencias e franja de horas punta', async () => {
		const d = await run('semana');
		expect(d.kpi.bookings).toBe(36);
		expect(d.kpi.noShowRate).toBe(0);
		expect(d.kpi.peak).toEqual({ from: 9, to: 11 });
		const html = render(Page, props(d) as never).body;
		expect(html).toContain('9–11 h');
		expect(html).toContain('36');
	});

	it('exportar: tres ligazóns de descarga', () => {
		const html = render(ExportPage, props({}) as never).body;
		expect(html).toContain('Os teus datos son teus');
		expect(html).toContain('/api/v1/m/ribadavila/admin/export/bookings');
		expect(html).toContain('/api/v1/m/ribadavila/admin/export"');
		expect(html).toContain('/api/v1/m/ribadavila/admin/export.ics');
	});
});
