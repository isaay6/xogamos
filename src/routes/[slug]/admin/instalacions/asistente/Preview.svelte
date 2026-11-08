<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import { MASCOTS } from '#lib/mascots.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { durationLabel, howText } from '../text';
	import { slotStarts, weekFromValues } from './hours';

	let { values, locale }: { values: Record<string, string>; locale: Locale } = $props();

	const mascot = $derived(
		(MASCOTS as readonly string[]).includes(values.mascota ?? '') ? values.mascota : 'sala'
	);
	const sport = $derived(
		values.mascota && mascot === values.mascota
			? t(locale, `adm.mascota.${mascot}` as MessageKey)
			: ''
	);
	const minutes = $derived(Number(values.minutos) || 0);
	const mode = $derived(
		(['slot', 'unit', 'capacity', 'day'] as const).find((m) => m === values.modo) ?? 'slot'
	);
	const week = $derived(weekFromValues(values));
	// El primer día con horario: sus primeras horas, como en la pantalla de reservar.
	const firstDay = $derived(week.findIndex((pairs) => pairs.some((p) => p.opens && p.closes)));
	const starts = $derived(firstDay < 0 ? [] : slotStarts(week[firstDay], minutes, 6));
	const how = $derived(
		minutes >= 15
			? `${howText(
					locale,
					{
						bookingMode: mode,
						slotMinutes: minutes,
						units: Number(values.unidades) || 1,
						capacity: Number(values.aforo) || 1
					},
					mascot
				)} · ${durationLabel(locale, minutes)}`
			: ''
	);
</script>

<aside class="pv" aria-labelledby="pv-t">
	<p class="lbl" id="pv-t">{t(locale, 'adm.asis.preview')}</p>
	<div class="phone">
		<div class="who">
			<Mascot kind={mascot} size={56} />
			{#if sport}
				<div class="bub">
					<Bubble>{t(locale, 'adm.asis.preview_bub', { deporte: sport })}</Bubble>
				</div>
			{/if}
		</div>
		<p class="nome">{values.nome?.trim() || t(locale, 'adm.fac.preview_nome')}</p>
		{#if values.lugar?.trim()}<p class="sub">{values.lugar}</p>{/if}
		{#if firstDay >= 0}
			<div class="dias" aria-hidden="true">
				{#each [0, 1, 2] as i (i)}
					<span class:on={i === 0}>{t(locale, `adm.dia.${(firstDay + i) % 7}` as MessageKey)}</span>
				{/each}
			</div>
			<ul class="horas">
				{#each starts as s (s)}<li>{s.replace(/^0/, '')}</li>{/each}
			</ul>
		{:else}
			<p class="sub">{t(locale, 'adm.asis.preview_sen_horas')}</p>
		{/if}
		{#if how}<p class="sub pe">{how}</p>{/if}
	</div>
</aside>

<style>
	.pv {
		min-width: 0;
	}

	.lbl {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.phone {
		min-height: 320px;
		padding: 14px 14px 18px;
		border: 6px solid #e9e9ec;
		border-radius: 28px;
		box-shadow: 0 0 0 1px #c9c9cf;
		background: var(--branco);
	}

	.who {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		margin-bottom: 8px;
	}

	.bub :global(.bub) {
		margin: 0;
		font-size: 13px;
	}

	.nome {
		margin: 0;
		font-size: 18px;
		font-weight: 900;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.sub {
		margin: 3px 0 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.sub.pe {
		margin-top: 10px;
	}

	.dias {
		display: flex;
		gap: 4px;
		margin: 12px 0 6px;
	}

	.dias span {
		flex: 1;
		padding: 4px 0;
		border-radius: 7px;
		background: var(--ceo);
		font-size: 12px;
		font-weight: 800;
		text-align: center;
	}

	.dias span.on {
		background: var(--txt);
		color: var(--branco);
	}

	.horas {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.horas li {
		padding: 5px 0;
		border: 2px solid var(--txt);
		border-radius: 7px;
		font-size: 12px;
		font-weight: 800;
		text-align: center;
	}
</style>
