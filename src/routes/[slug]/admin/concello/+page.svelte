<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import { logoUrl } from '#lib/logo-url.js';
	import { contrastRatio } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let color = $derived(data.settings.primaryColor);
	const ratio = $derived(contrastRatio('#FFFFFF', color));
	const lowContrast = $derived(ratio !== null && ratio < 4.5);
	const validHex = $derived(/^#[0-9a-fA-F]{6}$/.test(color));
	const escudo = $derived(logoUrl(data.municipality.slug, data.logoVersion));
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.concello.titulo')} · {data.municipality.name}</title>
</svelte:head>

<p class="k">{t(data.locale, 'adm.concello.k')}</p>
<h1>{t(data.locale, 'adm.concello.titulo')}</h1>

<section class="escudo" data-tour="concello">
	<h2>{t(data.locale, 'adm.concello.escudo')}</h2>
	{#if data.hasLogo}
		<img
			src={escudo}
			alt={t(data.locale, 'adm.concello.escudo_actual', { nome: data.settings.name })}
			width="72"
			height="86"
		/>
	{:else}
		<p class="axuda">{t(data.locale, 'adm.concello.escudo_sen')}</p>
	{/if}
	{#if form?.logoSaved}
		<p class="ok" role="status">{t(data.locale, 'adm.concello.escudo_ok')}</p>
	{:else if form?.error === 'LOGO_INVALID'}
		<p class="erro" role="alert">{t(data.locale, 'adm.erro.escudo')}</p>
	{/if}
	<form method="POST" action="?/escudo" enctype="multipart/form-data">
		<label class="file">
			{t(data.locale, 'adm.concello.cambiar')}
			<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
		</label>
		<Button type="submit" variant="out">{t(data.locale, 'adm.gardar')}</Button>
	</form>
	<p class="axuda">{t(data.locale, 'adm.concello.escudo_axuda')}</p>
</section>

<form method="POST" action="?/gardar" class="datos">
	{#if form?.saved}
		<p class="ok" role="status">{t(data.locale, 'adm.gardado')}</p>
	{:else if form?.error === 'INVALID'}
		<p class="erro" role="alert">{t(data.locale, 'adm.erro.INVALID')}</p>
	{/if}

	<div class="campo">
		<label for="name">{t(data.locale, 'adm.concello.nome')}</label>
		<input id="name" name="name" required maxlength="200" value={data.settings.name} />
	</div>

	<div class="campo">
		<label for="color">{t(data.locale, 'adm.concello.cor')}</label>
		<div class="cor">
			<input
				id="color"
				type="color"
				value={validHex ? color : '#000000'}
				oninput={(e) => (color = e.currentTarget.value)}
			/>
			<input
				name="primaryColor"
				aria-label={t(data.locale, 'adm.concello.cor_hex')}
				pattern="#[0-9a-fA-F]{'{6}'}"
				maxlength="7"
				required
				bind:value={color}
			/>
		</div>
		{#if lowContrast && ratio !== null}
			<p class="aviso-cor" role="alert">
				{t(data.locale, 'adm.concello.aviso_cor', { ratio: ratio.toFixed(1).replace('.', ',') })}
			</p>
		{/if}
	</div>

	<h2>{t(data.locale, 'adm.concello.legais')}</h2>
	<div class="campo">
		<label for="legalNotice">{t(data.locale, 'adm.concello.aviso_legal')}</label>
		<textarea id="legalNotice" name="legalNotice" rows="6" maxlength="20000"
			>{data.settings.legalNotice}</textarea
		>
	</div>
	<div class="campo">
		<label for="privacyPolicy">{t(data.locale, 'adm.concello.privacidade')}</label>
		<textarea id="privacyPolicy" name="privacyPolicy" rows="6" maxlength="20000"
			>{data.settings.privacyPolicy}</textarea
		>
	</div>
	<div class="campo">
		<label for="usageRules">{t(data.locale, 'adm.concello.normas_uso')}</label>
		<textarea id="usageRules" name="usageRules" rows="6" maxlength="20000"
			>{data.settings.usageRules}</textarea
		>
	</div>

	<Button type="submit">{t(data.locale, 'adm.gardar')}</Button>
</form>

<style>
	h1 {
		margin: 0 0 16px;
		font-size: 28px;
		font-weight: 900;
	}

	h2 {
		margin: 8px 0 0;
		font-size: 20px;
		font-weight: 900;
	}

	.k {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--gris);
	}

	.escudo,
	.datos {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
		max-width: 620px;
		margin-bottom: 24px;
	}

	.escudo img {
		object-fit: contain;
	}

	.escudo form > *,
	.escudo input[type='file'] {
		min-width: 0;
		max-width: 100%;
	}

	.escudo form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.axuda {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-weight: 800;
	}

	input:not([type='file']):not([type='color']),
	textarea {
		padding: 10px 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 600;
	}

	input:not([type='file']):not([type='color']) {
		min-height: var(--toque);
		padding-block: 0;
	}

	.cor {
		display: flex;
		gap: 8px;
	}

	.cor input[type='color'] {
		width: var(--toque);
		height: var(--toque);
		padding: 2px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
	}

	.cor input:not([type='color']) {
		max-width: 140px;
		font-family: monospace;
	}

	.aviso-cor,
	.erro {
		margin: 0;
		color: var(--perigo);
		font-weight: 800;
	}

	.ok {
		margin: 0;
		font-weight: 800;
	}
</style>
