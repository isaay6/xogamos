<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const tag = $derived(locale === 'es' ? 'es-ES' : 'gl-ES');
	const nf = $derived(new Intl.NumberFormat(tag));
	const pct = (n: number, digits = 0) =>
		new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(n * 100);
	const longDate = (iso: string) =>
		new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
			new Date(`${iso}T00:00:00Z`)
		);
	const rangos = ['semana', 'mes', 'tres'] as const;

	// Totales: ocupación como media ponderada por instalaciones con oferta (las cerradas todo el
	// periodo no cuentan, igual que en cada fila), ausencias ponderadas por reservas.
	const totals = $derived.by(() => {
		const rows = data.rows;
		const bookings = rows.reduce((n, r) => n + r.bookings, 0);
		const noShows = rows.reduce((n, r) => n + r.noShowRate * r.bookings, 0);
		return {
			facilities: rows.reduce((n, r) => n + r.facilities, 0),
			bookings,
			// Un concello sin instalaciones abiertas no baja el total.
			avgOccupancy:
				rows.reduce((n, r) => n + r.openFacilities, 0) > 0
					? rows.reduce((n, r) => n + r.avgOccupancy * r.openFacilities, 0) /
						rows.reduce((n, r) => n + r.openFacilities, 0)
					: 0,
			noShowRate: bookings > 0 ? noShows / bookings : 0
		};
	});
	const caption = $derived(t(locale, 'dep.taboa.caption'));
</script>

<svelte:head>
	<title>{t(locale, 'dep.comp.titulo')} · {t(locale, 'staff.deputacion')}</title>
</svelte:head>

{#if data.novo}
	<p class="ok" role="status">
		<b>{t(locale, 'dep.novo.creado')}</b>
		<a href="/{data.novo.slug}">{t(locale, 'dep.novo.ver', { nome: data.novo.name })}</a>
	</p>
{/if}

<header class="mh">
	<div>
		<p class="k">
			{t(locale, 'dep.comp.periodo', { from: longDate(data.from), to: longDate(data.to) })}
		</p>
		<h1>{t(locale, 'dep.comp.titulo')}</h1>
	</div>
	<nav class="seg" data-tour="comparativa-periodo" aria-label={t(locale, 'dep.rango.nome')}>
		{#each rangos as r (r)}
			<a
				href="/deputacion?rango={r}"
				aria-current={r === data.rango ? 'true' : undefined}
				class:on={r === data.rango}>{t(locale, `dep.rango.${r}` as MessageKey)}</a
			>
		{/each}
	</nav>
</header>

{#if data.rows.length === 0}
	<p class="vacio">{t(locale, 'dep.baleiro')}</p>
{:else}
	<!-- La tabla se desplaza en horizontal en pantallas estrechas: el teclado debe poder enfocarla. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="scroll" data-tour="comparativa" role="region" aria-label={caption} tabindex="0">
		<table>
			<caption>{caption}</caption>
			<thead>
				<tr>
					<th scope="col">{t(locale, 'dep.col.concello')}</th>
					<th scope="col" class="num">{t(locale, 'dep.col.instalacions')}</th>
					<th scope="col" class="num">{t(locale, 'dep.col.reservas')}</th>
					<th scope="col">{t(locale, 'dep.col.ocupacion')}</th>
					<th scope="col" class="num">{t(locale, 'dep.col.ausencias')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as r (r.id)}
					<tr>
						<th scope="row" data-tour="comparativa-concello">
							<a href="/{r.slug}">{r.name}</a>
							<small>{r.province}</small>
						</th>
						<td class="num">{nf.format(r.facilities)}</td>
						<td class="num">{nf.format(r.bookings)}</td>
						<td>
							<span class="occ">
								<span
									class="t"
									role="img"
									aria-label={t(locale, 'dep.ocupacion.valor', {
										nome: r.name,
										valor: pct(r.avgOccupancy)
									})}
								>
									<i style:width="{pct(r.avgOccupancy)}%"></i>
								</span>
								<span class="v" aria-hidden="true">{pct(r.avgOccupancy)}%</span>
							</span>
						</td>
						<td class="num">{pct(r.noShowRate, 1)}%</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row">{t(locale, 'dep.total')}</th>
					<td class="num">{nf.format(totals.facilities)}</td>
					<td class="num">{nf.format(totals.bookings)}</td>
					<td>
						<span class="occ">
							<span class="t" aria-hidden="true">
								<i style:width="{pct(totals.avgOccupancy)}%"></i>
							</span>
							<span class="v">{pct(totals.avgOccupancy)}%</span>
						</span>
					</td>
					<td class="num">{pct(totals.noShowRate, 1)}%</td>
				</tr>
			</tfoot>
		</table>
	</div>
{/if}

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

	.seg {
		display: flex;
		flex-wrap: wrap;
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

	.ok {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 16px;
		margin: 0 0 16px;
		padding: 10px 14px;
		border: 2px solid var(--herba);
		border-radius: var(--radio);
		font-weight: 600;
	}

	.ok a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
		font-weight: 800;
	}

	.vacio {
		color: var(--texto-suave);
		font-weight: 800;
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		min-width: 640px;
		border-collapse: collapse;
		font-size: 15px;
	}

	caption {
		padding-bottom: 8px;
		text-align: left;
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	th,
	td {
		padding: 10px 12px;
		border-bottom: 2px solid var(--ceo);
		text-align: left;
		vertical-align: middle;
	}

	thead th {
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--texto-suave);
	}

	tbody th {
		font-weight: 800;
	}

	tbody th a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
	}

	small {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	tfoot th,
	tfoot td {
		border-bottom: 0;
		border-top: 3px solid var(--txt);
		font-weight: 900;
	}

	.occ {
		display: grid;
		grid-template-columns: minmax(80px, 1fr) 40px;
		align-items: center;
		gap: 8px;
		font-weight: 800;
	}

	.t {
		display: block;
		height: 14px;
		border-radius: 7px;
		background: var(--ceo);
		overflow: hidden;
	}

	.t i {
		display: block;
		height: 100%;
		border-radius: 7px;
		background: var(--auga);
	}

	.v {
		text-align: right;
	}

	a:focus-visible,
	.scroll:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
