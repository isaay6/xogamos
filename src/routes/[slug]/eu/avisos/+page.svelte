<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import NoticePrefsFields from '#lib/ui/NoticePrefsFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const f = $derived(
		(form ?? {}) as {
			issues?: { email?: boolean; consentimento?: boolean };
			values?: { avisos?: 'app' | 'correo'; email?: string; consentimento?: boolean };
		}
	);
</script>

<svelte:head>
	<title>{t(locale, 'vec.prefs.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="prefs">
	<a class="volver" href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{t(locale, 'vec.prefs.titulo')}</h1>
	<p class="texto">{t(locale, 'vec.benvida.avisos.texto')}</p>

	{#if data.saved && !form}
		<p class="ok" role="status">{t(locale, 'vec.prefs.gardado')}</p>
	{/if}

	<form method="POST" use:enhance>
		<NoticePrefsFields
			{locale}
			avisos={f.values?.avisos ?? (data.notifyEmail ? 'correo' : 'app')}
			email={f.values?.email ?? data.email}
			consent={f.values ? (f.values.consentimento ?? false) : (data.notifyEmail ?? false)}
			issues={f.issues}
		/>
		<Button type="submit">{t(locale, 'vec.prefs.gardar')}</Button>
	</form>

	<a class="ver" href="{base}/avisos">{t(locale, 'vec.prefs.ver')}</a>
</main>

<style>
	.prefs {
		padding: 12px 16px 24px;
	}

	.volver,
	.ver {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: inherit;
	}

	.ver {
		margin-top: 12px;
	}

	h1 {
		font-size: 28px;
	}

	.texto {
		margin: 8px 0 14px;
		font-weight: 600;
		line-height: 1.35;
	}

	form {
		display: grid;
		gap: 14px;
		max-width: 480px;
	}

	.ok {
		margin: 0 0 12px;
		padding: 10px 12px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}
</style>
