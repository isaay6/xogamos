// SPDX-License-Identifier: EUPL-1.2
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DayStrip from './DayStrip.svelte';
import Fob from './Fob.svelte';
import HourGrid from './HourGrid.svelte';
import Lamps from './Lamps.svelte';
import { AVATARS, avatarLabel } from '../avatars';
import { MASCOTS } from '../mascots';
import Avatar from './Avatar.svelte';
import Mascot from './Mascot.svelte';
import StaffShell from './StaffShell.svelte';
import SymbolSheet from './test-fixtures/SymbolSheet.svelte';
import TwoAvatars from './test-fixtures/TwoAvatars.svelte';

describe('componentes', () => {
	it('HourGrid: unha hora chea é un input disabled con etiqueta «19:00, completa»', () => {
		const { body } = render(HourGrid, {
			props: {
				name: 'hora',
				selected: null,
				hours: [
					{ time: '18:00', free: true, remainingSeats: null },
					{ time: '19:00', free: false, remainingSeats: null }
				]
			}
		});
		const full = body.match(/<input[^>]*value="19:00"[^>]*>/)?.[0] ?? '';
		expect(full).toMatch(/\sdisabled/);
		expect(full).toMatch(/type="radio"/);
		expect(full).toContain('aria-label="19:00, completa"');
		expect(body).toMatch(/class="[^"]*\boc\b/);
		const free = body.match(/<input[^>]*value="18:00"[^>]*>/)?.[0] ?? '';
		expect(free).not.toMatch(/\sdisabled/);
	});

	it('HourGrid: marca a hora elixida', () => {
		const { body } = render(HourGrid, {
			props: {
				name: 'hora',
				selected: '18:00',
				hours: [{ time: '18:00', free: true, remainingSeats: 3 }]
			}
		});
		expect(body.match(/<input[^>]*value="18:00"[^>]*>/)?.[0]).toMatch(/\schecked/);
		expect(body).toContain('3 libres');
	});

	it('Fob mostra o código en dous grupos', () => {
		const { body } = render(Fob, {
			props: { code: '482193', color: '#F2762E', title: 'Pádel', subtitle: 'Pista 1 · 19:00' }
		});
		expect(body).toContain('482 193');
		expect(body).toContain('Pádel');
	});

	it('Mascot cun tipo descoñecido pinta a sala', () => {
		const { body } = render(Mascot, { props: { kind: 'desconocido' } });
		expect(body).toContain('href="#d-sala"');
		expect(body).toContain('aria-hidden="true"');
	});

	it('Mascot coñecido usa o seu símbolo', () => {
		const { body } = render(Mascot, { props: { kind: 'padel', mood: 'triste' } });
		expect(body).toContain('href="#d-padel"');
		expect(body).toMatch(/class="[^"]*\btriste\b/);
	});

	it('a folla de símbolos ten un d-{clave} por cada personaxe do catálogo', () => {
		const { body } = render(SymbolSheet);
		for (const key of MASCOTS) expect(body, key).toContain(`<symbol id="d-${key}"`);
	});

	it('a folla nova (Instalacións) debuxa cada personaxe sen cara: a cara vai en cada <Mascot>', () => {
		const { body } = render(SymbolSheet);
		for (const key of MASCOTS) {
			const symbol = new RegExp(`<symbol id="d-${key}"[\\s\\S]*?</symbol>`).exec(body)?.[0] ?? '';
			expect(symbol, key).not.toBe('');
			expect(symbol, key).not.toContain('href="#F"');
		}
	});

	it('Mascot: a 28 px é neutro e a 120 px leva cara', () => {
		const small = render(Mascot, { props: { kind: 'padel', size: 28 } }).body;
		expect(small).toContain('href="#d-padel"');
		expect(small).not.toContain('class="face"');
		const big = render(Mascot, { props: { kind: 'padel', size: 120 } }).body;
		expect(big).toMatch(/<g class="face"[^>]*><use href="#F"/);
	});

	it('Mascot: a prop face manda sobre o tamaño', () => {
		expect(render(Mascot, { props: { kind: 'tenis', size: 28, face: true } }).body).toContain(
			'class="face"'
		);
		expect(render(Mascot, { props: { kind: 'tenis', size: 120, face: false } }).body).not.toContain(
			'class="face"'
		);
	});

	it('Avatar: cada debuxo do catálogo pinta cun nome accesible', () => {
		for (const key of AVATARS) {
			const { body } = render(Avatar, {
				props: { avatar: { key, hasPhoto: false }, userId: 'u-1', name: 'Nerea', locale: 'gl' }
			});
			const svg = body.match(/<svg[^>]*>/)?.[0] ?? '';
			expect(svg, key).toContain('role="img"');
			expect(svg, key).toContain(`aria-label="Nerea: ${avatarLabel(key, 'gl')}"`);
			expect(body, key).not.toContain('<img');
		}
	});

	it('Avatar: con foto pinta un <img> co texto alternativo', () => {
		const { body } = render(Avatar, {
			props: {
				avatar: { key: 'muller-lentes', hasPhoto: true },
				userId: 'u-1',
				name: 'Nerea',
				locale: 'es'
			}
		});
		const img = body.match(/<img[^>]*>/)?.[0] ?? '';
		expect(img).toContain('src="/api/v1/users/u-1/avatar"');
		expect(img).toContain('alt="Foto de Nerea"');
	});

	it('Avatar: sen foto nin debuxo coñecido pinta a inicial', () => {
		for (const key of [null, 'non-existe']) {
			const { body } = render(Avatar, {
				props: { avatar: { key, hasPhoto: false }, userId: 'u-1', name: 'nerea', locale: 'gl' }
			});
			expect(body).toMatch(
				/role="img"[^>]*aria-label="Nerea"|aria-label="nerea"[^>]*role="img"|role="img"[^>]*aria-label="nerea"/
			);
			expect(body).toMatch(/>N<\/span>/);
		}
	});

	it('Avatar: dous debuxos na mesma páxina non repiten ids', () => {
		const { body } = render(TwoAvatars);
		const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(2);
	});

	it('DayStrip: o número dun día completo usa --texto-suave (contraste 4.5:1)', async () => {
		const { readFileSync } = await import('node:fs');
		const src = readFileSync(new URL('./DayStrip.svelte', import.meta.url), 'utf8');
		const rule = /\.day\.full b \{([^}]*)\}/.exec(src)?.[1] ?? '';
		expect(rule).toContain('color: var(--texto-suave)');
		expect(rule).toContain('line-through');
	});

	it('Lamps limita lit a 4', () => {
		const { body } = render(Lamps, { props: { lit: 7 } });
		expect(body.match(/<i class="on\b/g)).toHaveLength(4);
		const none = render(Lamps, { props: { lit: -2 } }).body;
		expect(none.match(/<i/g)).toHaveLength(4);
		expect(none).not.toMatch(/<i class="on\b/);
	});

	it('DayStrip mostra día da semana e número, e marca os completos', () => {
		const { body } = render(DayStrip, {
			props: {
				locale: 'gl',
				selected: '2026-10-22',
				days: [
					{ date: '2026-10-22', full: false },
					{ date: '2026-10-23', full: true }
				]
			}
		});
		expect(body).toContain('Xov');
		expect(body).toContain('Ven');
		expect(body.match(/<input[^>]*value="2026-10-22"[^>]*>/)?.[0]).toMatch(/\schecked/);
		expect(body).toContain('completo');
	});

	it('StaffShell: menú, páxina actual, formulario de saída e contido', () => {
		const { body } = render(StaffShell, {
			props: {
				menu: [
					{ href: '/conserxeria', label: 'Axenda de hoxe', icon: 'agenda' },
					{ href: '/conserxeria/validar', label: 'Validar código', icon: 'validar' }
				],
				current: '/conserxeria/validar',
				userName: 'Telmo Novo',
				municipality: {
					slug: 'ribadavila',
					name: 'Concello de Ribadávila',
					hasLogo: false,
					logoVersion: 0
				},
				locale: 'gl',
				children: createRawSnippet(() => ({ render: () => '<p>contido</p>' }))
			}
		});
		expect(body).toContain('Axenda de hoxe');
		const current = body.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
		expect(current).toHaveLength(1);
		expect(current[0]).toContain('href="/conserxeria/validar"');
		expect(body).toMatch(/<form[^>]*method="POST"[^>]*action="\/auth\/logout"/);
		expect(body).toContain('Saír');
		expect(body).toContain('Telmo Novo');
		expect(body).toContain('href="#escudo"');
		expect(body).toMatch(/aria-expanded="false"/);
		// Sin JS el panel llega desplegado: nada lo marca como plegado.
		expect(body.match(/<div[^>]*id="staff-nav"[^>]*>/)?.[0]).not.toContain('collapsed');
		expect(body).not.toMatch(/class="shell[^"]*\bjs\b/);
		expect(body).toContain('<p>contido</p>');
	});

	describe('StaffShell: elemento actual e idioma', () => {
		const shell = (current: string, menu: { href: string; label: string; icon: string }[]) =>
			render(StaffShell, {
				props: {
					menu,
					current,
					userName: 'Telmo Novo',
					municipality: { slug: 'ribadavila', name: 'Ribadávila', hasLogo: false, logoVersion: 0 },
					locale: 'gl',
					children: createRawSnippet(() => ({ render: () => '<p>x</p>' }))
				}
			}).body;
		const currentOf = (body: string) =>
			(body.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? []).map(
				(a) => a.match(/href="([^"]*)"/)?.[1]
			);

		it('marca o href máis longo que é prefixo nun límite de segmento', () => {
			const admin = [
				{ href: '/r/admin', label: 'Resumo', icon: 'resumo' },
				{ href: '/r/admin/instalacions', label: 'Instalacións', icon: 'instalacions' },
				{ href: '/r/admin/instalacions-x', label: 'Outra', icon: 'normas' }
			];
			expect(currentOf(shell('/r/admin/instalacions/abc-123', admin))).toEqual([
				'/r/admin/instalacions'
			]);
			expect(currentOf(shell('/r/admin', admin))).toEqual(['/r/admin']);
			expect(currentOf(shell('/r/admin/instalacions-x', admin))).toEqual([
				'/r/admin/instalacions-x'
			]);
			const cons = [
				{ href: '/r/conserxeria', label: 'Axenda', icon: 'agenda' },
				{ href: '/r/conserxeria/nova', label: 'Nova reserva', icon: 'nova' }
			];
			expect(currentOf(shell('/r/conserxeria/nova/u-1/xustificante', cons))).toEqual([
				'/r/conserxeria/nova'
			]);
		});

		it('ten o selector de idioma, que volve á páxina actual', () => {
			const body = shell('/r/conserxeria/nova', [
				{ href: '/r/conserxeria', label: 'Axenda', icon: 'agenda' }
			]);
			expect(body).toMatch(/<form[^>]*method="POST"[^>]*action="\/ribadavila\/idioma"/);
			expect(body).toMatch(/name="redirectTo"[^>]*value="\/r\/conserxeria\/nova"/);
			expect(body).toMatch(/name="lingua"[^>]*value="gl"/);
			expect(body).toMatch(/name="lingua"[^>]*value="es"/);
		});
	});
});
