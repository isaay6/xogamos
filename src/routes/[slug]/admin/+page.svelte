<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Heatmap from '#lib/ui/Heatmap.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import OccupancyBars from '#lib/ui/OccupancyBars.svelte';
	import { longDate } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const nf = $derived(new Intl.NumberFormat(data.locale === 'es' ? 'es-ES' : 'gl-ES'));
	const pct = (n: number, digits = 0) =>
		new Intl.NumberFormat(data.locale === 'es' ? 'es-ES' : 'gl-ES', {
			maximumFractionDigits: digits
		}).format(n * 100);
	const base = $derived(`/${data.municipality.slug}/admin`);
	const periodos = ['semana', 'mes', 'tres'] as const;
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.resumo.titulo')} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<div>
		<p class="k">{t(data.locale, 'adm.periodo.rango', { from: longDate(data.locale, data.from), to: longDate(data.locale, data.to) })}</p>
		<h1>{t(data.locale, 'adm.resumo.titulo')}</h1>
	</div>
	<div class="acc">
		<a class="report-link" href="{base}/informe">{t(data.locale, 'adm.informe.enlace')}</a>
		<nav class="seg" data-tour="resumo-periodo" aria-label={t(data.locale, 'adm.periodo.nome')}>
			{#each periodos as p (p)}
				<a
					href="{base}?periodo={p}"
					aria-current={p === data.periodo ? 'true' : undefined}
					class:on={p === data.periodo}>{t(data.locale, `adm.periodo.${p}` as MessageKey)}</a
				>
			{/each}
		</nav>
	</div>
</header>

<div class="kpi">
	<div><b>{pct(data.kpi.occupancy)}%</b>{t(data.locale, 'adm.kpi.ocupacion')}</div>
	<div><b>{nf.format(data.kpi.bookings)}</b>{t(data.locale, 'adm.kpi.reservas')}</div>
	<div><b>{pct(data.kpi.noShowRate, 1)}%</b>{t(data.locale, 'adm.kpi.ausencias')}</div>
	<div>
		<b>{data.kpi.peak ? `${data.kpi.peak.from}–${data.kpi.peak.to} h` : '–'}</b
		>{t(data.locale, 'adm.kpi.punta')}
	</div>
</div>

{#if data.kpi.bookings === 0}
	<p class="vacio">{t(data.locale, 'adm.sen_datos')}</p>
{/if}

<div class="dous">
	<section>
		<h2 class="k">{t(data.locale, 'adm.ocupacion.titulo')}</h2>
		<OccupancyBars rows={data.bars} locale={data.locale} />
		{#if data.warning}
			<div class="aviso">
				<Mascot kind={data.warning.mascot} mood="triste" size={48} />
				<Bubble>{t(data.locale, 'adm.aviso', { nome: data.warning.name })}</Bubble>
			</div>
		{/if}
	</section>
	<section data-tour="resumo-mapa">
		<h2 class="k">{t(data.locale, 'adm.heat.titulo')}</h2>
		<Heatmap peakHours={data.peakHours} locale={data.locale} />
	</section>
</div>

<style>
	.mh {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
		font-size: 28px;
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

	.acc {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.report-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 14px;
		border-radius: 10px;
		background: var(--foco);
		color: var(--txt);
		font-weight: 800;
		text-decoration: none;
	}

	.seg {
		display: flex;
		gap: 4px;
	}

	.seg a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 14px;
		border-radius: 10px;
		background: var(--ceo);
		color: var(--txt);
		font-weight: 800;
		text-decoration: none;
	}

	.seg a.on {
		background: var(--txt);
		color: var(--branco);
	}

	.kpi {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 18px;
	}

	.kpi div {
		padding: 10px 14px;
		border-radius: var(--radio);
		background: var(--ceo);
		color: var(--texto-suave);
		font-size: 13px;
		font-weight: 600;
	}

	.kpi b {
		display: block;
		color: var(--txt);
		font-size: 28px;
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	.vacio {
		color: var(--gris);
		font-weight: 600;
	}

	.dous {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 24px;
	}

	.aviso {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		margin-top: 12px;
	}

	a:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	@media (max-width: 767px) {
		.kpi {
			grid-template-columns: 1fr 1fr;
		}

	}
</style>
