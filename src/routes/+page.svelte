<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { logoUrl } from '#lib/logo-url.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.filter((w) => /^\p{L}/u.test(w) && w.length > 2)
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('') || name.slice(0, 1).toUpperCase();
</script>

<svelte:head>
	<title>{t(data.locale, 'inicio.titulo')}</title>
</svelte:head>

<main class="raiz">
	<h1>{t(data.locale, 'inicio.titulo')}</h1>
	<ul>
		{#each data.municipalities as m (m.slug)}
			<li>
				<a href="/{m.slug}" style:--concello={m.primaryColor}>
					{#if m.hasLogo}
						<img
							src={logoUrl(m.slug, m.logoVersion)}
							alt={t(data.locale, 'inicio.escudo', { nome: m.name })}
							width="40"
							height="48"
						/>
					{:else}
						<span class="iniciais" aria-hidden="true">{initials(m.name)}</span>
					{/if}
					<span class="nome">{m.name}<small>{m.province}</small></span>
				</a>
			</li>
		{/each}
	</ul>
	{#if data.isDeputacion}
		<p class="dep"><a href="/deputacion">{t(data.locale, 'inicio.deputacion')}</a></p>
	{/if}
</main>

<style>
	.raiz {
		max-width: 480px;
		margin: 0 auto;
		padding: 32px 16px;
	}

	h1 {
		font-size: 28px;
		margin-bottom: 20px;
	}

	ul {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 64px;
		padding: 10px 14px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		text-decoration: none;
		font-weight: 800;
		font-size: 18px;
	}

	img {
		width: 40px;
		height: 48px;
		object-fit: contain;
	}

	.iniciais {
		display: grid;
		place-items: center;
		width: 40px;
		height: 48px;
		border-radius: 8px;
		background: var(--concello);
		color: var(--branco);
		font-weight: 900;
	}

	.nome {
		display: flex;
		flex-direction: column;
	}

	.dep {
		margin: 20px 0 0;
		font-size: 14px;
		font-weight: 800;
	}

	.dep a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		min-width: var(--toque);
		padding: 0;
		border: 0;
		border-radius: 0;
		font-size: inherit;
		text-decoration: underline;
	}

	small {
		font-size: 14px;
		font-weight: 400;
		color: var(--texto-suave);
	}
</style>
