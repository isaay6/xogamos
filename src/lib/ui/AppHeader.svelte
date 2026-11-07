<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';
	import AvatarBadge from './AvatarBadge.svelte';
	import Escudo from './Escudo.svelte';

	let {
		municipality,
		user,
		locale,
		current,
		roles = [],
		municipalities = []
	}: {
		municipality: {
			slug: string;
			name: string;
			primaryColor: string;
			hasLogo: boolean;
			logoVersion: number;
		};
		user: {
			id: string;
			initial: string;
			displayName: string;
			avatar?: { key: string | null; hasPhoto: boolean };
		} | null;
		locale: Locale;
		/** Ruta actual (con consulta): «Entrar» vuelve aquí después. */
		current: string;
		/** Roles de personal en este concello: dan un acceso discreto a su zona (solo pantallas anchas). */
		roles?: ('admin' | 'conserxe' | 'apertura')[];
		/** Só os concellos que a persoa escolleu: son os únicos do selector. */
		municipalities?: {
			slug: string;
			name: string;
			primaryColor: string;
			hasLogo: boolean;
			logoVersion: number;
		}[];
	} = $props();

	const staff = $derived(
		roles.includes('admin')
			? { href: `/${municipality.slug}/admin`, key: 'cabeceira.admin' as const }
			: roles.includes('conserxe')
				? { href: `/${municipality.slug}/conserxeria`, key: 'cabeceira.conserxeria' as const }
				: roles.includes('apertura')
					? { href: `/${municipality.slug}/conserxeria`, key: 'cabeceira.apertura' as const }
					: null
	);
</script>

<header class="top">
	{#if user && municipalities.length > 0}
		<details class="concello">
			<summary class="esc">
				<Escudo {municipality} />
				<span>{municipality.name}</span>
			</summary>
			<nav aria-label={t(locale, 'cabeceira.concellos')}>
				{#each municipalities as choice (choice.slug)}
					<a
						href="/{choice.slug}"
						aria-current={choice.slug === municipality.slug ? 'page' : undefined}
					>
						<Escudo municipality={choice} width={28} />
						{choice.name}
					</a>
				{/each}
			</nav>
		</details>
	{:else}
		<a class="esc" href="/{municipality.slug}">
			<Escudo {municipality} />
			<span>{municipality.name}</span>
		</a>
	{/if}
	{#if user}
		{#if staff}
			<a class="persoal" href={staff.href}>{t(locale, staff.key)}</a>
		{/if}
		<a
			class="av"
			href="/{municipality.slug}/eu"
			aria-label={t(locale, 'cabeceira.perfil', { nome: user.displayName })}
			><AvatarBadge {user} /></a
		>
	{:else}
		<a class="entrar" href="/{municipality.slug}/entrar?redirectTo={encodeURIComponent(current)}"
			>{t(locale, 'cabeceira.entrar')}</a
		>
	{/if}
</header>

<style>
	.top {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		max-width: 640px;
		margin: 0 auto;
		padding: 8px 12px 0;
	}

	.esc {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		font-size: 15px;
		font-weight: 800;
		text-decoration: none;
	}

	.concello {
		position: relative;
	}

	.concello summary {
		list-style: none;
		cursor: pointer;
	}
	.concello summary::-webkit-details-marker {
		display: none;
	}

	.concello nav {
		position: absolute;
		z-index: 2;
		top: calc(100% + 4px);
		left: 0;
		display: grid;
		min-width: min(280px, calc(100vw - 24px));
		padding: 6px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--fondo);
		box-shadow: 0 4px 12px rgb(23 32 42 / 20%);
	}

	.concello nav a {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		padding: 4px 8px;
		font-weight: 800;
		text-decoration: none;
	}

	.concello nav a[aria-current='page'] {
		background: var(--ceo);
	}

	/* Con el texto muy ampliado el nombre ocupa sitio, pero el escudo no se encoge. */
	.esc :global(svg),
	.esc :global(img) {
		flex: none;
	}

	/* O acceso do persoal tamén está dispoñible en móbil. */
	.persoal {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		margin-left: auto;
		font-size: 14px;
		font-weight: 800;
	}

	.entrar {
		display: grid;
		place-items: center;
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 16px;
		border: 2px solid var(--txt);
		border-radius: 22px;
		font-size: 15px;
		font-weight: 800;
		text-decoration: none;
	}

	/* Insignia de 32 px dentro dunha zona de toque de 44 px. */
	.av {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--toque);
		height: var(--toque);
		border-radius: 50%;
		text-decoration: none;
	}
</style>
