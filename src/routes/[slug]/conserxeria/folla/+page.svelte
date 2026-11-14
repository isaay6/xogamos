<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.js';
	import { formatCode } from '#lib/ui/format.js';
	import { dayLabel } from '../dates';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const back = $derived(`/${data.municipality.slug}/conserxeria?dia=${data.date}`);
	const date = $derived(dayLabel(locale, data.date));

	// Sen JavaScript o botón non faría nada: ensínase unha axuda para imprimir co navegador.
	let js = $state(false);
	onMount(() => (js = true));
</script>

<svelte:head>
	<title>{t(locale, 'cons.folla.titulo')} · {date}</title>
</svelte:head>

<div class="acts" data-tour="folla">
	<form method="GET" class="dia">
		<label for="folla-dia">{t(locale, 'cons.folla.dia')}</label>
		<input id="folla-dia" type="date" name="dia" value={data.date} required />
		<button type="submit" class="out">{t(locale, 'cons.folla.ver')}</button>
	</form>
	{#if js}
		<button type="button" onclick={() => window.print()}>{t(locale, 'cons.folla.imprimir')}</button>
	{:else}
		<p class="hint">{t(locale, 'cons.folla.senJs')}</p>
	{/if}
	<a href={back}>{t(locale, 'cons.folla.volver')}</a>
</div>

<article class="folla">
	<header>
		<p class="k">{data.municipality.name}</p>
		<h1>{t(locale, 'cons.folla.titulo')}</h1>
		<p class="date">{date}</p>
	</header>

	{#if data.sheet.length === 0}
		<p>{t(locale, 'cons.folla.baleira')}</p>
	{/if}
	{#each data.sheet as g (g.facilityId)}
		<section>
			<h2>{g.facilityName}</h2>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="desliza" tabindex="0" role="region" aria-label={g.facilityName}>
				<table>
					<thead>
						<tr>
							<th scope="col" class="h">{t(locale, 'cons.folla.hora')}</th>
							<th scope="col">{t(locale, 'cons.folla.nome')}</th>
							<th scope="col">{t(locale, 'cons.folla.pista')}</th>
							<th scope="col" class="p">{t(locale, 'cons.folla.pin')}</th>
							<th scope="col" class="c">{t(locale, 'cons.folla.chegou')}</th>
						</tr>
					</thead>
					<tbody>
						{#each g.rows as r (r.key)}
							<tr class:season={r.season}>
								<td class="h">{r.time}</td>
								<td>
									{r.name}
									{#if r.season}<small>· {t(locale, 'cons.folla.tempada')}</small>{/if}
								</td>
								<td
									>{#if r.seats !== null}{t(locale, 'cons.folla.prazas', {
											n: r.seats
										})}{:else if r.unitIndex !== null}{t(locale, 'cons.folla.pista_n', {
											n: r.unitIndex + 1
										})}{:else}—{/if}</td
								>
								<td class="p">{r.code === null ? '—' : formatCode(r.code)}</td>
								<td class="c">
									{#if !r.season}
										<span class="casa" aria-hidden="true">{r.attended ? '✓' : ''}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</article>

<style>
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
		margin-bottom: 16px;
	}
	.dia {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 800;
	}
	.dia input {
		min-height: var(--toque);
		padding: 0 8px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
		font-weight: 800;
	}
	.acts button {
		min-height: var(--toque);
		padding: 0 18px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	.acts button.out {
		background: var(--branco);
		color: var(--txt);
	}
	.acts a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
		font-weight: 800;
	}
	.hint {
		margin: 0;
		font-weight: 700;
		color: var(--texto-suave);
	}
	.folla {
		max-width: 760px;
		padding: 24px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
	}
	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--gris);
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 900;
	}
	.date {
		margin: 0 0 12px;
		font-size: 18px;
		font-weight: 800;
	}
	.date::first-letter {
		text-transform: uppercase;
	}
	section {
		break-inside: avoid;
		margin-top: 18px;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 18px;
		font-weight: 900;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}
	th {
		padding: 4px 8px;
		border-bottom: 2px solid var(--txt);
		font-size: 12px;
		font-weight: 800;
		text-align: left;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	td {
		padding: 8px;
		border-bottom: 1px solid #c9cfce;
		font-weight: 700;
	}
	.h {
		width: 120px;
		white-space: nowrap;
	}
	.p {
		width: 80px;
		font-variant-numeric: tabular-nums;
		font-weight: 900;
	}
	.c {
		width: 80px;
		text-align: center;
	}
	.season td {
		color: var(--texto-suave);
	}
	small {
		font-size: 12px;
	}
	.casa {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 2px solid var(--txt);
		border-radius: 5px;
		font-weight: 900;
	}
	button:focus-visible,
	a:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	/* Impresión: só a folla, sen o menú lateral nin os botóns, en branco e negro. */
	@media print {
		:global(.side),
		.acts {
			display: none !important;
		}
		:global(.shell) {
			display: block !important;
		}
		.folla {
			max-width: none;
			padding: 0;
			border: 0;
		}
		th,
		.casa {
			border-color: #000;
		}
		td {
			border-color: #777;
		}
	}

	/* As táboas largas desprázanse dentro do seu bloque, non a páxina (WCAG 1.4.10). */
	.desliza {
		overflow-x: auto;
		max-width: 100%;
	}
</style>
