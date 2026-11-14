// SPDX-License-Identifier: EUPL-1.2
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Auditoría automática WCAG 2.1 A e AA (axe-core) das pantallas dos catro papeis, en escritorio
// e a 320 px. Falla se axe atopa calquera incidencia ou se a páxina se despraza en horizontal.

const SLUG = 'viana-do-bolo';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Papel = 'publico' | 'vecina' | 'conserxe' | 'concello' | 'deputacion';

/** Entra coa conta de demostración do papel (formulario de /demo, sen JavaScript necesario). */
async function entrar(page: Page, papel: Papel) {
	if (papel === 'publico') return;
	await page.goto('/demo');
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/demo')),
		page.locator(`form[action="?/${papel}"] button`).first().click()
	]);
}

/** Primeira ligazón da páxina cuxo destino casa co patrón (para rutas con identificadores). */
async function primeiraLigazon(page: Page, desde: string, patron: RegExp): Promise<string | null> {
	await page.goto(desde);
	const hrefs = await page
		.locator('a[href]')
		.evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
	return hrefs.find((h) => patron.test(h)) ?? null;
}

async function auditar(page: Page, ruta: string) {
	const res = await page.goto(ruta);
	expect(res?.status(), `${ruta} responde`).toBeLessThan(400);
	await page.waitForLoadState('networkidle');
	const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	const resumo = violations.map(
		(v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect.soft(resumo, `incidencias de axe en ${ruta}`).toEqual([]);
	const desborda = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
	);
	expect.soft(desborda, `desprazamento horizontal en ${ruta}`).toBe(false);
}

const PANTALLAS: Record<Papel, string[]> = {
	publico: ['/demo', `/${SLUG}`, `/${SLUG}/entrar`, `/${SLUG}/legal/privacidade`, '/offline'],
	vecina: [
		`/${SLUG}`,
		`/${SLUG}/reservas`,
		`/${SLUG}/reservar/facil`,
		`/${SLUG}/eu`,
		`/${SLUG}/eu/perfil`,
		`/${SLUG}/eu/historial`,
		`/${SLUG}/eu/monedero`,
		`/${SLUG}/eu/avisos`,
		`/${SLUG}/eu/datos`,
		`/${SLUG}/solicitudes`,
		`/${SLUG}/solicitudes/nova`,
		`/${SLUG}/torneos`
	],
	conserxe: [
		`/${SLUG}/conserxeria`,
		`/${SLUG}/conserxeria/validar`,
		`/${SLUG}/conserxeria/nova`,
		`/${SLUG}/conserxeria/persoa`,
		`/${SLUG}/conserxeria/folla`,
		`/${SLUG}/conserxeria/monedero`
	],
	concello: [
		`/${SLUG}/admin`,
		`/${SLUG}/admin/instalacions`,
		`/${SLUG}/admin/instalacions/nova`,
		`/${SLUG}/admin/horarios`,
		`/${SLUG}/admin/normas`,
		`/${SLUG}/admin/solicitudes`,
		`/${SLUG}/admin/temporadas`,
		`/${SLUG}/admin/entidades`,
		`/${SLUG}/admin/torneos`,
		`/${SLUG}/admin/abonos`,
		`/${SLUG}/admin/monedero`,
		`/${SLUG}/admin/avisos`,
		`/${SLUG}/admin/persoal`,
		`/${SLUG}/admin/informe`,
		`/${SLUG}/admin/exportar`,
		`/${SLUG}/admin/rexistro`,
		`/${SLUG}/admin/concello`
	],
	deputacion: [
		'/deputacion',
		'/deputacion/novo',
		'/deputacion/administradores',
		'/deputacion/rexistro'
	]
};

// Rutas con identificadores: búscanse na propia demo.
const DINAMICAS: Partial<Record<Papel, [string, RegExp][]>> = {
	vecina: [
		[`/${SLUG}`, new RegExp(`^/${SLUG}/reservar/[^/]+$`)],
		[`/${SLUG}/reservas`, new RegExp(`^/${SLUG}/reserva/[^/]+$`)],
		[`/${SLUG}/torneos`, new RegExp(`^/${SLUG}/torneos/[^/]+$`)]
	],
	concello: [
		[`/${SLUG}/admin/instalacions`, new RegExp(`^/${SLUG}/admin/instalacions/[0-9a-f-]{36}$`)]
	]
};

for (const ancho of [
	{ nome: 'escritorio', w: 1280, h: 800 },
	{ nome: '320 px', w: 320, h: 720 }
]) {
	test.describe(`axe WCAG 2.1 AA · ${ancho.nome}`, () => {
		test.use({ viewport: { width: ancho.w, height: ancho.h } });
		for (const papel of Object.keys(PANTALLAS) as Papel[]) {
			test(papel, async ({ page }) => {
				await entrar(page, papel);
				const rutas = [...PANTALLAS[papel]];
				for (const [desde, patron] of DINAMICAS[papel] ?? []) {
					const ruta = await primeiraLigazon(page, desde, patron);
					expect(ruta, `ligazón ${patron} desde ${desde}`).not.toBeNull();
					rutas.push(ruta!);
				}
				for (const ruta of rutas) await test.step(ruta, () => auditar(page, ruta));
			});
		}
	});
}
