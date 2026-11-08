<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { logoUrl } from '#lib/logo-url.js';
	import { formatAmount } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const locale = $derived(data.locale);
	const tag = $derived(locale === 'es' ? 'es-ES' : 'gl-ES');
	const pct = (value: number) =>
		new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(value * 100);
	const number = (value: number) => new Intl.NumberFormat(tag).format(value);
	const month = $derived(
		new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${data.month}-01T12:00:00Z`)
		)
	);
	const change = (value: number | null) =>
		value === null ? '–' : `${value > 0 ? '↑' : value < 0 ? '↓' : '→'} ${Math.abs(value)} %`;
	const hour = (value: number | null) =>
		value === null ? t(locale, 'adm.informe.sen_horas') : `${value}:00 h`;
</script>

<svelte:head>
	<title>{t(locale, 'adm.informe.titulo')} · {data.municipality.name}</title>
</svelte:head>

<article class="report" data-tour="informe-mensual">
	<header class="masthead">
		<div>
			<p class="eyebrow">{t(locale, 'adm.informe.periodo', { mes: month })}</p>
			<h1>{t(locale, 'adm.informe.titulo')}</h1>
			<p class="municipality">{data.municipality.name}</p>
		</div>
		{#if data.municipality.hasLogo}
			<img
				class="logo"
				src={logoUrl(data.municipality.slug, data.municipality.logoVersion)}
				alt={data.municipality.name}
			/>
		{/if}
		<button class="print" type="button" onclick={() => window.print()}>
			{t(locale, 'adm.informe.gardar_pdf')}
		</button>
	</header>

	<section>
		<h2>{t(locale, 'adm.informe.cifras')}</h2>
		<div class="figures">
			{#each [[number(data.report.figures.bookings), t(locale, 'adm.informe.reservas')], [number(data.report.figures.people), t(locale, 'adm.informe.persoas')], [`${pct(data.report.figures.occupancy)} %`, t(locale, 'adm.informe.ocupacion')], [number(data.report.figures.noShows), t(locale, 'adm.informe.ausencias')], [number(data.report.figures.cancellations), t(locale, 'adm.informe.cancelacions')], [`${number(data.report.figures.residents)} / ${number(data.report.figures.nonResidents)}`, `${t(locale, 'adm.informe.residentes')} / ${t(locale, 'adm.informe.non_residentes')}`], [number(data.report.figures.passes), t(locale, 'adm.informe.abonos')], [number(data.report.figures.socialTariffBookings), t(locale, 'adm.informe.tarifa_social')]] as figure (figure[1])}
				<div>
					<b>{figure[0]}</b>
					<span>{figure[1]}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2>{t(locale, 'adm.informe.instalacions')}</h2>
		<table>
			<thead>
				<tr>
					<th>{t(locale, 'adm.informe.instalacion')}</th>
					<th>{t(locale, 'adm.informe.valor')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.report.facilities as facility (facility.name)}
					<tr>
						<td>{facility.name}</td>
						<td>
							<span
								role="img"
								class="bar"
								aria-label={`${facility.name}: ${pct(facility.occupancy)} %`}
							>
								<i style={`width: ${pct(facility.occupancy)}%`}></i>
							</span>
							{pct(facility.occupancy)} %
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<div class="two">
		<section>
			<h2>{t(locale, 'adm.informe.horas')}</h2>
			<p><b>{t(locale, 'adm.informe.mais_concorrida')}:</b> {hour(data.report.busiestHour)}</p>
			<p><b>{t(locale, 'adm.informe.menos_concorrida')}:</b> {hour(data.report.quietestHour)}</p>
		</section>
		<section>
			<h2>{t(locale, 'adm.informe.comparacion')}</h2>
			<p><b>{t(locale, 'adm.informe.reservas')}:</b> {change(data.report.comparison.bookings)}</p>
			<p><b>{t(locale, 'adm.informe.ocupacion')}:</b> {change(data.report.comparison.occupancy)}</p>
		</section>
	</div>

	<section>
		<h2>{t(locale, 'adm.informe.peches')}</h2>
		{#if data.report.closures.length === 0}
			<p>{t(locale, 'adm.informe.sen_peches')}</p>
		{:else}
			<ul>
				{#each data.report.closures as closure (closure.name + closure.reason)}
					<li><b>{closure.name}</b>: {closure.reason || t(locale, 'adm.informe.sen_motivo')}</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="automatic">
		<h2>{t(locale, 'adm.informe.resumo_titulo')}</h2>
		<p>{data.report.summary}</p>
	</section>
	<section>
		<h2>{t(locale, 'adm.informe.monedero')}</h2>
		<p>
			{t(locale, 'adm.informe.monedero_recargas')}: {formatAmount(data.report.wallet.topUpsCents)}
		</p>
		<p>
			{t(locale, 'adm.informe.monedero_pagos')}: {formatAmount(data.report.wallet.paymentsCents)}
		</p>
	</section>
</article>

<style>
	.report {
		max-width: 210mm;
		margin: 0 auto;
		color: var(--txt);
	}
	.masthead {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 16px;
		align-items: start;
		border-bottom: 3px solid var(--concello);
		padding-bottom: 14px;
	}
	.eyebrow {
		margin: 0 0 4px;
		color: var(--gris);
		font-size: 13px;
		font-weight: 800;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		font-weight: 900;
	}
	.municipality {
		margin: 4px 0 0;
		font-size: 18px;
		font-weight: 700;
	}
	.logo {
		grid-column: 2;
		width: 62px;
		height: 62px;
		object-fit: contain;
	}
	.print {
		grid-column: 1 / -1;
		justify-self: start;
		min-height: var(--toque);
		padding: 0 14px;
		border: 0;
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font: inherit;
		font-weight: 800;
	}
	section {
		margin-top: 20px;
	}
	h2 {
		margin: 0 0 8px;
		font-size: 16px;
		font-weight: 900;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.figures div {
		padding: 10px;
		border-radius: 8px;
		background: var(--ceo);
	}
	.figures b {
		display: block;
		font-size: 20px;
		font-weight: 900;
	}
	.figures span {
		font-size: 11px;
		font-weight: 700;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		padding: 7px 4px;
		border-bottom: 2px solid var(--granito);
		text-align: left;
	}
	td {
		padding: 7px 4px;
		border-bottom: 1px solid var(--ceo);
	}
	.bar {
		display: inline-block;
		width: min(180px, 40vw);
		height: 12px;
		margin-right: 8px;
		border-radius: 6px;
		background: var(--ceo);
		overflow: hidden;
		vertical-align: middle;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--concello);
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.two p {
		margin: 5px 0;
	}
	.automatic {
		padding: 12px;
		border-left: 4px solid var(--foco);
		background: var(--ceo);
	}
	.automatic p {
		margin: 0;
		font-weight: 700;
	}
	button:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	@media (max-width: 640px) {
		.figures {
			grid-template-columns: 1fr 1fr;
		}
		.two {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
	@media print {
		:global(body) {
			background: #fff;
		}
		.report {
			max-width: none;
			font-size: 10pt;
		}
		.print {
			display: none;
		}
		section {
			break-inside: avoid;
			margin-top: 12px;
		}
		.figures div {
			padding: 7px;
		}
	}
</style>
