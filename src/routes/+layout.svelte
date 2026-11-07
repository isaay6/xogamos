<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { dev } from '$app/env';
	import '@fontsource/gabarito/400.css';
	import '@fontsource/gabarito/600.css';
	import '@fontsource/gabarito/800.css';
	import '@fontsource/gabarito/900.css';
	import '#lib/ui/tokens.css';
	import '#lib/ui/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import DemoBanner from '#lib/demo/DemoBanner.svelte';
	import Tour from '#lib/demo/Tour.svelte';
	import { t } from '#lib/i18n/index.js';
	import { installPrompt, type InstallPromptEvent } from '#lib/pwa/install.js';
	import { mascotSymbols } from '#lib/ui/Mascot.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let tour = $state<ReturnType<typeof Tour>>();
	let online = $state(true);
	let formNeedsNetwork = $state(false);

	onMount(() => {
		online = navigator.onLine;
		const sync = () => (online = navigator.onLine);
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		const prompt = (event: Event) => {
			event.preventDefault();
			installPrompt.set(event as InstallPromptEvent);
		};
		const preventOfflineSubmit = (event: SubmitEvent) => {
			const form = event.target;
			if (online || !(form instanceof HTMLFormElement) || form.method.toLowerCase() === 'get') {
				return;
			}
			event.preventDefault();
			formNeedsNetwork = true;
		};
		window.addEventListener('beforeinstallprompt', prompt);
		window.addEventListener('submit', preventOfflineSubmit, true);
		if (!dev && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}
		return () => {
			window.removeEventListener('online', sync);
			window.removeEventListener('offline', sync);
			window.removeEventListener('beforeinstallprompt', prompt);
			window.removeEventListener('submit', preventOfflineSubmit, true);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Hoja única de símbolos de los personajes; cada <Mascot> la referencia con <use>. -->
{@render mascotSymbols()}

{#if !online}
	<div class="sen-rede" role="status">
		<p>{t(data.locale, 'vec.pwa.banner')}</p>
		{#if formNeedsNetwork}<p>{t(data.locale, 'vec.eu.sen_rede_form')}</p>{/if}
	</div>
{/if}

{#if data.demo}
	<!-- Modo demo: la faixa va arriba a la vista, pero detrás en el DOM (el salto al contenido sigue
	     siendo lo primero con el teclado). El percorrido se monta una sola vez. -->
	<div class="modo-demo">
		<div>{@render children()}</div>
		<DemoBanner
			locale={data.locale}
			onDemo={page.url.pathname === '/demo'}
			onTour={() => tour?.restart()}
		/>
	</div>
	<Tour locale={data.locale} bind:this={tour} />
{:else}
	{@render children()}
{/if}

<style>
	.modo-demo {
		display: flex;
		flex-direction: column;
	}

	.modo-demo > :global(.faixa) {
		order: -1;
	}

	.sen-rede {
		position: sticky;
		top: 0;
		z-index: 20;
		padding: 8px 16px;
		background: var(--foco);
		color: var(--txt);
		font-size: 14px;
		font-weight: 800;
		text-align: center;
	}

	.sen-rede p { margin: 0; }
	.sen-rede p + p { margin-top: 3px; }
</style>
