// SPDX-License-Identifier: EUPL-1.2
// Avisos (tarea 5): «Do concello» y «Para ti», privacidade dos avisos persoais e accións.
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { eq, ne } from 'drizzle-orm';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../lib/server/db/client';
import { municipalityNotices, notifications, users } from '../../lib/server/db/schema';
import { seedDemo } from '../../lib/server/db/seed';
import { createTestDb } from '../../lib/server/db/test-db';
import { makeEvent } from '../../lib/server/http/test-event';
import { countUnread, listNotifications } from '../../lib/server/services/notifications';
import { listFollowed } from '../../lib/server/services/profiles';
import { load as loadLayout } from './+layout.server';
import { actions, load } from './avisos/+page.server';
import AvisosPage from './avisos/+page.svelte';
import { municipalities } from '../../lib/server/db/schema';

// Xoves 22 out 2026, 18:30 en Madrid.
const NOW = new Date('2026-10-22T16:30:00Z');
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

async function outcome<T>(run: () => T | Promise<T>) {
	try {
		return { value: await run() };
	} catch (e) {
		return { thrown: e };
	}
}

let db: Db;
let uxia: { id: string; displayName: string };
let other: { id: string; displayName: string };

beforeAll(async () => {
	db = await createTestDb();
	await seedDemo(db, { now: NOW, scale: 0.2 });
	const [u] = await db.select().from(users).where(eq(users.displayName, 'Nerea Cabaleiro'));
	uxia = u;
	const [o] = await db.select().from(users).where(ne(users.id, u.id)).limit(1);
	other = o;
}, 120_000);

const ev = (
	user: { id: string; displayName: string } | null,
	slug = 'viana-do-bolo',
	form?: Record<string, string>
) => {
	const event = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug },
		url: `http://localhost/${slug}/avisos`
	});
	if (form)
		(event as { request: Request }).request = new Request(event.url, {
			method: 'POST',
			body: new URLSearchParams(form)
		});
	return event;
};

type Loaded = {
	needsLogin: boolean;
	notices: { id: string; municipalityName: string; title: string }[];
	personal: {
		id: string;
		kind: string;
		bookingId: string | null;
		href: string | null;
		unread: boolean;
		params: Record<string, string>;
	}[];
	unread: number;
	locale: 'gl' | 'es';
};

const renderAvisos = async (user: { id: string; displayName: string } | null) => {
	const out = await call<Promise<Loaded>>(load, ev(user));
	const layout = await call<Promise<object>>(loadLayout, ev(user));
	return render(AvisosPage as never, {
		props: { data: { ...layout, ...out }, form: undefined } as never
	}).body;
};

describe('avisos: escudo e datas', () => {
	it('só aparece o bando do concello actual, co seu escudo e nome na cabeceira', async () => {
		// Cada concello é a súa propia rede: os avisos doutro concello seguido non se mesturan.
		const body = await renderAvisos(uxia);
		expect(body).toContain('Bando · Viana do Bolo');
		expect(body).not.toContain('Bando · A Rúa');
	});

	it('un aviso de hai máis de 6 días leva o día e o mes', async () => {
		await db.insert(notifications).values({
			userId: uxia.id,
			kind: 'hours_changed',
			params: { facilityName: 'Pista vella' },
			createdAt: new Date('2026-10-09T08:10:00Z')
		});
		const body = await renderAvisos(uxia);
		expect(body).toContain('9 de outubro · 10:10');
	});
});

describe('avisos: load', () => {
	it('Nerea: avisos persoais do máis novo ao máis vello e o da piscina de Viana', async () => {
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		expect(out.needsLogin).toBe(false);
		expect(out.notices.map((n) => n.title)).toContain('Pechada ata xuño');
		const mine = await listNotifications(db, uxia.id);
		expect(out.personal.map((p) => p.id)).toEqual(mine.map((n) => n.id));
		expect(out.personal.length).toBeGreaterThan(0);
		expect(out.personal.some((p) => p.unread)).toBe(true);
		expect(out.unread).toBe(await countUnread(db, uxia.id));
	});

	it('os avisos do concello son só os dos seguidos máis o actual', async () => {
		const followed = (await listFollowed(db, uxia.id)).map((f) => f.name);
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		for (const n of out.notices)
			expect([...followed, 'Viana do Bolo'], n.municipalityName).toContain(n.municipalityName);
		// Un concello non seguido amósase só se é o actual.
		const arua = await call<Promise<Loaded>>(load, ev(other, 'a-rua'));
		for (const n of arua.notices)
			expect(
				[...(await listFollowed(db, other.id)).map((f) => f.name), 'A Rúa'],
				n.municipalityName
			).toContain(n.municipalityName);
	});

	it('os avisos doutros concellos, seguidos ou non, non aparecen no actual', async () => {
		const followed = await listFollowed(db, uxia.id);
		expect(followed.map((f) => f.name)).toContain('A Rúa');
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		const titles = out.notices.map((n) => n.title);
		expect(titles).not.toContain('Nova iluminación na pista de pádel');
		expect(titles).not.toContain('Torneo comarcal de balonmán no pavillón');
	});

	it('outra persoa nunca ve os avisos persoais de Nerea', async () => {
		const mine = new Set((await listNotifications(db, uxia.id)).map((n) => n.id));
		const out = await call<Promise<Loaded>>(load, ev(other));
		expect(out.personal.some((p) => mine.has(p.id))).toBe(false);
	});

	it('os avisos persoais enlazan coa súa reserva', async () => {
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		const withBooking = out.personal.filter((p) => p.bookingId);
		expect(withBooking.length).toBeGreaterThan(0);
		for (const p of withBooking) expect(p.href).toBe(`/viana-do-bolo/reserva/${p.bookingId}`);
	});

	it('sen sesión: só «Do concello», sen sección persoal, e invita a entrar', async () => {
		const out = await call<Promise<Loaded>>(load, ev(null));
		expect(out.needsLogin).toBe(true);
		expect(out.personal).toEqual([]);
		expect(out.notices.map((n) => n.title)).toEqual(['Pechada ata xuño']);
		const layout = await call<Promise<{ locale: string }>>(loadLayout, ev(null));
		const body = render(AvisosPage as never, {
			props: { data: { ...layout, ...out }, form: undefined } as never
		}).body;
		expect(body).toContain('Do concello');
		expect(body).not.toContain('Para ti');
		expect(body).toContain('/viana-do-bolo/entrar?redirectTo=%2Fviana-do-bolo%2Favisos');
	});
});

describe('avisos: páxina', () => {
	it('mostra a data formatada e nunca o ISO cru', async () => {
		const layout = await call<Promise<object>>(loadLayout, ev(uxia));
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		const body = render(AvisosPage as never, {
			props: { data: { ...layout, ...out }, form: undefined } as never
		}).body;
		expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
		expect(body).toContain('Para ti');
		expect(body).toContain('Do concello');
		expect(body).toContain('Marcar todo como lido');
		expect(body).toContain('name="id"');
	});
});

describe('avisos: accións', () => {
	it('?/ler marca un aviso propio', async () => {
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		const target = out.personal.find((p) => p.unread)!;
		const before = await countUnread(db, uxia.id);
		await call(actions['ler'], ev(uxia, 'viana-do-bolo', { id: target.id }));
		expect(await countUnread(db, uxia.id)).toBe(before - 1);
	});

	it('?/ler co id doutra persoa dá 404 e non o toca', async () => {
		const [row] = await db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, uxia.id))
			.limit(1);
		const r = await outcome(() => call(actions['ler'], ev(other, 'viana-do-bolo', { id: row.id })));
		expect(isHttpError(r.thrown, 404)).toBe(true);
		const r2 = await outcome(() =>
			call(actions['ler'], ev(other, 'viana-do-bolo', { id: 'no-es-un-uuid' }))
		);
		expect(isHttpError(r2.thrown, 404)).toBe(true);
	});

	it('sen sesión as accións redirixen a «Entrar»', async () => {
		const r = await outcome(() => call(actions['lertodo'], ev(null, 'viana-do-bolo', {})));
		expect(isRedirect(r.thrown)).toBe(true);
	});

	it('?/lertodo deixa as non lidas a 0', async () => {
		await call(actions['lertodo'], ev(uxia, 'viana-do-bolo', {}));
		expect(await countUnread(db, uxia.id)).toBe(0);
		const out = await call<Promise<Loaded>>(load, ev(uxia));
		expect(out.unread).toBe(0);
		expect(out.personal.every((p) => !p.unread)).toBe(true);
	});
});

describe('layout: contador de non lidas', () => {
	it('sen sesión 0; con sesión, o número de avisos sen ler', async () => {
		const anon = await call<Promise<{ unread: number }>>(loadLayout, ev(null));
		expect(anon.unread).toBe(0);
		// Reabre un aviso para ver o contador.
		const [row] = await db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, uxia.id))
			.limit(1);
		await db.update(notifications).set({ readAt: null }).where(eq(notifications.id, row.id));
		const mine = await call<Promise<{ unread: number }>>(loadLayout, ev(uxia));
		expect(mine.unread).toBe(1);
	});
});
