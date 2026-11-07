<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';

	type Range = { weekday: number; opens: string; closes: string };

	let {
		hours,
		locale = 'gl',
		editable = false
	}: {
		hours: Range[];
		locale?: Locale;
		/** Con `editable`, cada día lleva sus tramos (2 o más) en inputs `h-{día}-{tramo}-opens|closes`. */
		editable?: boolean;
	} = $props();

	// La barra va de las 6:00 a las 24:00.
	const FROM = 6 * 60;
	const SPAN = 18 * 60;
	const DAYS = [0, 1, 2, 3, 4, 5, 6];
	const minutes = (hhmm: string) => {
		const [h, m] = hhmm.split(':').map(Number);
		return h * 60 + m;
	};
	const dayLabel = (d: number) => t(locale, `adm.dia.${d}` as MessageKey);

	// Valores editables: dos tramos por día como mínimo, o todos los guardados si hay más (el
	// asistente permite hasta 4), para no perder ninguno al guardar.
	let cells = $state(
		DAYS.map((d) => {
			const day = hours.filter((h) => h.weekday === d);
			return Array.from({ length: Math.max(2, day.length) }, (_, i) => ({
				opens: day[i]?.opens ?? '',
				closes: day[i]?.closes ?? ''
			}));
		})
	);

	const ranges = (d: number): Range[] =>
		editable
			? cells[d]
					.filter((c) => c.opens && c.closes)
					.map((c) => ({ weekday: d, opens: c.opens, closes: c.closes }))
			: hours.filter((h) => h.weekday === d);

	function bar(r: Range) {
		const start = Math.max(0, Math.min(100, ((minutes(r.opens) - FROM) / SPAN) * 100));
		const end = Math.max(0, Math.min(100, ((minutes(r.closes) - FROM) / SPAN) * 100));
		return { left: start, width: Math.max(0, end - start) };
	}

	const summary = (d: number) => {
		const rs = ranges(d);
		return rs.length ? rs.map((r) => `${r.opens}–${r.closes}`).join(' · ') : t(locale, 'adm.fac.pechado');
	};
</script>

<div class="wk">
	{#each DAYS as d (d)}
		<div class="dia">
			<span class="nome">{dayLabel(d)}</span>
			<div class="pista" aria-hidden="true">
				{#each ranges(d) as r, n (n)}
					{@const b = bar(r)}
					<i style:left="{b.left}%" style:width="{b.width}%"></i>
				{/each}
			</div>
			{#if editable}
				<div class="tramos">
					{#each cells[d] as _pair, i (i)}
						<span class="par">
							<input
								type="time"
								step="900"
								name="h-{d}-{i}-opens"
								bind:value={cells[d][i].opens}
								aria-label={t(locale, 'adm.fac.tramo', {
									dia: dayLabel(d),
									n: i + 1,
									campo: t(locale, 'adm.fac.abre')
								})}
							/>
							<span aria-hidden="true">–</span>
							<input
								type="time"
								step="900"
								name="h-{d}-{i}-closes"
								bind:value={cells[d][i].closes}
								aria-label={t(locale, 'adm.fac.tramo', {
									dia: dayLabel(d),
									n: i + 1,
									campo: t(locale, 'adm.fac.pecha')
								})}
							/>
						</span>
					{/each}
				</div>
			{:else}
				<span class="resumo">{summary(d)}</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.wk {
		display: grid;
		gap: 8px;
	}

	.dia {
		display: grid;
		grid-template-columns: 28px minmax(80px, 1fr) auto;
		align-items: center;
		gap: 10px;
	}

	.nome {
		font-weight: 800;
	}

	.pista {
		position: relative;
		height: 14px;
		border-radius: 7px;
		background: var(--ceo);
	}

	.pista i {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 7px;
		background: var(--herba);
	}

	.resumo {
		font-size: 14px;
		font-weight: 700;
		color: var(--texto-suave);
		text-align: right;
		min-width: 130px;
	}

	.tramos {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
	}

	.par {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	input {
		min-height: var(--toque);
		padding: 0 8px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	@media (max-width: 720px) {
		.dia {
			grid-template-columns: 28px 1fr;
		}

		.tramos,
		.resumo {
			grid-column: 1 / -1;
		}
	}
</style>
