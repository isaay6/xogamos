<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import AvatarPicker from '#lib/ui/AvatarPicker.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const f = $derived(
		(form ?? {}) as { avatarErro?: boolean; foto?: 'PHOTO_TOO_LARGE' | 'UNSUPPORTED_IMAGE' }
	);
</script>

<svelte:head>
	<title>{t(locale, 'vec.perfil.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="perfil">
	<a class="volver" href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{t(locale, 'vec.perfil.pregunta')}</h1>
	<section class="accesibilidade" id="accesibilidade" data-tour="perfil-accesibilidade">
		<h2>{t(locale, 'vec.eu.acc.titulo')}</h2>
		<form method="POST" action="?/accesibilidade">
			<label>
				{t(locale, 'vec.acc.texto')}
				<select name="textSize" value={data.accessibility.textSize}>
					<option value="normal">{t(locale, 'vec.acc.normal')}</option>
					<option value="large">{t(locale, 'vec.acc.grande')}</option>
					<option value="very_large">{t(locale, 'vec.acc.moi_grande')}</option>
				</select>
			</label>
			<label class="opcion">
				<input type="checkbox" name="highContrast" checked={data.accessibility.highContrast} />
				<span>
					{t(locale, 'vec.acc.contraste')}
					<small>{t(locale, 'vec.acc.contraste.axuda')}</small>
				</span>
			</label>
			<label>
				{t(locale, 'vec.acc.movemento')}
				<select name="reduceMotion" value={data.accessibility.reduceMotion}>
					<option value="system">{t(locale, 'vec.acc.sistema')}</option>
					<option value="always">{t(locale, 'vec.acc.reducir')}</option>
				</select>
			</label>
			<label class="opcion">
				<input type="checkbox" name="easyBooking" checked={data.accessibility.easyBooking} />
				<span>
					{t(locale, 'vec.acc.reserva_facil')}
					<small>{t(locale, 'vec.acc.reserva_facil.axuda')}</small>
				</span>
			</label>
			<button type="submit">{t(locale, 'vec.acc.gardar')}</button>
		</form>
	</section>

	{#if data.saved && !form}
		<p class="ok" role="status">{t(locale, 'vec.perfil.gardado')}</p>
	{/if}

	<AvatarPicker
		{locale}
		name={data.name}
		userId={data.userId}
		avatar={data.avatar}
		tab={data.tab}
		tabHref={(tab) => `${base}/eu/perfil?tab=${tab}`}
		query="&tab={data.tab}"
		avatarErro={f.avatarErro ?? false}
		fotoErro={f.foto ?? null}
	/>
</main>

<style>
	.perfil {
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
		margin-bottom: 14px;
		font-size: 28px;
	}

	.ok {
		margin: 0 0 12px;
		padding: 10px 12px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}
	.accesibilidade {
		margin: 0 0 20px;
		padding: 14px;
		background: var(--ceo);
		border-radius: var(--radio);
	}

	.accesibilidade h2 {
		margin-bottom: 10px;
		font-size: 21px;
	}

	.accesibilidade form {
		display: grid;
		gap: 10px;
	}

	.accesibilidade label {
		display: grid;
		gap: 4px;
		font-weight: 700;
	}

	/* Casillas: a caixa á esquerda e o texto ao lado, cunha liña que explica a opción */
	.accesibilidade label.opcion {
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: 12px;
		padding: 6px 0;
		cursor: pointer;
	}

	.opcion input {
		width: 24px;
		height: 24px;
		margin: 0;
		accent-color: var(--txt);
	}

	.opcion small {
		display: block;
		margin-top: 2px;
		color: var(--texto-suave);
		font-size: 14px;
		font-weight: 400;
	}

	.accesibilidade select {
		min-height: var(--toque);
	}

	.accesibilidade button {
		min-height: var(--toque);
		margin-top: 4px;
		border: 0;
		border-radius: 22px;
		background: var(--txt);
		color: var(--branco);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.accesibilidade button:focus-visible {
		outline: 3px solid var(--foco);
		outline-offset: 2px;
	}
</style>
