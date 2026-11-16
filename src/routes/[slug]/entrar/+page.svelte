<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const back = $derived(encodeURIComponent(data.redirectTo));
</script>

<svelte:head>
	<title>{t(data.locale, 'entrar.titulo')}</title>
</svelte:head>

<main class="entrar">
	<Escudo municipality={data.municipality} width={64} />
	<h1>{t(data.locale, 'entrar.titulo')}</h1>
	<p>{t(data.locale, 'entrar.texto')}</p>
	<div class="botons">
		{#if data.enabledProviders.includes('clave')}
			<Button href="/auth/clave/start?redirectTo={back}">{t(data.locale, 'entrar.clave')}</Button>
		{/if}
		{#if data.enabledProviders.includes('chave365')}
			<Button variant="out" href="/auth/chave365/start?redirectTo={back}"
				>{t(data.locale, 'entrar.chave365')}</Button
			>
		{/if}
		<!-- «Agora non» vai sempre á portada: o destino pode requirir sesión e volvería aquí. -->
		<a class="agora" href="/{data.municipality.slug}">{t(data.locale, 'entrar.agora_non')}</a>
	</div>
</main>

<style>
	.entrar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 420px;
		margin: 0 auto;
		padding: 56px 16px 32px;
		text-align: center;
	}

	h1 {
		font-size: 30px;
		margin-top: 6px;
	}

	p {
		font-size: 17px;
		color: var(--texto-suave);
	}

	.botons {
		display: grid;
		gap: 10px;
		width: 100%;
		margin-top: 16px;
	}

	.agora {
		display: grid;
		place-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: var(--texto-suave);
	}
</style>
