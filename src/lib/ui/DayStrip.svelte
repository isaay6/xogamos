<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '../i18n';
	import { formatDay } from './format';
	import type { DayStatus } from './types';

	let {
		days,
		selected = $bindable(),
		locale,
		name = 'dia'
	}: {
		days: DayStatus[];
		/** Día elegido 'YYYY-MM-DD'. */
		selected: string;
		locale: Locale;
		/** Nombre del grupo de radio en el formulario. */
		name?: string;
	} = $props();
</script>

<fieldset class="days">
	<legend class="sr">{t(locale, 'dia.lenda')}</legend>
	{#each days as d (d.date)}
		{@const f = formatDay(locale, d.date)}
		<label class="day" class:full={d.full && !d.closed} class:on={selected === d.date}>
			<input type="radio" {name} value={d.date} bind:group={selected} />
			<span>{f.weekday}</span>
			<b>{f.day}</b>
			{#if d.closed}
				<!-- Pechado, non cheo: o motivo vai enteiro para os lectores de pantalla -->
				<small>{d.closed.holiday ? t(locale, 'dia.festivo', { nome: d.closed.reason }) : t(locale, 'dia.pechada')}</small>
				{#if d.closed.reason}<span class="sr">{d.closed.reason}</span>{/if}
			{:else if d.full}<small>{t(locale, 'dia.completo')}</small>{/if}
		</label>
	{/each}
</fieldset>

<style>
	.days {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding: 4px 3px 8px;
		scrollbar-width: thin;
	}

	.day {
		position: relative;
		flex: 1 0 52px;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 60px;
		padding: 6px 2px;
		border-radius: 12px;
		background: var(--ceo);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
	}

	.day b {
		font-size: 19px;
		font-weight: 900;
	}

	.day small {
		font-size: 11px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.day:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	/* Día completo: sigue siendo elegible, así que su número cumple 4.5:1 sobre --ceo. */
	.day.full b {
		text-decoration: line-through;
		color: var(--texto-suave);
	}

	.day.on {
		background: var(--txt);
		color: var(--branco);
	}

	.day.on small,
	.day.on.full b {
		color: var(--branco);
	}
</style>
