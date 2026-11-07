<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const title = $derived(t(locale, `vec.legal.${data.doc}` as MessageKey));
</script>

<svelte:head>
	<title>{title} · {data.municipality.name}</title>
</svelte:head>

<main class="legal">
	<a class="volver" href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{title}</h1>
	{#if data.text}
		<!-- Texto plano del concello: se pinta escapado, con los saltos de línea del original. -->
		<p class="texto">{data.text}</p>
	{:else}
		<p class="baleiro">{t(locale, 'vec.legal.baleiro')}</p>
	{/if}
</main>

<style>
	.legal {
		padding: 12px 16px 24px;
	}

	.volver {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: inherit;
	}

	h1 {
		margin-bottom: 8px;
		font-size: 28px;
	}

	.texto {
		margin: 0;
		line-height: 1.5;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.baleiro {
		font-weight: 600;
	}
</style>
