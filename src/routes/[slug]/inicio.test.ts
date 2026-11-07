// SPDX-License-Identifier: EUPL-1.2
// Portada en capas (tarefa 7) e peches visibles ao reservar, coa demo de Viana do Bolo.
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../lib/server/db/client';
import { users } from '../../lib/server/db/schema';
import { seedDemo } from '../../lib/server/db/seed';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateOf } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { freeNow } from '../../lib/server/services/home';
import { getProfile, listMyBookings } from '../../lib/server/services/profiles';
import { dayStrip, hoursForDay, listSports } from '../../lib/server/services/search';
import { getMunicipalityBySlug } from '../../lib/server/services/municipalities';
import { load as loadLayout } from './+layout.server';
import { load } from './+page.server';
import InicioPage from './+page.svelte';
import { load as loadAvisos } from './avisos/+page.server';
import { countUnread } from '../../lib/server/services/notifications';
import { load as loadDia } from './reservar/[typeId]/+page.server';
import DiaPage from './reservar/[typeId]/+page.svelte';

const mockPage = vi.hoisted(() => ({ url: new URL('http://localhost/') }));
vi.mock('$app/state', () => ({ page: mockPage }));

// Xoves 22 out 2026, 16:40 en Madrid (o día dos mockups).
const NOW = new Date('2026-10-22T14:40:00Z');
const SLUG = 'viana-do-bolo';
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

let db: Db;
let municipalityId: string;
let uxia: { id: string; displayName: string };
let poolTypeId: string;

beforeAll(async () => {
	db = await createTestDb();
	await seedDemo(db, { now: NOW, scale: 0.2 });
	const [u] = await db.select().from(users).where(eq(users.displayName, 'Nerea Cabaleiro'));
	uxia = { id: u.id, displayName: u.displayName };
	const m = await getMunicipalityBySlug(db, SLUG);
	municipalityId = m!.id;
	const pool = (await listSports(db, municipalityId)).find((s) => s.mascot === 'natacion');
	poolTypeId = pool!.typeId;
}, 120_000);

const ev = (
	user: { id: string; displayName: string } | null,
	path = '',
	params: Record<string, string> = {}
) =>
	makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: SLUG, ...params },
		url: `http://localhost/${SLUG}${path}`
	});

async function page(
	Page: unknown,
	pageLoad: unknown,
	user: { id: string; displayName: string } | null,
	path = '',
	params: Record<string, string> = {}
): Promise<string> {
	mockPage.url = new URL(`http://localhost/${SLUG}${path}`);
	const layout = await call<Promise<object>>(loadLayout, ev(user, path, params));
	const data = await call<Promise<object>>(pageLoad, ev(user, path, params));
	return render(Page as never, { props: { data: { ...layout, ...data }, params } as never }).body;
}

describe('peches ao reservar: a piscina de Viana', () => {
	it('a tira e as horas din «Pechada ata xuño», non completo', async () => {
		const days = await dayStrip(db, municipalityId, poolTypeId, NOW);
		expect(days.length).toBeGreaterThan(0);
		expect(days.every((d) => d.closed?.reason === 'Pechada ata xuño')).toBe(true);
		const hours = await hoursForDay(db, municipalityId, poolTypeId, localDateOf(NOW), NOW);
		expect(hours.length).toBeGreaterThan(0);
		expect(hours.every((h) => !h.free && h.closed?.reason === 'Pechada ata xuño')).toBe(true);
	});

	it('a páxina do día ensina «Pechada: Pechada ata xuño» e ningunha hora se pode escoller', async () => {
		const html = await page(DiaPage, loadDia, uxia, `/reservar/${poolTypeId}`, {
			typeId: poolTypeId
		});
		expect(html).toContain('Pechada: Pechada ata xuño');
		expect(html).not.toContain('completo');
		expect(html).not.toContain('completa');
		const hourInputs = [...html.matchAll(/<input[^>]*name="time"[^>]*value="\d\d:\d\d"[^>]*>/g)];
		expect(hourInputs.length).toBeGreaterThan(0);
		for (const [input] of hourInputs) expect(input).toContain('disabled');
		expect(html).toContain('pechada: Pechada ata xuño');
		// Sen saída morta: «Calquera hora» e o botón quedan desactivados (tamén sen JavaScript).
		expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
		expect(html).toMatch(/<input[^>]*name="time"[^>]*value=""[^>]*disabled/);
		expect(html).toMatch(/class="pechada[^"]*" role="status"/);
	});
});

describe('portada', () => {
	it('coa reserva fácil só mostra os tres botóns grandes', async () => {
		await db.update(users).set({ easyBooking: true }).where(eq(users.id, uxia.id));
		const out = await page(InicioPage, load, uxia);
		expect(out).toContain('href="/viana-do-bolo/reservar/facil"');
		expect(out).toContain('As miñas reservas');
		expect(out).toContain('Avisos');
		expect(out).not.toContain('Todos os deportes');
		await db.update(users).set({ easyBooking: false }).where(eq(users.id, uxia.id));
	});

	it('freeNow en Viana: só franxas de hoxe que aínda non empezaron, unha por deporte', async () => {
		const out = await freeNow(db, municipalityId, NOW);
		expect(out.length).toBeGreaterThan(0);
		expect(out.length).toBeLessThanOrEqual(4);
		for (const o of out) {
			expect(o.startsAt.getTime()).toBeGreaterThan(NOW.getTime());
			expect(localDateOf(o.startsAt)).toBe(localDateOf(NOW));
		}
		expect(new Set(out.map((o) => o.typeId)).size).toBe(out.length);
	});

	it('os deportes e as suxestións levan ao fluxo normal, sen data nin hora', async () => {
		const html = await page(InicioPage, load, null);
		const links = [...html.matchAll(/href="([^"]*\/reservar\/[^"]*)"/g)].map((m) => m[1]);
		expect(links.length).toBeGreaterThan(0);
		for (const href of links) {
			expect(href).toMatch(/^\/viana-do-bolo\/reservar\/[0-9a-f-]{36}$/);
			expect(href).not.toMatch(/date=|time=/);
		}
	});

	it('sen sesión: sen bloque da próxima reserva; os avisos levan á pestana Avisos', async () => {
		const html = await page(InicioPage, load, null);
		expect(html).not.toContain('A túa próxima reserva');
		expect(html).toContain('href="/viana-do-bolo/avisos"');
		expect(html).not.toContain('Libre agora mesmo');
		expect(html).toContain('Todos os deportes');
		expect(html).toContain('Pechada ata xuño');
	});

	it('Nerea: a portada conta os mesmos avisos ca Avisos (só os do concello actual)', async () => {
		const home = await call<Promise<{ noticeCount: number }>>(load, ev(uxia));
		const avisos = await call<Promise<{ notices: unknown[] }>>(loadAvisos, ev(uxia, '/avisos'));
		expect(avisos.notices.length).toBeGreaterThan(0);
		expect(home.noticeCount).toBe(avisos.notices.length);
		const html = await page(InicioPage, load, uxia);
		expect(html).toContain('Ver todos os avisos');
	});

	it('Nerea: «Tes N avisos sen ler» leva a Avisos; sen sesión non aparece', async () => {
		const n = await countUnread(db, uxia.id);
		expect(n).toBeGreaterThan(1);
		const html = await page(InicioPage, load, uxia);
		expect(html).toMatch(
			new RegExp(`<a href="/viana-do-bolo/avisos"[^>]*>Tes ${n} avisos sen ler</a>`)
		);
		expect(await page(InicioPage, load, null)).not.toContain('sen ler');
	});

	it('Nerea: a súa próxima reserva co PIN', async () => {
		const profile = await getProfile(db, municipalityId, uxia.id);
		const [next] = await listMyBookings(db, municipalityId, profile!.id, {
			scope: 'upcoming',
			now: NOW,
			includeOngoing: true
		});
		expect(next).toBeDefined();
		const html = await page(InicioPage, load, uxia);
		expect(html).toContain('A túa próxima reserva');
		expect(html).toContain(next.accessCode);
		expect(html).toContain(`href="/viana-do-bolo/reserva/${next.id}"`);
		expect(html).toContain('Ver a reserva');
	});

	it('a portada non carga o libre agora nin o consello das horas tranquilas', async () => {
		const out = await call<Promise<Record<string, unknown>>>(load, ev(null));
		expect(out).not.toHaveProperty('freeNow');
		expect(out).not.toHaveProperty('tip');
		const html = await page(InicioPage, load, null);
		expect(html).not.toContain('Horas tranquilas hoxe');
	});
});
