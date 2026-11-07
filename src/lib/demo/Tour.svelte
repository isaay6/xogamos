<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!--
	Percorrido guiado do modo demo: un anel arredor do elemento (`data-tour`) cunha tarxeta ao
	lado; en pantallas estreitas, unha folla abaixo ou arriba. O estado vive en sessionStorage
	(recargar mantén o paso) e entra polo URL (`?tour=vecina&paso=3`) desde a portada /demo.
-->
<script lang="ts">
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { t, type Locale } from '../i18n';
	import {
		TOURS,
		isTourKey,
		matchesStep,
		stepHref,
		tourForPath,
		type TourKey,
		type TourStep
	} from './tour';

	let { locale }: { locale: Locale } = $props();

	type Saved = {
		tour: TourKey;
		/** Índice do paso, desde 0. */
		paso: number;
		/** Concello dos percorridos de concello. */
		slug: string | null;
		/** URL á que se chegou en cada paso (para volver «Atrás» ás rutas con parámetros). */
		urls: Record<string, string>;
		fin: boolean;
	};

	const KEY = 'demo-percorrido';
	const LAST = 'demo-percorrido-ultimo';

	function read(): Saved | null {
		try {
			const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
			if (!raw || !isTourKey(raw.tour) || !Number.isInteger(raw.paso)) return null;
			if (raw.paso < 0 || raw.paso >= TOURS[raw.tour as TourKey].steps.length) return null;
			return {
				tour: raw.tour,
				paso: raw.paso,
				slug: typeof raw.slug === 'string' ? raw.slug : null,
				urls: raw.urls && typeof raw.urls === 'object' ? raw.urls : {},
				fin: raw.fin === true
			};
		} catch {
			return null;
		}
	}

	function write(s: Saved | null) {
		try {
			if (s) {
				sessionStorage.setItem(KEY, JSON.stringify(s));
				sessionStorage.setItem(LAST, s.tour);
			} else sessionStorage.removeItem(KEY);
		} catch {
			// Sen almacenamento (navegación privada…): o percorrido segue, pero non sobrevive a recargar.
		}
	}

	function lastTour(): TourKey | null {
		try {
			const v = sessionStorage.getItem(LAST);
			return isTourKey(v) ? v : null;
		} catch {
			return null;
		}
	}

	let cur = $state<Saved | null>(null);
	let loaded = false;
	/** Rectángulo do elemento resaltado (coordenadas da xanela) ou `null`: tarxeta centrada. */
	let rect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
	let target: Element | null = null;
	let card = $state<HTMLElement>();
	let cw = $state(0);
	let ch = $state(0);
	let vw = $state(1280);
	let vh = $state(800);

	const steps = $derived(cur ? TOURS[cur.tour].steps : []);
	const step = $derived<TourStep | null>(cur && !cur.fin ? steps[cur.paso] : null);
	const open = $derived(cur !== null);
	const narrow = $derived(vw < 640);

	const slugOf = (pathname: string) => pathname.split('/')[1] || null;
	const reduced = () => {
		try {
			return matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch {
			return true;
		}
	};

	/** O primeiro elemento visible con ese `data-tour` (os do menú pregado non contan). */
	function find(name: string): Element | null {
		for (const el of document.querySelectorAll(`[data-tour="${CSS.escape(name)}"]`)) {
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) return el;
		}
		return null;
	}

	function measure() {
		if (!target || !target.isConnected) {
			rect = null;
			return;
		}
		const r = target.getBoundingClientRect();
		rect = { top: r.top, left: r.left, width: r.width, height: r.height };
	}

	let frame = 0;
	function remeasure() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(measure);
	}

	/** Pinta o paso actual na pantalla actual: busca o elemento (con algún reintento) e enfoca a tarxeta. */
	async function show() {
		target = null;
		rect = null;
		if (!cur) return;
		if (step && matchesStep(cur.tour, step, cur.slug, page.url.pathname)) {
			cur.urls[String(cur.paso)] = page.url.pathname + page.url.search;
			write(cur);
			const want = step.target;
			for (let i = 0; i < 10 && !target; i++) {
				await tick();
				target = find(want);
				if (!target) await new Promise((r) => setTimeout(r, 80));
				if (!cur || step?.target !== want) return;
			}
			if (target) {
				target.scrollIntoView({
					block: narrow ? 'start' : 'center',
					inline: 'nearest',
					behavior: reduced() ? 'auto' : 'smooth'
				});
				measure();
			}
		}
		await tick();
		card?.focus({ preventScroll: true });
	}

	/** Href da primeira ligazón do elemento `via` (prefírense os deportes con horas libres). */
	function viaHref(via: string | undefined): string | null {
		if (!via) return null;
		const el = find(via);
		if (!el) return null;
		const a = el.matches('a[href]')
			? el
			: (el.querySelector('li:not(.off) a[href]') ?? el.querySelector('a[href]'));
		return a?.getAttribute('href') ?? null;
	}

	async function go(i: number) {
		if (!cur) return;
		if (i < 0) return;
		if (i >= steps.length) {
			cur.fin = true;
			write(cur);
			return show();
		}
		const prev = cur.paso;
		const nextStep = steps[i];
		const known = cur.urls[String(i)];
		const href =
			(known && i < prev ? known : null) ??
			stepHref(cur.tour, nextStep, cur.slug) ??
			known ??
			viaHref(nextStep.via);
		cur.paso = i;
		cur.fin = false;
		write(cur);
		if (matchesStep(cur.tour, nextStep, cur.slug, page.url.pathname) || !href) return show();
		await goto(href);
	}

	function skip() {
		cur = null;
		target = null;
		rect = null;
		write(null);
	}

	/** «Percorrido guiado» e «Repetir o percorrido»: desde o primeiro paso. */
	export function restart() {
		const tour = cur?.tour ?? lastTour() ?? tourForPath(page.url.pathname);
		const slug =
			cur?.slug ?? (TOURS[tour].scope === 'concello' ? slugOf(page.url.pathname) : null);
		cur = { tour, paso: 0, slug, urls: {}, fin: false };
		go(0);
	}

	afterNavigate(({ type }) => {
		if (!loaded) {
			loaded = true;
			cur = read();
		} else if (cur?.fin && type !== 'enter') {
			// A tarxeta final queda só na pantalla onde se rematou.
			skip();
		}
		// Na portada da demo non hai percorrido: escóllese outro perfil.
		if (page.url.pathname === '/demo') {
			if (cur) skip();
			return;
		}
		// Entrada desde /demo: `?tour=vecina` (e opcionalmente `&paso=3`, contando desde 1).
		const url = page.url;
		const asked = url.searchParams.get('tour');
		if (isTourKey(asked)) {
			const n = Number(url.searchParams.get('paso') ?? '1');
			const max = TOURS[asked].steps.length;
			const paso = Number.isInteger(n) && n >= 1 && n <= max ? n - 1 : 0;
			cur = {
				tour: asked,
				paso,
				slug: TOURS[asked].scope === 'concello' ? slugOf(url.pathname) : null,
				urls: {},
				fin: false
			};
			write(cur);
			const clean = new URL(url.href);
			clean.searchParams.delete('tour');
			clean.searchParams.delete('paso');
			try {
				replaceState(clean, page.state);
			} catch {
				// Se o router aínda non está listo, o parámetro queda no URL: non pasa nada.
			}
		}
		show();
	});

	// Calquera desprazamento (a xanela ou un contedor) move o elemento: o anel ségueo.
	$effect(() => {
		if (!open) return;
		const opts = { capture: true, passive: true };
		window.addEventListener('scroll', remeasure, opts);
		window.addEventListener('scrollend', remeasure, opts);
		return () => {
			window.removeEventListener('scroll', remeasure, opts);
			window.removeEventListener('scrollend', remeasure, opts);
		};
	});

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			e.preventDefault();
			skip();
		}
	}

	// Anel: o elemento con marxe, recortado á xanela.
	const ring = $derived.by(() => {
		if (!rect) return null;
		const P = 6;
		const top = Math.max(rect.top - P, 2);
		const left = Math.max(rect.left - P, 2);
		const bottom = Math.min(rect.top + rect.height + P, vh - 2);
		const right = Math.min(rect.left + rect.width + P, vw - 2);
		if (bottom <= top || right <= left) return null;
		return { top, left, width: right - left, height: bottom - top };
	});

	// Posición da tarxeta: debaixo do elemento se cabe, se non enriba, e sempre dentro da xanela.
	const M = 12;
	const GAP = 14;
	const pos = $derived.by(() => {
		// Mentres o elemento está fóra da xanela (desprazándose), a tarxeta queda no centro.
		if (!rect || !ring || narrow || !cw || !ch) return null;
		const below = rect.top + rect.height + GAP;
		const above = rect.top - GAP - ch;
		const clampLeft = (x: number) => Math.min(Math.max(x, M), Math.max(M, vw - cw - M));
		const clampTop = (y: number) => Math.min(Math.max(y, M), Math.max(M, vh - ch - M));
		if (below + ch <= vh - M) return { top: clampTop(below), left: clampLeft(rect.left) };
		if (above >= M) return { top: clampTop(above), left: clampLeft(rect.left) };
		// Elemento moi alto: ao lado se hai sitio; se non, abaixo á dereita, por riba del.
		const right = rect.left + rect.width + GAP;
		if (right + cw <= vw - M) return { top: clampTop(rect.top), left: right };
		if (rect.left - GAP - cw >= M) return { top: clampTop(rect.top), left: rect.left - GAP - cw };
		return { top: clampTop(vh - ch - M), left: clampLeft(vw - cw - M) };
	});
	// Folla en móbil: abaixo, salvo que o elemento quede na metade de abaixo.
	const sheetTop = $derived(!!rect && narrow && rect.top + rect.height / 2 > vh / 2);
</script>

<svelte:window
	bind:innerWidth={vw}
	bind:innerHeight={vh}
	{onkeydown}
	onresize={remeasure}
/>

{#if open}
	<div class="tour">
		{#if ring}
			<div
				class="anel"
				style:top="{ring.top}px"
				style:left="{ring.left}px"
				style:width="{ring.width}px"
				style:height="{ring.height}px"
			></div>
		{:else}
			<div class="veo"></div>
		{/if}

		<div
			class="tarxeta"
			class:folla={narrow}
			class:arriba={sheetTop}
			class:centro={!pos && !narrow}
			style:top={pos ? `${pos.top}px` : undefined}
			style:left={pos ? `${pos.left}px` : undefined}
			role="dialog"
			aria-labelledby="tour-titulo"
			aria-describedby="tour-texto"
			tabindex="-1"
			bind:this={card}
			bind:offsetWidth={cw}
			bind:offsetHeight={ch}
		>
			{#if step && cur}
				<p class="k">
					{t(locale, 'demo.tour.paso', { n: cur.paso + 1, total: steps.length })}
				</p>
				<h2 id="tour-titulo">{t(locale, step.title)}</h2>
				<p id="tour-texto">{t(locale, step.body)}</p>
				<div class="botons">
					<button type="button" class="saltar" onclick={skip}>{t(locale, 'demo.tour.saltar')}</button>
					<span class="sp"></span>
					{#if cur.paso > 0}
						<button type="button" class="out" onclick={() => go(cur!.paso - 1)}
							>{t(locale, 'demo.tour.atras')}</button
						>
					{/if}
					<button type="button" class="seg" onclick={() => go(cur!.paso + 1)}
						>{t(
							locale,
							cur.paso === steps.length - 1 ? 'demo.tour.rematar' : 'demo.tour.seguinte'
						)}</button
					>
				</div>
			{:else}
				<h2 id="tour-titulo">{t(locale, 'demo.tour.fin.titulo')}</h2>
				<p id="tour-texto">{t(locale, 'demo.tour.fin.texto')}</p>
				<div class="botons fin">
					<button type="button" class="seg" onclick={restart}>{t(locale, 'demo.tour.repetir')}</button>
					<a class="out" href="/demo" onclick={skip}>{t(locale, 'demo.tour.volver')}</a>
					<button type="button" class="saltar" onclick={skip}>{t(locale, 'demo.tour.pechar')}</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.tour {
		position: fixed;
		inset: 0;
		z-index: 1000;
		pointer-events: none;
	}

	/* Escurece todo agás o oco do anel: a sombra enorme fai de veo con recorte. */
	.anel {
		position: fixed;
		border-radius: 12px;
		outline: 3px solid var(--foco);
		outline-offset: 0;
		box-shadow:
			0 0 0 6px var(--txt),
			0 0 0 200vmax rgb(23 32 42 / 0.5);
	}

	.veo {
		position: fixed;
		inset: 0;
		background: rgb(23 32 42 / 0.5);
	}

	.tarxeta {
		position: fixed;
		width: min(360px, calc(100vw - 24px));
		padding: 18px 18px 14px;
		border-radius: 16px;
		background: var(--branco);
		color: var(--txt);
		box-shadow: 0 12px 32px rgb(23 32 42 / 0.28);
		pointer-events: auto;
	}

	.tarxeta:focus {
		outline: none;
	}

	.tarxeta:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.centro {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	/* Móbil: folla de abaixo a abaixo (ou arriba se o elemento queda abaixo). */
	.folla {
		top: auto;
		right: 8px;
		bottom: calc(8px + env(safe-area-inset-bottom));
		left: 8px;
		width: auto;
		max-height: 60vh;
		overflow: auto;
	}

	.folla.arriba {
		top: 8px;
		bottom: auto;
	}

	.k {
		margin-bottom: 6px;
		color: var(--texto-suave);
		font-size: 13px;
		font-weight: 800;
	}

	h2 {
		font-size: 22px;
	}

	#tour-texto {
		margin-top: 8px;
		font-size: 16px;
	}

	.botons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 16px;
	}

	.sp {
		flex: 1;
	}

	button,
	a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 16px;
		border: 2px solid var(--txt);
		border-radius: 22px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
	}

	.seg {
		background: var(--txt);
		color: var(--branco);
	}

	.saltar {
		padding: 0 8px;
		border-color: transparent;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.fin {
		flex-direction: column;
		align-items: stretch;
	}

	button:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--foco);
		outline-offset: 2px;
		box-shadow: 0 0 0 5px var(--txt);
	}

	@media (prefers-reduced-motion: no-preference) {
		.anel {
			transition:
				top 0.25s ease,
				left 0.25s ease,
				width 0.25s ease,
				height 0.25s ease;
		}

		.tarxeta {
			animation: entra 0.2s ease;
		}

		@keyframes entra {
			from {
				opacity: 0;
			}
		}
	}

	@media print {
		.tour {
			display: none;
		}
	}
</style>
