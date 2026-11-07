<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { localeFromCookie, t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';

	const locale = $derived(localeFromCookie(page.data.locale));
	const kind = $derived(page.status === 404 ? '404' : page.status === 403 ? '403' : 'xeral');
	const title = $derived(t(locale, `erro.${kind}.titulo` as MessageKey));
	const home = $derived(page.params.slug ? `/${page.params.slug}` : '/');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="erro">
	<Mascot kind="sala" mood="triste" size={120} />
	<h1>{title}</h1>
	<p>{t(locale, `erro.${kind}.texto` as MessageKey)}</p>
	<div class="volver">
		<Button href={home}>{t(locale, 'erro.inicio')}</Button>
	</div>
</main>

<style>
	.erro {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		max-width: 420px;
		margin: 0 auto;
		padding: 64px 16px;
		text-align: center;
	}

	h1 {
		font-size: 28px;
	}

	p {
		font-size: 17px;
		color: var(--texto-suave);
	}

	.volver {
		width: 100%;
		margin-top: 8px;
	}
</style>
