<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import AppHeader from '#lib/ui/AppHeader.svelte';
	import BottomNav from '#lib/ui/BottomNav.svelte';
	import SkipLink from '#lib/ui/SkipLink.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const slug = $derived(data.municipality.slug);
	const zone = $derived(page.url.pathname.slice(slug.length + 2).split('/')[0]);
	// Conserxería y administración (tareas 9 y 11) tienen su propio armazón; «entrar» va a pantalla
	// completa. Solo el resto de la vecindad lleva cabecera y barra inferior.
	const staff = $derived(zone === 'conserxeria' || zone === 'admin');
	const bare = $derived(staff || zone === 'entrar');

	// Al entrar con una cuenta distinta, elimina cualquier copia personal de la sesión anterior.
	onMount(() => {
		if (!data.user || !navigator.serviceWorker?.controller) return;
		const key = 'reservas-pwa-user';
		if (sessionStorage.getItem(key) !== data.user.id) {
			navigator.serviceWorker.controller.postMessage({ type: 'clear-personal-pages' });
			sessionStorage.setItem(key, data.user.id);
		}
	});
</script>

<svelte:head>
	<title>{data.municipality.name}</title>
</svelte:head>

<div class="app" style:--concello={data.municipality.primaryColor}>
	<!-- El armazón del personal trae su propio salto y su propio <main id="contido">. -->
	{#if !staff}
		<SkipLink locale={data.locale} />
	{/if}
	{#if !bare}
		<AppHeader
			municipality={data.municipality}
			user={data.user}
			locale={data.locale}
			roles={data.roles}
			municipalities={data.followed}
			current={page.url.pathname + page.url.search}
		/>
	{/if}
	<!-- Cada página trae su propio <main>; este contenedor es el destino del salto. -->
	<div id={staff ? undefined : 'contido'} class="cuerpo" class:estreito={!bare} class:con-nav={!bare}>
		{@render children()}
	</div>
	{#if !bare}
		<BottomNav {slug} current={page.url.pathname} locale={data.locale} unread={data.unread} />
	{/if}
</div>

<style>
	/* Solo la vecindad es una columna estrecha; el personal usa todo el ancho. */
	.estreito {
		max-width: 640px;
		margin: 0 auto;
	}

	/* Hueco para la barra inferior fija */
	.con-nav {
		padding-bottom: var(--nav-alto, calc(72px + env(safe-area-inset-bottom)));
	}
</style>
