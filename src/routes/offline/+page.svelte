<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let reservationUrl = $state<string | null>(null);

	onMount(async () => {
		const names = await caches.keys();
		for (const name of names.filter((value) => value.startsWith('reservas-persoais-'))) {
			const requests = await (await caches.open(name)).keys();
			const saved = requests.find((request) =>
				/\/[^/]+\/reservas(?:\/|$)/.test(new URL(request.url).pathname)
			);
			if (saved) {
				reservationUrl = new URL(saved.url).pathname + new URL(saved.url).search;
				break;
			}
		}
	});
</script>

<svelte:head><title>{t(data.locale, 'vec.pwa.offline.titulo')}</title></svelte:head>

<main class="offline">
	<h1>{t(data.locale, 'vec.pwa.offline.titulo')}</h1>
	<p>{t(data.locale, 'vec.pwa.offline.texto')}</p>
	{#if reservationUrl}
		<a href={reservationUrl}>{t(data.locale, 'vec.pwa.offline.reservas')}</a>
	{/if}
</main>

<style>
	.offline { max-width: 640px; margin: 0 auto; padding: 48px 16px; }
	h1 { font-size: 30px; }
	a { color: var(--txt); font-weight: 800; }
</style>
