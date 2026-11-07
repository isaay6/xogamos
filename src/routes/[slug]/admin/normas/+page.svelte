<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const selected = $derived(data.cancelMinutes / 60);
	// Un plazo guardado fuera de la lista se ofrece como opción elegida, con su valor.
	const custom = $derived(!data.hours.includes(selected));
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.normas.titulo')} · {data.municipality.name}</title>
</svelte:head>

<form method="POST">
	<header class="mh">
		<h1>{t(data.locale, 'adm.normas.titulo')}</h1>
		<Button type="submit">{t(data.locale, 'adm.gardar')}</Button>
	</header>
	<a href="/{data.municipality.slug}/admin/instalacions">{t(data.locale, 'adm.normas.prezos')}</a>

	{#if form?.saved}
		<p class="ok" role="status">{t(data.locale, 'adm.gardado')}</p>
	{:else if form?.error}
		<p class="erro" role="alert">{t(data.locale, 'adm.erro.INVALID')}</p>
	{/if}

	<div class="campos" data-tour="normas">
		<div class="campo">
			<label for="cancelHours">
				{t(data.locale, 'adm.normas.cancelar')}
				{t(data.locale, 'adm.normas.cancelar_fin')}
			</label>
			<select id="cancelHours" name="cancelHours" aria-describedby="d-cancelar">
				{#if custom}
					<option value="m{data.cancelMinutes}" selected
						>{t(data.locale, 'adm.normas.minutos', { n: data.cancelMinutes })}</option
					>
				{/if}
				{#each data.hours as h (h)}
					<option value={h} selected={!custom && h === selected}
						>{t(data.locale, `adm.normas.h.${h}` as MessageKey)}</option
					>
				{/each}
			</select>
			<p id="d-cancelar">{t(data.locale, 'adm.normas.cancelar_axuda')}</p>
		</div>

		<div class="campo">
			<label for="maxDaysAhead">{t(data.locale, 'adm.normas.antelacion')}</label>
			<input
				id="maxDaysAhead"
				name="maxDaysAhead"
				type="number"
				min="1"
				max="90"
				required
				value={data.maxDaysAhead}
				aria-describedby="d-antelacion"
			/>
			<p id="d-antelacion">{t(data.locale, 'adm.normas.antelacion_axuda')}</p>
		</div>

		<div class="campo">
			<label for="noShowThreshold">{t(data.locale, 'adm.normas.faltas')}</label>
			<input
				id="noShowThreshold"
				name="noShowThreshold"
				type="number"
				min="1"
				max="10"
				required
				value={data.noShowThreshold}
				aria-describedby="d-faltas"
			/>
			<p id="d-faltas">{t(data.locale, 'adm.normas.faltas_axuda')}</p>
		</div>

		<div class="campo">
			<label for="penaltyDays">{t(data.locale, 'adm.normas.dias')}</label>
			<input
				id="penaltyDays"
				name="penaltyDays"
				type="number"
				min="0"
				max="90"
				required
				value={data.penaltyDays}
				aria-describedby="d-dias"
			/>
			<p id="d-dias">{t(data.locale, 'adm.normas.dias_axuda')}</p>
		</div>
	</div>
</form>

<style>
	.mh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}

	.campos {
		display: grid;
		gap: 18px;
		max-width: 520px;
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-weight: 800;
	}

	select,
	input {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	input {
		max-width: 160px;
	}

	.campo p {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.ok,
	.erro {
		margin: 0 0 14px;
		font-weight: 800;
	}

	.erro {
		color: var(--perigo);
	}
</style>
