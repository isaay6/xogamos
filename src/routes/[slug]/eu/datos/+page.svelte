<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const email = $derived(form?.values?.email ?? data.email);
	const phone = $derived(form?.values?.phone ?? data.phone);
	const issues = $derived((form?.issues ?? {}) as { email?: true; phone?: true; other?: true });
</script>

<svelte:head>
	<title>{t(locale, 'vec.datos.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="datos">
	<a class="volver" href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{t(locale, 'vec.datos.titulo')}</h1>

	{#if data.saved && !form}
		<p class="ok" role="status">{t(locale, 'vec.datos.gardado')}</p>
	{/if}
	{#if issues.other}
		<p class="erro" role="alert">{t(locale, 'vec.datos.erro.OTRO')}</p>
	{/if}

	<dl class="fixos">
		<div>
			<dt>{t(locale, 'vec.datos.nome')}</dt>
			<dd>{data.displayName}</dd>
		</div>
		<div>
			<dt>{t(locale, 'vec.datos.proveedor')}</dt>
			<dd>{t(locale, `vec.datos.proveedor.${data.provider}` as MessageKey)}</dd>
		</div>
	</dl>

	<form method="POST" action="?/gardar" novalidate>
		<label>
			<span>{t(locale, 'vec.datos.correo')}</span>
			<input
				type="email"
				name="email"
				value={email}
				autocomplete="email"
				aria-invalid={issues.email ? 'true' : undefined}
				aria-describedby={issues.email ? 'erro-email' : undefined}
			/>
		</label>
		{#if issues.email}
			<p class="erro" id="erro-email">{t(locale, 'vec.datos.erro.email')}</p>
		{/if}

		<label>
			<span>{t(locale, 'vec.datos.telefono')}</span>
			<input
				type="tel"
				name="phone"
				value={phone}
				autocomplete="tel"
				aria-invalid={issues.phone ? 'true' : undefined}
				aria-describedby={issues.phone ? 'erro-phone' : undefined}
			/>
		</label>
		{#if issues.phone}
			<p class="erro" id="erro-phone">{t(locale, 'vec.datos.erro.phone')}</p>
		{/if}

		<Button type="submit">{t(locale, 'vec.datos.gardar')}</Button>
	</form>

	<section class="descarga" data-tour="descargar-datos" aria-labelledby="descarga-titulo">
		<h2 id="descarga-titulo">{t(locale, 'vec.datos.descarga.titulo')}</h2>
		<p>{t(locale, 'vec.datos.descarga.axuda')}</p>
		<div class="descarga-enlaces">
			<a href="{base}/eu/descargar-datos?formato=json" download
				>{t(locale, 'vec.datos.descarga.json')}</a
			>
			<a href="{base}/eu/descargar-datos" download>{t(locale, 'vec.datos.descarga.html')}</a>
		</div>
	</section>
	<section class="borrado" aria-labelledby="borrado-titulo">
		<h2 id="borrado-titulo">{t(locale, 'vec.datos.borrar.titulo')}</h2>
		<p>{t(locale, 'vec.datos.borrar.axuda')}</p>
		{#if form?.deleteError}<p class="erro" role="alert">
				{t(locale, `vec.datos.borrar.erro.${form.deleteError}` as MessageKey)}
			</p>{/if}
		<form method="POST" action="?/borrar">
			<label
				><span>{t(locale, 'vec.datos.borrar.confirmar')}</span><input
					name="confirmacion"
					required
					autocomplete="off"
				/></label
			>
			<Button type="submit" variant="perigo">{t(locale, 'vec.datos.borrar.enviar')}</Button>
		</form>
	</section>
</main>

<style>
	.datos {
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

	.fixos {
		display: grid;
		gap: 8px;
		margin: 12px 0 18px;
	}

	dt {
		font-size: 14px;
		font-weight: 800;
		color: var(--texto-suave);
	}

	dd {
		margin: 0;
		font-size: 18px;
		font-weight: 800;
	}

	form {
		display: grid;
		gap: 12px;
		max-width: 420px;
	}

	label {
		display: grid;
		gap: 4px;
		font-weight: 800;
	}

	input {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		font: inherit;
		font-weight: 600;
	}

	input[aria-invalid='true'] {
		border-color: var(--perigo);
	}

	.erro {
		margin: 0;
		font-weight: 800;
		color: var(--perigo);
	}

	.ok {
		margin: 8px 0;
		padding: 10px 12px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}

	.descarga {
		max-width: 620px;
		margin-top: 28px;
		padding: 14px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
	}
	.borrado {
		max-width: 620px;
		margin-top: 28px;
		padding: 14px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
	}
	.borrado h2,
	.borrado p {
		margin: 0;
	}
	.borrado p {
		margin-top: 6px;
	}

	.descarga h2,
	.descarga p {
		margin: 0;
	}

	.descarga p {
		margin-top: 6px;
	}

	.descarga-enlaces {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 12px;
	}

	.descarga-enlaces a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		color: inherit;
		font-weight: 800;
	}
</style>
