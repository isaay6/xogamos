<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import { formatDay } from './format';
	import Mascot from './Mascot.svelte';

	type Level = 'tranquila' | 'media' | 'chea' | 'pechada';
	type Cell = { date: string; minutes: number; possible: number; level: Level };
	type Row = {
		facilityId: string;
		facilityName: string;
		mascot: string;
		color: string;
		cells: Cell[];
	};

	let {
		days,
		rows,
		query = '',
		locale
	}: {
		days: { date: string; isToday: boolean; isPast: boolean }[];
		rows: Row[];
		/** Parámetros que se conservan al abrir un día, p. ej. `&inst=…`. */
		query?: string;
		locale: Locale;
	} = $props();

	const byDate = $derived(new Map(days.map((d) => [d.date, d])));

	/** 90 → «1,5 h»; 120 → «2 h» (media hora como mucho de precisión, coma decimal). */
	function hoursText(minutes: number): string {
		const halves = Math.round(minutes / 30);
		const h = halves % 2 === 0 ? String(halves / 2) : `${(halves - 1) / 2},5`;
		return t(locale, 'cons.semana.horas', { h });
	}

	function dayText(date: string): string {
		const f = formatDay(locale, date);
		return `${f.weekday} ${f.day}`;
	}
</script>

<p class="desliza" aria-hidden="true">{t(locale, 'taboa.desliza')}</p>
<!-- Rexión desprazable: debe poder recibir o foco para moverse co teclado (WCAG 2.1.1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="wrap" role="region" aria-label={t(locale, 'taboa.rexion')} tabindex="0">
	<table class="wk" aria-label={t(locale, 'cons.semana.grella')}>
		<thead>
			<tr>
				<td></td>
				{#each days as d (d.date)}
					{@const f = formatDay(locale, d.date)}
					<th scope="col" class:today={d.isToday} aria-current={d.isToday ? 'date' : undefined}>
						{f.weekday} <b>{f.day}</b>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.facilityId)}
				<tr>
					<th scope="row">
						<span class="wl">
							<Mascot kind={r.mascot} size={20} animated={false} color={r.color} />
							<span>{r.facilityName}</span>
						</span>
					</th>
					{#each r.cells as c (c.date)}
						{@const day = byDate.get(c.date)}
						{@const nivel = t(locale, `cons.semana.nivel.${c.level}` as MessageKey)}
						<td>
							<a
								class="wc {c.level}"
								class:past={day?.isPast}
								class:tcol={day?.isToday}
								href="?dia={c.date}{query}"
								aria-label={t(locale, 'cons.semana.celda', {
									instalacion: r.facilityName,
									dia: dayText(c.date),
									horas: hoursText(c.minutes),
									nivel
								})}
							>
								{#if c.level === 'pechada'}
									<span class="ws">{nivel}</span>
								{:else}
									<span class="wn">{hoursText(c.minutes)}</span>
									<span class="wbar" aria-hidden="true"
										><i
											style:width="{Math.min(100, (c.minutes / c.possible) * 100)}%"
											style:background={r.color}
										></i></span
									>
									<span class="ws">{nivel}</span>
								{/if}
							</a>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="lg">
		<span>{t(locale, 'cons.semana.lenda.horas')}</span>
		<span class="chea-l">{t(locale, 'cons.semana.lenda.chea')}</span>
		<span>{t(locale, 'cons.semana.lenda.pasados')}</span>
	</p>
</div>

<style>
	/* Pista só en pantallas estreitas, onde a táboa non cabe */
	.desliza {
		display: none;
		margin: 6px 0 0;
		font-size: 13px;
		color: var(--texto-suave);
	}

	@media (max-width: 760px) {
		.desliza {
			display: block;
		}
	}

	.wrap {
		overflow-x: auto;
	}
	.wk {
		width: 100%;
		min-width: 760px;
		border-collapse: separate;
		border-spacing: 4px;
		table-layout: fixed;
	}
	.wk thead td {
		width: 160px;
	}
	.wk thead th {
		padding: 4px 0;
		border-radius: 9px;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-align: center;
	}
	.wk thead th b {
		font-size: 16px;
		color: var(--txt);
	}
	.wk thead th.today {
		background: var(--txt);
		color: var(--branco);
	}
	.wk thead th.today b {
		color: var(--branco);
	}
	tbody th {
		text-align: left;
		font-weight: 800;
	}
	.wl {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
	}
	.wl span {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		line-height: 1.15;
	}
	td {
		padding: 0;
	}
	.wc {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		min-height: 54px;
		padding: 6px 9px;
		border: 2px solid transparent;
		border-radius: 10px;
		background: var(--ceo);
		color: var(--txt);
		text-decoration: none;
	}
	.wc:hover {
		border-color: var(--txt);
	}
	.wc.past {
		border: 2px dotted var(--gris);
		background: #f7f9f8;
	}
	.wc.tcol {
		border-color: var(--txt);
	}
	.wc.pechada {
		align-items: center;
		background: repeating-linear-gradient(135deg, #f3f5f5, #f3f5f5 6px, #e6eaea 6px, #e6eaea 12px);
	}
	.wn {
		font-size: 15px;
		font-weight: 900;
		line-height: 1;
	}
	.wbar {
		display: block;
		height: 6px;
		border-radius: 3px;
		background: var(--branco);
		overflow: hidden;
	}
	.wbar i {
		display: block;
		height: 100%;
		border-radius: 3px;
	}
	.ws {
		font-size: 12px;
		font-weight: 800;
		color: var(--texto-suave);
	}
	.pechada .ws {
		color: var(--txt);
	}
	.chea .ws,
	.chea-l {
		color: var(--perigo);
	}
	.wc:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	.lg {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin: 10px 0 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--texto-suave);
	}
</style>
