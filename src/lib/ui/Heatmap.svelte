<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';

	let {
		peakHours,
		locale,
		fromHour = 9,
		toHour = 22
	}: {
		/** `weekday` 0 = luns. */
		peakHours: { weekday: number; hour: number; bookings: number }[];
		locale: Locale;
		fromHour?: number;
		toHour?: number;
	} = $props();

	// El rango se amplía si hay reservas fuera del horario habitual.
	const first = $derived(Math.min(fromHour, ...peakHours.map((p) => p.hour)));
	const last = $derived(Math.max(toHour, ...peakHours.map((p) => p.hour)));
	const hours = $derived(Array.from({ length: last - first + 1 }, (_, i) => first + i));
	const counts = $derived(new Map(peakHours.map((p) => [`${p.weekday}-${p.hour}`, p.bookings])));
	const max = $derived(Math.max(1, ...peakHours.map((p) => p.bookings)));
	const dayLabel = (d: number) => t(locale, `adm.dia.${d}` as MessageKey);
	// Resumo en texto e táboa: a cor nunca é a única forma de ler o mapa.
	const ranked = $derived(
		[...peakHours]
			.filter((p) => p.bookings > 0)
			.sort((a, b) => b.bookings - a.bookings || a.weekday - b.weekday || a.hour - b.hour)
	);
	const top = $derived(ranked[0] ?? null);
	const longDay = (d: number) => t(locale, `adm.dia.longo.${d}` as MessageKey);
</script>

<div class="heat" role="group" style:--cols={hours.length}>
	<span></span>
	{#each hours as h (h)}<span class="h" aria-hidden="true">{h}</span>{/each}
	{#each [0, 1, 2, 3, 4, 5, 6] as d (d)}
		<span class="d" aria-hidden="true">{dayLabel(d)}</span>
		{#each hours as h (h)}
			{@const n = counts.get(`${d}-${h}`) ?? 0}
			<i
				role="img"
				aria-label={t(locale, n === 1 ? 'adm.heat.celda.un' : 'adm.heat.celda', {
					dia: dayLabel(d),
					hora: h,
					n
				})}
				style:opacity={n === 0 ? 0.1 : 0.2 + 0.8 * (n / max)}
			></i>
		{/each}
	{/each}
</div>
<p class="ley">{t(locale, 'adm.heat.leyenda')}</p>
<p class="resumo">
	{top
		? t(locale, 'adm.heat.resumo', {
				dia: longDay(top.weekday),
				hora: top.hour,
				n: top.bookings
			})
		: t(locale, 'adm.heat.baleiro')}
</p>
{#if ranked.length > 0}
	<details class="taboa">
		<summary>{t(locale, 'adm.heat.ver_taboa')}</summary>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="desliza" tabindex="0" role="region" aria-label={t(locale, 'adm.heat.ver_taboa')}>
			<table>
				<thead>
					<tr>
						<th scope="col">{t(locale, 'adm.heat.col.dia')}</th>
						<th scope="col">{t(locale, 'adm.heat.col.hora')}</th>
						<th scope="col">{t(locale, 'adm.heat.col.reservas')}</th>
					</tr>
				</thead>
				<tbody>
					{#each ranked as p (`${p.weekday}-${p.hour}`)}
						<tr>
							<td>{longDay(p.weekday)}</td>
							<td>{p.hour}:00</td>
							<td>{p.bookings}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{/if}

<style>
	.heat {
		display: grid;
		grid-template-columns: 24px repeat(var(--cols), 1fr);
		gap: 2px;
		font-size: 11px;
		font-weight: 700;
		color: var(--gris);
	}

	.h {
		text-align: center;
	}

	i {
		height: 18px;
		border-radius: 3px;
		background: var(--pista);
	}

	.ley {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--gris);
	}

	.resumo {
		margin: 8px 0 0;
		font-weight: 700;
	}

	.taboa summary {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 700;
		cursor: pointer;
	}

	.taboa table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	.taboa th,
	.taboa td {
		padding: 6px 8px;
		border-bottom: 1px solid var(--liña);
		text-align: left;
	}

	/* As táboas largas desprázanse dentro do seu bloque, non a páxina (WCAG 1.4.10). */
	.desliza {
		overflow-x: auto;
		max-width: 100%;
	}
</style>
