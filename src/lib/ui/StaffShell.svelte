<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { t, type Locale } from '#lib/i18n/index.js';
	import { logoUrl } from '#lib/logo-url.js';
	import SkipLink from './SkipLink.svelte';

	let {
		menu,
		current,
		userName,
		municipality,
		locale,
		children
	}: {
		menu: { href: string; label: string; icon: string; badge?: number }[];
		/** Ruta actual (sin consulta): marca el elemento de menú más específico y vuelve aquí al cambiar de idioma. */
		current: string;
		userName: string;
		/** Concello de la zona; sin él (zona de la deputación): título «Deputación», escudo genérico y enlaces sin concello. */
		municipality?: { slug: string; name: string; hasLogo: boolean; logoVersion: number };
		locale: Locale;
		children: Snippet;
	} = $props();

	// Activo: el `href` más largo que sea prefijo de la ruta en un límite de segmento.
	const active = $derived.by(() => {
		const path = current.replace(/\/+$/, '');
		let best: string | undefined;
		for (const item of menu) {
			const href = item.href.replace(/\/+$/, '');
			if (path === href || path.startsWith(`${href}/`)) {
				if (best === undefined || href.length > best.length) best = item.href;
			}
		}
		return best;
	});

	const title = $derived(municipality ? municipality.name : t(locale, 'staff.deputacion'));
	const home = $derived(municipality ? `/${municipality.slug}` : '/deputacion');
	const veciño = $derived(municipality ? `/${municipality.slug}` : '/');
	const idiomaAction = $derived(
		municipality ? `/${municipality.slug}/idioma` : '/deputacion/idioma'
	);
	const logoutTo = $derived(municipality ? `/${municipality.slug}` : '/');

	let open = $state(false);
	// Sin JavaScript el menú queda desplegado (render de servidor); solo con JS se pliega.
	let js = $state(false);
	onMount(() => (js = true));

	// Iconos pequeños, decorativos (viewBox 16×16, trazo `currentColor`).
	const ICONS: Record<string, string> = {
		agenda: 'M3 3h10v10H3zM3 6.5h10M6 1.5v3M10 1.5v3',
		nova: 'M8 3v10M3 8h10',
		validar: 'M3 8.5l3.2 3.2L13 4.8',
		persoa: 'M8 8a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 8 8zM3 13.5c.5-2.6 2.5-4 5-4s4.5 1.4 5 4',
		resumo: 'M3 13V8M8 13V3M13 13V6',
		instalacions: 'M2.5 13.5h11M4 13.5V5l4-2.5L12 5v8.5M7 13.5v-3h2v3',
		horarios: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 4.8V8l2.2 1.4',
		normas: 'M4 2.5h8v11H4zM6 6h4M6 8.5h4M6 11h2.5',
		temporadas: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3M5 9h2M9 9h2M5 11.2h2M9 11.2h2',
		avisos: 'M4 11V7.5a4 4 0 0 1 8 0V11l1.2 1.5H2.8zM6.6 14h2.8',
		persoal:
			'M6 7.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM2 13c.4-2.2 1.9-3.4 4-3.4s3.6 1.2 4 3.4M11 3.4a2.2 2.2 0 0 1 0 4.1M12 9.8c1.2.5 1.8 1.4 2 3.2',
		// Abono: un billete co corte á esquerda e unha liña de picado.
		abonos: 'M2 4.5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3zM10 4.5v7',
		concello: 'M2 6.5L8 2.5l6 4M3.5 6.5v6.5M7 6.5v6.5M9 6.5v6.5M12.5 6.5v6.5M2 13.5h12',
		exportar: 'M8 2.5v8M4.8 7.5L8 10.7l3.2-3.2M3 13.5h10',
		admin: 'M8 1.8l5 1.8v4c0 3-2 5.2-5 6.6-3-1.4-5-3.6-5-6.6v-4zM8 6v3.2',
		conserxeria: 'M2.5 11.5h11M4 11.5a4 4 0 0 1 8 0M8 5.5V4M7 4h2',
		rexistro: 'M4 2.5h8v11H4zM6 5h4M6 8h4M6 11h2M3 5h1M3 8h1M3 11h1'
	};
</script>

<div class="shell" class:js>
	<SkipLink {locale} />
	<aside class="side">
		<div class="top">
			<a class="who" href={home}>
				{#if municipality?.hasLogo}
					<img
						src={logoUrl(municipality.slug, municipality.logoVersion)}
						alt=""
						width="22"
						height="27"
					/>
				{:else}
					<svg width="22" height="27" aria-hidden="true"><use href="#escudo" /></svg>
				{/if}
				<span>{title}</span>
			</a>
			<button
				type="button"
				class="toggle"
				aria-expanded={open}
				aria-controls="staff-nav"
				onclick={() => (open = !open)}>{t(locale, 'staff.menu')}</button
			>
		</div>
		<div class="panel" class:collapsed={js && !open} id="staff-nav">
			<nav aria-label={t(locale, 'staff.navegacion')}>
				{#each menu as item (item.href)}
					<a href={item.href} aria-current={item.href === active ? 'page' : undefined}>
						<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
							{#if Object.hasOwn(ICONS, item.icon)}
								<path
									d={ICONS[item.icon]}
									fill="none"
									stroke="currentColor"
									stroke-width="1.6"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							{/if}
						</svg>
						<span>{item.label}</span>{#if item.badge}<small class="badge">{item.badge}</small>{/if}
					</a>
				{/each}
			</nav>
			<div class="foot">
				<a class="veciño" href={veciño}>{t(locale, 'staff.ver_vecino')}</a>
				<span class="user">{userName}</span>
				<form method="POST" action={idiomaAction} class="lingua">
					<input type="hidden" name="redirectTo" value={current} />
					<span>{t(locale, 'staff.idioma')}</span>
					<button type="submit" name="lingua" value="gl" lang="gl" aria-pressed={locale === 'gl'}
						>{t(locale, 'staff.idioma.gl')}</button
					>
					<button type="submit" name="lingua" value="es" lang="es" aria-pressed={locale === 'es'}
						>{t(locale, 'staff.idioma.es')}</button
					>
				</form>
				<form method="POST" action="/auth/logout">
					<input type="hidden" name="to" value={logoutTo} />
					<button type="submit" class="sair">{t(locale, 'staff.sair')}</button>
				</form>
			</div>
		</div>
	</aside>
	<main class="mn" id="contido">{@render children()}</main>
</div>

<style>
	.shell {
		display: flex;
		min-height: 100vh;
		background: var(--branco);
		color: var(--txt);
		font-family: var(--fonte);
	}

	.side {
		display: flex;
		flex: none;
		flex-direction: column;
		width: 220px;
		padding: 16px 12px;
		background: var(--txt);
		color: #cfd6d5;
		font-weight: 800;
	}

	.badge {
		margin-left: auto;
		min-width: 20px;
		padding: 2px 5px;
		border-radius: 12px;
		background: var(--foco);
		color: var(--txt);
		text-align: center;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 16px;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--branco);
		font-size: 14px;
		line-height: 1.15;
		text-decoration: none;
	}

	.toggle {
		display: none;
		min-height: var(--toque);
		padding: 0 16px;
		border: 2px solid #cfd6d5;
		border-radius: 22px;
		background: transparent;
		color: var(--branco);
		font: inherit;
		font-size: 14px;
	}

	.panel {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 10px;
		border-radius: 8px;
		color: inherit;
		font-size: 14px;
		text-decoration: none;
	}

	nav a:hover {
		background: rgb(255 255 255 / 0.1);
	}

	nav a[aria-current='page'] {
		background: var(--branco);
		color: var(--txt);
	}

	.foot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: auto;
		padding-top: 16px;
		font-size: 13px;
	}

	.user {
		color: #b9bfbe;
		font-weight: 600;
	}

	.veciño {
		display: flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--branco);
		text-decoration: underline;
	}

	.lingua {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		color: #b9bfbe;
		font-weight: 600;
	}

	.lingua button {
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 10px;
		border: 2px solid #cfd6d5;
		border-radius: 10px;
		background: transparent;
		color: var(--branco);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.lingua button[aria-pressed='true'] {
		background: var(--branco);
		color: var(--txt);
	}

	.sair {
		min-height: var(--toque);
		padding: 0 14px;
		border: 2px solid #cfd6d5;
		border-radius: 10px;
		background: transparent;
		color: var(--branco);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.mn {
		flex: 1;
		min-width: 0;
		padding: 20px 24px;
	}

	a:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--foco);
		outline-offset: 2px;
	}

	@media (max-width: 767px) {
		.shell {
			flex-direction: column;
		}

		.side {
			width: auto;
			padding: 8px 12px;
		}

		.top {
			margin-bottom: 0;
		}

		.js .toggle {
			display: block;
		}

		.panel {
			padding: 12px 0 8px;
		}

		.js .panel.collapsed {
			display: none;
		}

		nav a {
			min-height: var(--toque);
		}

		.mn {
			padding: 16px 12px;
		}
	}
</style>
