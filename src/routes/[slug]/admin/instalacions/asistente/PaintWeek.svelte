<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import {
		cellOpen,
		GRID_ROWS,
		MAX_PAIRS,
		paintable,
		paintCell,
		rowLabel,
		weekFromValues,
		type Week
	} from './hours';

	let {
		values,
		errors = {},
		locale
	}: {
		/** Valores del asistente: se leen los `h-{día}-{tramo}-opens|closes`. */
		values: Record<string, string>;
		/** Errores del paso: `h-{día}` → código. */
		errors?: Record<string, string>;
		locale: Locale;
	} = $props();

	const DAYS = [0, 1, 2, 3, 4, 5, 6];
	const dayLabel = (d: number) => t(locale, `adm.dia.${d}` as MessageKey);
	const dayLong = (d: number) => t(locale, `adm.hor.dia.${d}` as MessageKey);

	// Siempre al menos 2 parejas por día para escribir sin JS.
	const pad = (w: Week): Week =>
		w.map((pairs) => [
			...pairs,
			...Array.from({ length: Math.max(0, 2 - pairs.length) }, () => ({ opens: '', closes: '' }))
		]);

	// svelte-ignore state_referenced_locally
	let week = $state(pad(weekFromValues(values)));

	// Sin JS solo están las entradas de hora; con JS aparece la rejilla para pintar.
	let js = $state(false);
	onMount(() => (js = true));

	let brush = $state<'aberta' | 'pechada'>('aberta');
	let painting = false;

	function paint(d: number, row: number) {
		const next = paintCell(week[d], row, brush === 'aberta');
		// Un día que la rejilla no sabe dibujar se queda como está (se cambia escribiendo).
		if (next !== week[d]) week[d] = pad([next])[0];
	}

	const fixed = $derived(DAYS.filter((d) => !paintable(week[d])));

	function cellOf(e: PointerEvent): { d: number; row: number } | null {
		const el = document.elementFromPoint(e.clientX, e.clientY);
		const cell = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-row]') : null;
		if (!cell) return null;
		return { d: Number(cell.dataset.d), row: Number(cell.dataset.row) };
	}

	function down(e: PointerEvent) {
		const c = cellOf(e);
		if (!c) return;
		e.preventDefault();
		painting = true;
		paint(c.d, c.row);
	}

	function move(e: PointerEvent) {
		if (!painting) return;
		const c = cellOf(e);
		if (c) paint(c.d, c.row);
	}

	const stop = () => (painting = false);

	function copyMonday() {
		week = DAYS.map(() => week[0].map((p) => ({ ...p })));
	}

	function closeAll() {
		week = pad(DAYS.map(() => []));
	}

	function addPair(d: number) {
		if (week[d].length < MAX_PAIRS) week[d].push({ opens: '', closes: '' });
	}

	const errorOf = (d: number) => errors[`h-${d}`];
</script>

<svelte:window onpointerup={stop} onpointercancel={stop} />

{#snippet inputs()}
	<div class="horas">
		{#each DAYS as d (d)}
			<div class="dia" class:mal={!!errorOf(d)}>
				<span class="nome" id="hd-{d}">{dayLong(d)}</span>
				<div class="pares">
					{#each week[d] as pair, i (i)}
						<span class="par">
							<input
								type="time"
								step="900"
								name="h-{d}-{i}-opens"
								bind:value={pair.opens}
								aria-invalid={errorOf(d) ? 'true' : undefined}
								aria-describedby={errorOf(d) ? `he-${d}` : undefined}
								aria-label={t(locale, 'adm.fac.tramo', {
									dia: dayLong(d),
									n: i + 1,
									campo: t(locale, 'adm.fac.abre')
								})}
							/>
							<span aria-hidden="true">–</span>
							<input
								type="time"
								step="900"
								name="h-{d}-{i}-closes"
								bind:value={pair.closes}
								aria-invalid={errorOf(d) ? 'true' : undefined}
								aria-describedby={errorOf(d) ? `he-${d}` : undefined}
								aria-label={t(locale, 'adm.fac.tramo', {
									dia: dayLong(d),
									n: i + 1,
									campo: t(locale, 'adm.fac.pecha')
								})}
							/>
						</span>
					{/each}
					{#if js && week[d].length < MAX_PAIRS}
						<button
							type="button"
							class="mais"
							onclick={() => addPair(d)}
							aria-label={t(locale, 'adm.hor.franxa_a', { dia: dayLong(d) })}
							>{t(locale, 'adm.hor.franxa')}</button
						>
					{/if}
				</div>
				{#if errorOf(d)}
					<p class="erro" id="he-{d}">
						{t(locale, `adm.asis.erro.${errorOf(d)}` as MessageKey)}
					</p>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#if js}
	<div class="tb">
		<span class="lbl">{t(locale, 'adm.asis.pincel')}</span>
		<button
			type="button"
			class="brush"
			aria-pressed={brush === 'aberta'}
			onclick={() => (brush = 'aberta')}
		>
			<i class="sw o" aria-hidden="true"></i>{t(locale, 'adm.asis.aberta')}
		</button>
		<button
			type="button"
			class="brush"
			aria-pressed={brush === 'pechada'}
			onclick={() => (brush = 'pechada')}
		>
			<i class="sw" aria-hidden="true"></i>{t(locale, 'adm.asis.pechada')}
		</button>
		<span class="spx"></span>
		<button type="button" class="ghost" onclick={copyMonday}
			>{t(locale, 'adm.asis.copiar_luns')}</button
		>
		<button type="button" class="ghost" onclick={closeAll}>{t(locale, 'adm.asis.borrar')}</button>
	</div>
	<p class="axuda">{t(locale, 'adm.asis.pintar_axuda')}</p>
	{#if fixed.length}
		<p class="axuda fixo">
			{t(locale, 'adm.asis.non_pintable', { dias: fixed.map(dayLong).join(', ') })}
		</p>
	{/if}
	<!-- La rejilla es un atajo con el ratón; las mismas horas se escriben en «Escribir as horas» -->
	<div
		class="pg"
		aria-hidden="true"
		onpointerdown={down}
		onpointermove={move}
		role="presentation"
	>
		<div class="pgh"></div>
		{#each DAYS as d (d)}<div class="pgh" class:mal={!!errorOf(d)}>
				{dayLabel(d)}{#if fixed.includes(d)}*{/if}
			</div>{/each}
		{#each Array.from({ length: GRID_ROWS }, (_, r) => r) as row (row)}
			<div class="pgt">{row % 2 === 0 ? rowLabel(row).replace(/^0/, '') : ''}</div>
			{#each DAYS as d (d)}
				<div
					class="pc"
					class:o={cellOpen(week[d], row)}
					class:fixo={fixed.includes(d)}
					data-d={d}
					data-row={row}
				></div>
			{/each}
		{/each}
	</div>
	<details class="escribir" open={Object.keys(errors).some((k) => k.startsWith('h-'))}>
		<summary>{t(locale, 'adm.asis.escribir_horas')}</summary>
		{@render inputs()}
	</details>
{:else}
	<p class="axuda">{t(locale, 'adm.fac.horario_axuda')}</p>
	{@render inputs()}
{/if}

<style>
	.tb {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}

	.lbl {
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.spx {
		flex: 1;
	}

	button {
		min-height: var(--toque);
		padding: 0 12px;
		border-radius: 10px;
		font: inherit;
		font-size: 14px;
		font-weight: 800;
		color: var(--txt);
		cursor: pointer;
	}

	.brush {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 2px solid var(--liña);
		background: var(--branco);
	}

	.brush[aria-pressed='true'] {
		border-color: var(--txt);
		box-shadow: 0 0 0 3px var(--foco);
	}

	.sw {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		background: #f4f6f5;
		border: 1px solid #c5cbca;
	}

	.sw.o {
		background: var(--herba);
		border-color: var(--herba);
	}

	.ghost {
		border: 0;
		background: var(--ceo);
	}

	.axuda {
		margin: 0 0 10px;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.pg {
		display: grid;
		grid-template-columns: 52px repeat(7, 1fr);
		gap: 2px;
		touch-action: none;
		user-select: none;
		cursor: crosshair;
	}

	.pgh {
		height: 22px;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-align: center;
	}

	.pgh.mal {
		color: var(--perigo);
	}

	.pgt {
		height: 13px;
		font-size: 11px;
		font-weight: 800;
		line-height: 13px;
		color: var(--gris);
	}

	.pc {
		height: 13px;
		border-radius: 3px;
		background: #f4f6f5;
	}

	.pc.o {
		background: var(--herba);
	}

	/* Día con horas que la rejilla no puede dibujar: no se pinta */
	.pc.fixo {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.axuda.fixo {
		color: var(--txt);
		font-weight: 800;
	}

	.escribir {
		margin-top: 14px;
	}

	summary {
		min-height: var(--toque);
		display: flex;
		align-items: center;
		font-weight: 800;
		cursor: pointer;
	}

	.horas {
		display: grid;
		gap: 8px;
	}

	.dia {
		display: grid;
		grid-template-columns: 96px 1fr;
		align-items: center;
		gap: 4px 10px;
	}

	.nome {
		font-weight: 800;
	}

	.dia.mal .nome {
		color: var(--perigo);
	}

	.pares {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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

	input[aria-invalid='true'] {
		border-color: var(--perigo);
	}

	.mais {
		border: 2px dashed var(--apagado);
		background: var(--branco);
		color: var(--texto-suave);
	}

	.erro {
		grid-column: 2;
		margin: 0;
		font-size: 14px;
		font-weight: 800;
		color: var(--perigo);
	}
</style>
