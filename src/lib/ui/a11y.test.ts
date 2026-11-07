// SPDX-License-Identifier: EUPL-1.2
// Accesibilidad (tarea 14b): SSR de las páginas principales con datos del fixture y reglas
// comprobadas sobre el HTML (alt, etiquetas, aria-hidden, nombres, títulos, ids únicos).
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../server/auth/types';
import type { Db } from '../server/db/client';
import { bookings, closures, staffRoles, users } from '../server/db/schema';
import { createTestDb } from '../server/db/test-db';
import { localDateTimeToUtc } from '../server/domain/time';
import { makeEvent } from '../server/http/test-event';
import { seedFixture, type Fixture } from '../server/services/fixtures';
import { load as loadInicio } from '../../routes/[slug]/+page.server';
import { load as loadSlugLayout } from '../../routes/[slug]/+layout.server';
import InicioPage from '../../routes/[slug]/+page.svelte';
import { load as loadAdminLayout } from '../../routes/[slug]/admin/+layout.server';
import { load as loadResumo } from '../../routes/[slug]/admin/+page.server';
import ResumoPage from '../../routes/[slug]/admin/+page.svelte';
import { load as loadEdit } from '../../routes/[slug]/admin/instalacions/[id]/+page.server';
import EditPage from '../../routes/[slug]/admin/instalacions/[id]/+page.svelte';
import { load as loadAsistente } from '../../routes/[slug]/admin/instalacions/asistente/+page.server';
import AsistentePage from '../../routes/[slug]/admin/instalacions/asistente/+page.svelte';
import { load as loadHorarios } from '../../routes/[slug]/admin/horarios/+page.server';
import HorariosPage from '../../routes/[slug]/admin/horarios/+page.svelte';
import { load as loadAvisosAdmin } from '../../routes/[slug]/admin/avisos/+page.server';
import AvisosAdminPage from '../../routes/[slug]/admin/avisos/+page.svelte';
import { load as loadTemporadas } from '../../routes/[slug]/admin/temporadas/+page.server';
import TemporadasPage from '../../routes/[slug]/admin/temporadas/+page.svelte';
import { load as loadConfirmar } from '../../routes/[slug]/confirmar/+page.server';
import ConfirmarPage from '../../routes/[slug]/confirmar/+page.svelte';
import { load as loadConsLayout } from '../../routes/[slug]/conserxeria/+layout.server';
import { load as loadAgenda } from '../../routes/[slug]/conserxeria/+page.server';
import AgendaPage from '../../routes/[slug]/conserxeria/+page.svelte';
import { load as loadFolla } from '../../routes/[slug]/conserxeria/folla/+page.server';
import FollaPage from '../../routes/[slug]/conserxeria/folla/+page.svelte';
import { load as loadNova } from '../../routes/[slug]/conserxeria/nova/+page.server';
import NovaPage from '../../routes/[slug]/conserxeria/nova/+page.svelte';
import ValidarPage from '../../routes/[slug]/conserxeria/validar/+page.svelte';
import { load as loadAvisos } from '../../routes/[slug]/avisos/+page.server';
import AvisosPage from '../../routes/[slug]/avisos/+page.svelte';
import { load as loadEu } from '../../routes/[slug]/eu/+page.server';
import { load as loadHistorial } from '../../routes/[slug]/eu/historial/+page.server';
import HistorialPage from '../../routes/[slug]/eu/historial/+page.svelte';
import EuPage from '../../routes/[slug]/eu/+page.svelte';
import { load as loadConcellos } from '../../routes/[slug]/eu/concellos/+page.server';
import ConcellosPage from '../../routes/[slug]/eu/concellos/+page.svelte';
import { load as loadPerfil } from '../../routes/[slug]/eu/perfil/+page.server';
import PerfilPage from '../../routes/[slug]/eu/perfil/+page.svelte';
import { load as loadAvisosPrefs } from '../../routes/[slug]/eu/avisos/+page.server';
import AvisosPrefsPage from '../../routes/[slug]/eu/avisos/+page.svelte';
import { load as loadBenvida } from '../../routes/benvida/+page.server';
import BenvidaPage from '../../routes/benvida/+page.svelte';
import { load as loadDetalle } from '../../routes/[slug]/reserva/[id]/+page.server';
import DetallePage from '../../routes/[slug]/reserva/[id]/+page.svelte';
import { load as loadXa } from '../../routes/[slug]/reserva/[id]/xa/+page.server';
import XaPage from '../../routes/[slug]/reserva/[id]/xa/+page.svelte';
import { load as loadDia } from '../../routes/[slug]/reservar/[typeId]/+page.server';
import DiaPage from '../../routes/[slug]/reservar/[typeId]/+page.svelte';
import { load as loadLibre } from '../../routes/[slug]/reservar/[typeId]/libre/+page.server';
import LibrePage from '../../routes/[slug]/reservar/[typeId]/libre/+page.svelte';
import { load as loadReservas } from '../../routes/[slug]/reservas/+page.server';
import ReservasPage from '../../routes/[slug]/reservas/+page.svelte';
import SlugLayout from '../../routes/[slug]/+layout.svelte';
import AdminLayout from '../../routes/[slug]/admin/+layout.svelte';
import ConsLayout from '../../routes/[slug]/conserxeria/+layout.svelte';
import SkipLink from './SkipLink.svelte';
import RootLayout from '../../routes/+layout.svelte';
import DemoPage from '../../routes/demo/+page.svelte';
import { DEMO_PROFILES } from '../server/demo';

// `$app/state` no tiene contexto de petición en las pruebas: la ruta actual se fija en cada caso.
const mockPage = vi.hoisted(() => ({ url: new URL('http://localhost/'), state: {} }));
vi.mock('$app/state', () => ({ page: mockPage }));

// ---------------------------------------------------------------------------------------------
// Auditor: lector de HTML ligero y reglas
// ---------------------------------------------------------------------------------------------

type Node = {
	tag: string;
	attrs: Record<string, string>;
	children: Node[];
	text: string[];
	parent: Node | null;
	/** Posición de apertura, para describir el elemento en los mensajes. */
	html: string;
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta']);
const TAG =
	/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parse(html: string): Node {
	const src = html.replace(/<!--[\s\S]*?-->/g, '');
	const root: Node = { tag: '#root', attrs: {}, children: [], text: [], parent: null, html: '' };
	let cur = root;
	let last = 0;
	for (const m of src.matchAll(TAG)) {
		const between = src.slice(last, m.index);
		if (between) cur.text.push(between);
		last = m.index + m[0].length;
		const [whole, close, rawTag, rawAttrs, selfClose] = m;
		const tag = rawTag.toLowerCase();
		if (close) {
			// Cierra hasta el elemento abierto con ese nombre (tolera cierres omitidos).
			let n: Node | null = cur;
			while (n && n.tag !== tag) n = n.parent;
			if (n?.parent) cur = n.parent;
			continue;
		}
		const attrs: Record<string, string> = {};
		for (const a of rawAttrs.matchAll(ATTR)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
		const node: Node = { tag, attrs, children: [], text: [], parent: cur, html: whole };
		cur.children.push(node);
		cur.text.push(`\u0000${cur.children.length - 1}\u0000`);
		if (!VOID.has(tag) && !selfClose) cur = node;
	}
	return root;
}

function walk(n: Node, fn: (n: Node) => void) {
	for (const c of n.children) {
		fn(c);
		walk(c, fn);
	}
}

const all = (root: Node, pick: (n: Node) => boolean) => {
	const out: Node[] = [];
	walk(root, (n) => pick(n) && out.push(n));
	return out;
};

/** Texto visible para tecnología asistiva: excluye subárboles `aria-hidden`. */
function textOf(n: Node): string {
	let out = '';
	for (const piece of n.text) {
		const ref = /^\u0000(\d+)\u0000$/.exec(piece);
		if (ref) {
			const child = n.children[Number(ref[1])];
			if (child.attrs['aria-hidden'] === 'true') continue;
			if (child.tag === 'img') out += ` ${child.attrs.alt ?? ''}`;
			else out += ` ${textOf(child)}`;
		} else out += piece;
	}
	return out.replace(/&[a-z#0-9]+;/g, 'x').trim();
}

const describeNode = (n: Node) => (n.html.length > 120 ? `${n.html.slice(0, 120)}…` : n.html);

/** Devuelve la lista de fallos de una página; vacía si cumple todo. */
export function audit(html: string): string[] {
	const root = parse(html);
	const problems: string[] = [];
	const fail = (rule: string, n: Node) => problems.push(`${rule}: ${describeNode(n)}`);

	// 1. Imágenes con alt
	for (const n of all(root, (x) => x.tag === 'img'))
		if (!('alt' in n.attrs)) fail('img sen alt', n);

	// 2. Controles con etiqueta
	const labelFor = new Set(
		all(root, (x) => x.tag === 'label' && 'for' in x.attrs).map((l) => l.attrs.for)
	);
	const ids = new Set(all(root, (x) => 'id' in x.attrs).map((x) => x.attrs.id));
	for (const n of all(root, (x) => ['input', 'select', 'textarea'].includes(x.tag))) {
		const type = (n.attrs.type ?? 'text').toLowerCase();
		if (n.tag === 'input' && ['hidden', 'submit', 'reset', 'button', 'image'].includes(type))
			continue;
		let wrapped = false;
		for (let p = n.parent; p; p = p.parent) if (p.tag === 'label') wrapped = true;
		const named =
			(n.attrs['aria-label'] ?? '').trim() !== '' ||
			(n.attrs['aria-labelledby'] !== undefined &&
				n.attrs['aria-labelledby'].split(/\s+/).every((i) => ids.has(i))) ||
			(n.attrs.id !== undefined && labelFor.has(n.attrs.id)) ||
			wrapped;
		if (!named) fail('control sen etiqueta', n);
	}

	// 3. Svg decorativos: aria-hidden, salvo role="img" con nombre
	for (const n of all(root, (x) => x.tag === 'svg')) {
		if (n.attrs['aria-hidden'] === 'true') continue;
		const hasTitle = n.children.some((c) => c.tag === 'title');
		const named = (n.attrs['aria-label'] ?? '') !== '' || n.attrs['aria-labelledby'] || hasTitle;
		if (n.attrs.role === 'img' && named) continue;
		// Dentro de un svg ya oculto no hace falta repetirlo.
		let hidden = false;
		for (let p = n.parent; p; p = p.parent) if (p.attrs['aria-hidden'] === 'true') hidden = true;
		if (!hidden) fail('svg sen aria-hidden nin role="img" con nome', n);
	}

	// 4. Botones y enlaces con nombre
	for (const n of all(root, (x) => x.tag === 'button' || (x.tag === 'a' && 'href' in x.attrs))) {
		const named =
			(n.attrs['aria-label'] ?? '').trim() !== '' ||
			n.attrs['aria-labelledby'] !== undefined ||
			textOf(n) !== '';
		if (!named) fail(`${n.tag} sen texto accesible`, n);
	}

	// 5. Un h1 e niveis sen saltos
	const headings = all(root, (x) => /^h[1-6]$/.test(x.tag));
	const h1 = headings.filter((h) => h.tag === 'h1');
	if (h1.length !== 1) problems.push(`debe haber exactamente un h1 e hai ${h1.length}`);
	let prev = 0;
	for (const h of headings) {
		const level = Number(h.tag[1]);
		if (prev && level > prev + 1) fail(`salto de h${prev} a h${level}`, h);
		prev = level;
	}

	// 6. Un único landmark principal
	const mains = all(root, (x) => x.tag === 'main');
	if (mains.length !== 1) problems.push(`debe haber exactamente un main e hai ${mains.length}`);

	// 7. Ids únicos
	const seen = new Set<string>();
	for (const n of all(root, (x) => 'id' in x.attrs)) {
		if (seen.has(n.attrs.id)) fail(`id repetido «${n.attrs.id}»`, n);
		seen.add(n.attrs.id);
	}
	return problems;
}

// Comprobar que el auditor detecta de verdade os fallos antes de fiarse del verde.
describe('auditor', () => {
	it('detecta cada tipo de fallo', () => {
		const bad = `<h2>x</h2><h4>y</h4><img src="a"><input name="a"><svg><use href="#d-x"></use></svg>
			<button></button><a href="/"><svg aria-hidden="true"></svg></a><div id="u"></div><p id="u"></p>`;
		const out = audit(bad).join('\n');
		for (const rule of [
			'img sen alt',
			'control sen etiqueta',
			'svg sen aria-hidden',
			'button sen texto',
			'a sen texto',
			'salto de h2 a h4',
			'debe haber exactamente un h1',
			'debe haber exactamente un main',
			'id repetido'
		])
			expect(out).toContain(rule);
	});
	it('acepta as formas correctas', () => {
		const good = `<main><h1>t</h1><h2>s</h2><img src="a" alt=""><label for="a">A</label><input id="a">
			<label>B <input name="b"></label><input type="hidden" name="h"><select aria-label="x"></select>
			<svg aria-hidden="true"><use href="#d-x"></use></svg>
			<svg role="img" aria-label="QR"></svg>
			<button><span class="sr">ok</span></button><a href="/" aria-label="eu">E</a></main>`;
		expect(audit(good)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------------------------

const NOW = new Date('2026-11-24T08:00:00+01:00');
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

let db: Db;
let fx: Fixture;
let vecina: SessionUser;
let conserxe: SessionUser;
let admin: SessionUser;
let bookingId: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	vecina = { id: fx.userId, displayName: 'Nerea Veciña' };
	const mk = async (subject: string, name: string): Promise<SessionUser> => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'local', subject, displayName: name })
			.returning();
		return { id: u.id, displayName: u.displayName };
	};
	conserxe = await mk('a11y-cons', 'Telmo Novo');
	admin = await mk('a11y-admin', 'Rebeca Dorrío');
	await db.insert(staffRoles).values([
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' }
	]);
	const startsAt = localDateTimeToUtc('2026-11-24', '18:00');
	const [row] = await db
		.insert(bookings)
		.values({
			municipalityId: fx.municipalityId,
			facilityId: fx.facilityId,
			profileId: fx.profileId,
			seats: 1,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3600_000),
			accessCode: '482193',
			priceCents: 300,
			channel: 'online',
			createdByUserId: fx.userId
		})
		.returning();
	bookingId = row.id;
	// Un día pechado con motivo (tarefa 7): a tira e as horas din «Pechada», non completo.
	await db.insert(closures).values({
		facilityId: fx.facilityId,
		startsAt: localDateTimeToUtc('2026-11-28', '00:00'),
		endsAt: localDateTimeToUtc('2026-11-29', '00:00'),
		reason: 'Mantemento do céspede'
	});
});

const ev = (user: SessionUser | null, path: string, params: Record<string, string> = {}) =>
	makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila', ...params },
		url: `http://localhost/ribadavila${path}`
	});

type LayoutData = {
	municipality: { slug: string; name: string; primaryColor: string; hasLogo: boolean };
	user: { initial: string; displayName: string } | null;
	locale: 'gl' | 'es';
};

const raw = (html: string) => createRawSnippet(() => ({ render: () => `<div>${html}</div>` }));

/**
 * La página dentro de los layouts reales de su zona, anidados como en la aplicación: primero el de
 * la zona del personal si lo hay y luego el de `[slug]` (cabecera, barras y salto incluidos).
 */
async function inLayout(
	Inner: unknown | null,
	Page: unknown,
	layoutLoads: unknown[],
	user: SessionUser | null,
	path: string,
	params: Record<string, string>,
	load: unknown,
	form?: object
): Promise<string> {
	mockPage.url = new URL(`http://localhost/ribadavila${path}`);
	const layout = await call<Promise<LayoutData>>(loadSlugLayout, ev(user, path, params));
	let data: object = layout;
	for (const l of layoutLoads)
		data = { ...data, ...(await call<Promise<object>>(l, ev(user, path, params))) };
	const own = await call<Promise<object>>(load, ev(user, path, params));
	let html = render(Page as never, {
		props: { data: { ...data, ...own }, form, params: {} } as never
	}).body;
	if (Inner) html = render(Inner as never, { props: { data, children: raw(html) } as never }).body;
	return render(SlugLayout, { props: { data: layout, children: raw(html) } as never }).body;
}

const resident = (
	Page: unknown,
	user: SessionUser | null,
	path: string,
	params: Record<string, string>,
	load: unknown,
	form?: object
) => inLayout(null, Page, [], user, path, params, load, form);

const cons = (Page: unknown, path: string, load: unknown, form?: object) =>
	inLayout(ConsLayout, Page, [loadConsLayout], conserxe, path, {}, load, form);

const adm = (
	Page: unknown,
	path: string,
	params: Record<string, string>,
	load: unknown,
	form?: object
) => inLayout(AdminLayout, Page, [loadAdminLayout], admin, path, params, load, form);

/** Estado do asistente co modelo de pádel (o que devolve o paso 0 ao seguinte). */
const padelValues = {
	modelo: 'padel',
	aplicado: 'padel',
	mascota: 'padel',
	nome: 'Pádel cuberto',
	lugar: 'Pistas',
	enderezo: '',
	modo: 'unit',
	unidades: '2',
	aforo: '1',
	minutos: '90',
	prezoRes: '4',
	prezoNon: '7',
	prezoSocial: '2',
	'h-0-0-opens': '09:00',
	'h-0-0-closes': '13:30'
};
const asis = (paso: number, errors: Record<string, string> = {}) =>
	adm(AsistentePage, '/admin/instalacions/asistente', {}, loadAsistente, {
		paso,
		values: padelValues,
		errors
	});

/** A benvida vai fóra de `[slug]`: só o layout raíz (sen cabeceira nin barra). */
async function benvida(query: string, form?: object): Promise<string> {
	const event = makeEvent({ db, now: NOW, user: vecina, url: `http://localhost/benvida${query}` });
	const data = await call<Promise<object>>(loadBenvida, event);
	return render(BenvidaPage as never, {
		props: { data: { locale: 'gl', ...data }, form, params: {} } as never
	}).body;
}

/** A portada /demo dentro do layout raíz en modo demo (coa faixa). */
async function demo(locale: 'gl' | 'es'): Promise<string> {
	mockPage.url = new URL('http://localhost/demo');
	const data = {
		locale,
		demo: true,
		home: {
			slug: 'viana-do-bolo',
			name: 'Viana do Bolo',
			primaryColor: '#1AA6C8',
			hasLogo: false,
			logoVersion: 0
		},
		profiles: DEMO_PROFILES.map((p) => ({
			key: p.key,
			name: p.identity.displayName,
			municipality: p.municipality?.name ?? null,
			avatarKey: p.avatarKey
		}))
	};
	const page = render(DemoPage as never, { props: { data, params: {} } as never }).body;
	return render(RootLayout as never, {
		props: { data: { locale, demo: true }, children: raw(page), params: {} } as never
	}).body;
}

type Case = { name: string; html: () => Promise<string> };
const slotUrl = () =>
	`?facility=${fx.facilityId}&startsAt=${localDateTimeToUtc('2026-11-24', '19:00').toISOString()}`;

const cases: Case[] = [
	{ name: 'portada da demo', html: () => demo('gl') },
	{ name: 'portada da demo (es)', html: () => demo('es') },
	{
		name: 'inicio',
		html: () => resident(InicioPage, vecina, '', {}, loadInicio)
	},
	{
		name: 'inicio sen sesión',
		html: () => resident(InicioPage, null, '', {}, loadInicio)
	},
	{
		name: 'día e hora',
		html: () => resident(DiaPage, vecina, `/reservar/${fx.typeId}`, { typeId: fx.typeId }, loadDia)
	},
	{
		name: 'día e hora cun día pechado',
		html: () =>
			resident(
				DiaPage,
				vecina,
				`/reservar/${fx.typeId}?date=2026-11-28`,
				{ typeId: fx.typeId },
				loadDia
			)
	},
	{
		name: 'libre',
		html: () =>
			resident(
				LibrePage,
				vecina,
				`/reservar/${fx.typeId}/libre?date=2026-11-24&time=19:00`,
				{ typeId: fx.typeId },
				loadLibre
			)
	},
	{
		name: 'confirmar',
		html: () => resident(ConfirmarPage, vecina, `/confirmar${slotUrl()}`, {}, loadConfirmar)
	},
	{
		name: 'confirmar con aviso de fallo',
		html: () =>
			resident(ConfirmarPage, vecina, `/confirmar${slotUrl()}`, {}, loadConfirmar, {
				error: 'SLOT_TAKEN'
			})
	},
	{
		name: 'reservas',
		html: () => resident(ReservasPage, vecina, '/reservas', {}, loadReservas)
	},
	{
		name: 'reservas en calendario cun día escollido',
		html: () =>
			resident(
				ReservasPage,
				vecina,
				'/reservas?vista=calendario&mes=2026-11&dia=2026-11-24',
				{},
				loadReservas
			)
	},
	{
		name: 'reservas en calendario cun día libre',
		html: () =>
			resident(
				ReservasPage,
				vecina,
				'/reservas?vista=calendario&mes=2026-11&dia=2026-11-26',
				{},
				loadReservas
			)
	},
	{
		name: 'historial',
		html: () => resident(HistorialPage, vecina, '/eu/historial', {}, loadHistorial)
	},
	{
		name: 'historial filtrado',
		html: () =>
			resident(HistorialPage, vecina, '/eu/historial?mes=2026-11&estado=proxima', {}, loadHistorial)
	},
	{
		name: 'avisos',
		html: () => resident(AvisosPage, vecina, '/avisos', {}, loadAvisos)
	},
	{
		name: 'avisos sen sesión',
		html: () => resident(AvisosPage, null, '/avisos', {}, loadAvisos)
	},
	{
		name: 'detalle da reserva',
		html: () =>
			resident(DetallePage, vecina, `/reserva/${bookingId}`, { id: bookingId }, loadDetalle)
	},
	{
		name: 'reserva feita (chaveiro)',
		html: () => resident(XaPage, vecina, `/reserva/${bookingId}/xa`, { id: bookingId }, loadXa)
	},
	{
		name: 'Eu',
		html: () => resident(EuPage, vecina, '/eu', {}, loadEu)
	},
	{
		name: 'Eu sen sesión',
		html: () => resident(EuPage, null, '/eu', {}, loadEu)
	},
	{
		name: 'Eu: os meus concellos',
		html: () => resident(ConcellosPage, vecina, '/eu/concellos', {}, loadConcellos)
	},
	{
		name: 'Eu: o meu perfil (persoas)',
		html: () => resident(PerfilPage, vecina, '/eu/perfil', {}, loadPerfil)
	},
	{
		name: 'Eu: o meu perfil (foto, cun erro)',
		html: () =>
			resident(PerfilPage, vecina, '/eu/perfil?tab=foto', {}, loadPerfil, {
				foto: 'PHOTO_TOO_LARGE'
			})
	},
	{
		name: 'Eu: avisos',
		html: () => resident(AvisosPrefsPage, vecina, '/eu/avisos', {}, loadAvisosPrefs)
	},
	{
		name: 'Eu: avisos con erros',
		html: () =>
			resident(AvisosPrefsPage, vecina, '/eu/avisos', {}, loadAvisosPrefs, {
				issues: { email: true, consentimento: true },
				values: { avisos: 'correo', email: 'x' }
			})
	},
	{ name: 'benvida paso 1', html: () => benvida('?paso=1') },
	{
		name: 'benvida paso 1 sen concello',
		html: () => benvida('?paso=1', { erro: 'NINGUN' })
	},
	{ name: 'benvida paso 2', html: () => benvida('?paso=2') },
	{ name: 'benvida paso 2 (deportes)', html: () => benvida('?paso=2&tab=deportes') },
	{
		name: 'benvida paso 2 (foto, cun erro)',
		html: () => benvida('?paso=2&tab=foto', { foto: 'UNSUPPORTED_IMAGE' })
	},
	{ name: 'benvida paso 3', html: () => benvida('?paso=3') },
	{
		name: 'benvida paso 3 con erros',
		html: () =>
			benvida('?paso=3', {
				issues: { email: true, consentimento: true },
				values: { avisos: 'correo', email: 'x' }
			})
	},
	{
		name: 'conserxería agenda',
		html: () => cons(AgendaPage, '/conserxeria', loadAgenda)
	},
	{
		name: 'conserxería agenda: hoxe, filtrada e coa tarxeta aberta',
		html: () =>
			cons(
				AgendaPage,
				`/conserxeria?dia=2026-11-24&inst=${fx.facilityId}&reserva=${bookingId}`,
				loadAgenda
			)
	},
	{
		name: 'conserxería agenda: outro día',
		html: () => cons(AgendaPage, '/conserxeria?dia=2026-11-25', loadAgenda)
	},
	{
		name: 'conserxería agenda: semana',
		html: () => cons(AgendaPage, '/conserxeria?vista=semana', loadAgenda)
	},
	{
		name: 'conserxería folla do día',
		html: () => cons(FollaPage, '/conserxeria/folla', loadFolla)
	},
	{
		name: 'conserxería validar',
		html: () => cons(ValidarPage, '/conserxeria/validar', async () => ({}))
	},
	{
		name: 'conserxería validar con coincidencia',
		html: () =>
			cons(ValidarPage, '/conserxeria/validar', async () => ({}), {
				codigo: '4821',
				matches: [
					{
						bookingId,
						facilityName: 'Pista 1',
						personName: 'Nerea Veciña',
						startsAt: localDateTimeToUtc('2026-11-24', '18:00'),
						endsAt: localDateTimeToUtc('2026-11-24', '19:00'),
						status: 'confirmed',
						today: true
					}
				]
			})
	},
	{
		name: 'conserxería nova',
		html: () => cons(NovaPage, '/conserxeria/nova', loadNova)
	},
	{
		name: 'admin resumo',
		html: () => adm(ResumoPage, '/admin', {}, loadResumo)
	},
	{
		name: 'admin instalación (editar)',
		html: () =>
			adm(EditPage, `/admin/instalacions/${fx.facilityId}`, { id: fx.facilityId }, loadEdit)
	},
	{
		name: 'admin asistente paso 0 (modelos)',
		html: () => adm(AsistentePage, '/admin/instalacions/asistente', {}, loadAsistente)
	},
	{ name: 'admin asistente paso 1 (con erros)', html: () => asis(1, { nome: 'nome' }) },
	{ name: 'admin asistente paso 2', html: () => asis(2) },
	{ name: 'admin asistente paso 3', html: () => asis(3, { unidades: 'unidades' }) },
	{ name: 'admin asistente paso 4 (horario)', html: () => asis(4, { 'h-1': 'orde' }) },
	{ name: 'admin asistente paso 5 (prezos)', html: () => asis(5) },
	{ name: 'admin asistente paso 6 (revisar)', html: () => asis(6) },
	{
		name: 'admin horarios (táboa)',
		html: () => adm(HorariosPage, '/admin/horarios', {}, loadHorarios)
	},
	{
		name: 'admin avisos (compositor e lista)',
		html: () => adm(AvisosAdminPage, '/admin/avisos', {}, loadAvisosAdmin)
	},
	{
		name: 'admin avisos (con erro)',
		html: () =>
			adm(AvisosAdminPage, '/admin/avisos', {}, loadAvisosAdmin, {
				error: 'INVALID',
				values: { title: '', body: 'x', from: '2026-10-22', to: '' }
			})
	},
	{
		name: 'admin tempadas',
		html: () => adm(TemporadasPage, '/admin/temporadas', {}, loadTemporadas)
	},
	{
		name: 'admin tempadas (pisa reservas)',
		html: () =>
			adm(TemporadasPage, '/admin/temporadas', {}, loadTemporadas, {
				error: 'CONFLICTS',
				conflicts: [
					{
						id: 'b1',
						facilityId: fx.facilityId,
						unitIndex: null,
						date: '2026-11-26',
						start: '19:00',
						end: '20:00'
					}
				],
				total: 1,
				weekdays: [3],
				values: { entityName: 'Escola', lugar: fx.facilityId, startsTime: '19:00' }
			})
	},
	{
		name: 'admin tempadas (pisa outra tempada)',
		html: () =>
			adm(TemporadasPage, '/admin/temporadas', {}, loadTemporadas, {
				error: 'SEASON_OVERLAP',
				overlaps: [
					{
						id: 's1',
						facilityId: fx.facilityId,
						unitIndex: null,
						entityName: 'CD',
						weekday: 1,
						startsTime: '19:00',
						endsTime: '20:00',
						fromDate: '2026-10-01',
						toDate: '2027-06-30'
					}
				],
				weekdays: [1],
				values: { entityName: 'Escola', lugar: fx.facilityId }
			})
	},
	{
		name: 'admin instalación (peche sobre reservas: avisar ou cancelar)',
		html: () =>
			adm(EditPage, `/admin/instalacions/${fx.facilityId}`, { id: fx.facilityId }, loadEdit, {
				error: 'INVALID',
				affected: 2,
				accion: 'peche',
				cancelReasonError: true,
				values: { from: '2026-12-01', to: '2026-12-02', reason: 'Obras', cancelar: '1' }
			})
	},
	{
		name: 'admin horarios (editando unha fila)',
		html: () => adm(HorariosPage, `/admin/horarios?editar=${fx.facilityId}`, {}, loadHorarios)
	}
];

describe('accesibilidade das páxinas (SSR)', () => {
	for (const c of cases)
		it(c.name, async () => {
			const problems = audit(await c.html());
			expect(problems, `${c.name}:\n${problems.join('\n')}`).toEqual([]);
		});
});

describe('salto ao contido', () => {
	it('cada zona ten un salto cara a #contido que apunta a un destino real', async () => {
		expect(render(SkipLink, { props: { locale: 'gl' } }).body).toContain('href="#contido"');
		const zones = {
			vecindad: await resident(InicioPage, vecina, '', {}, loadInicio),
			conserxeria: await cons(AgendaPage, '/conserxeria', loadAgenda),
			admin: await adm(ResumoPage, '/admin', {}, loadResumo)
		};
		for (const [zone, html] of Object.entries(zones)) {
			expect(html, `${zone}: sen salto`).toContain('href="#contido"');
			expect(html, `${zone}: sen destino`).toMatch(/id="contido"/);
			// O salto é o primeiro que se alcanza co teclado.
			expect(html.indexOf('href="#contido"'), `${zone}: o salto non vai primeiro`).toBeLessThan(
				html.search(/<(a|button)\b(?![^>]*href="#contido")/)
			);
		}
	});
});

describe('idioma do documento', () => {
	it('app.html leva %lang% e o hook cámbiao por gl ou es', () => {
		const app = readFileSync('src/app.html', 'utf8');
		expect(app).toContain('<html lang="%lang%">');
		const hook = readFileSync('src/hooks.server.ts', 'utf8');
		expect(hook).toContain("html.replace('%lang%', locale)");
		for (const lang of ['gl', 'es'])
			expect(app.replace('%lang%', lang)).toContain(`<html lang="${lang}">`);
	});
});
