<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';

	let {
		slug,
		current,
		locale,
		unread = 0
	}: {
		slug: string;
		/** Ruta actual (solo el path). */
		current: string;
		locale: Locale;
		/** Avisos sin leer de la persona: el globo de «Avisos». */
		unread?: number;
	} = $props();

	let nav: HTMLElement;

	// Con el texto ampliado las etiquetas pasan a dos líneas y la barra crece: su alto real se
	// publica en `--nav-alto` para que el hueco del contenido y los botones fijos lo respeten.
	$effect(() => {
		const root = document.documentElement;
		const observer = new ResizeObserver(() =>
			root.style.setProperty('--nav-alto', `${nav.offsetHeight}px`)
		);
		observer.observe(nav);
		return () => {
			observer.disconnect();
			root.style.removeProperty('--nav-alto');
		};
	});

	const base = $derived(`/${slug}`);
	// Detalle, cambiar y cancelar cuelgan de «As miñas reservas»; «Xa é túa!» sigue en Reservar.
	const isOwnBooking = $derived(current.startsWith(`${base}/reserva/`) && !current.endsWith('/xa'));
	// Reservar cubre el inicio y todo el flujo de reserva; los otros dos tienen su prefijo.
	const active = $derived(
		current.startsWith(`${base}/reservas`) || isOwnBooking
			? 'reservas'
			: current.startsWith(`${base}/avisos`)
				? 'avisos'
				: current.startsWith(`${base}/eu`)
					? 'eu'
					: 'reservar'
	);
	const unreadText = $derived(
		unread > 0
			? t(locale, unread === 1 ? 'nav.avisos.sen_ler.un' : 'nav.avisos.sen_ler.varios', {
					n: unread
				})
			: ''
	);
</script>

<nav class="nav2" bind:this={nav} aria-label={t(locale, 'nav.etiqueta')}>
	<a href={base} aria-current={active === 'reservar' ? 'page' : undefined}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<rect
				x="3"
				y="5"
				width="18"
				height="16"
				rx="3"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
			/>
			<line
				x1="8"
				y1="3"
				x2="8"
				y2="7"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
			<line
				x1="16"
				y1="3"
				x2="16"
				y2="7"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
			<path
				d="M12 10 v7 M8.5 13.5 h7"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
		</svg>
		{t(locale, 'nav.reservar')}
	</a>
	<a href="{base}/reservas" aria-current={active === 'reservas' ? 'page' : undefined}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M6 3 h12 a2 2 0 0 1 2 2 v8 a8 8 0 0 1 -16 0 v-8 a2 2 0 0 1 2 -2z"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
			/>
			<circle cx="12" cy="7.5" r="2" fill="currentColor" />
		</svg>
		{t(locale, 'nav.reservas')}
	</a>
	<a href="{base}/avisos" aria-current={active === 'avisos' ? 'page' : undefined}>
		<span class="ico">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 3 a6 6 0 0 1 6 6 v4 l2 4 h-16 l2 -4 v-4 a6 6 0 0 1 6 -6z"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linejoin="round"
				/>
				<path
					d="M9.5 20.5 a2.8 2.8 0 0 0 5 0"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
			</svg>
			{#if unread > 0}
				<span class="globo" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
			{/if}
		</span>
		{t(locale, 'nav.avisos')}
		{#if unread > 0}<span class="so-lector">{unreadText}</span>{/if}
	</a>
	<a href="{base}/eu" aria-current={active === 'eu' ? 'page' : undefined}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<circle cx="12" cy="8" r="4.2" fill="none" stroke="currentColor" stroke-width="2.4" />
			<path
				d="M4 21 a8 7 0 0 1 16 0"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
		</svg>
		{t(locale, 'nav.eu')}
	</a>
</nav>

<style>
	.nav2 {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		display: flex;
		justify-content: center;
		border-top: 2px solid var(--ceo);
		background: var(--branco);
		padding-bottom: env(safe-area-inset-bottom);
	}

	a {
		flex: 1;
		max-width: 214px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 56px;
		padding: 6px 4px;
		font-size: 12px;
		font-weight: 800;
		text-align: center;
		text-decoration: none;
		color: var(--gris);
	}

	a[aria-current='page'] {
		color: var(--txt);
		box-shadow: inset 0 3px 0 var(--concello);
	}

	svg {
		width: 24px;
		height: 24px;
	}

	.ico {
		position: relative;
		display: inline-flex;
	}

	/* Globo con el número: el aviso va en el nombre accesible, no en el dibujo. */
	.globo {
		position: absolute;
		top: -6px;
		right: -12px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--perigo);
		color: #fff;
		font-size: 11px;
		font-weight: 900;
		line-height: 18px;
		text-align: center;
	}

	.so-lector {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
