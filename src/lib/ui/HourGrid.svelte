<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '../i18n';
	import type { HourStatus } from './types';

	let {
		hours,
		selected = $bindable(null),
		name,
		locale = 'gl'
	}: {
		hours: HourStatus[];
		/** Hora elegida 'HH:MM' o null. */
		selected: string | null;
		/** Nombre del grupo de radio en el formulario. */
		name: string;
		locale?: Locale;
	} = $props();

	/** Nome accesible dunha hora que non se pode escoller: pechada (co motivo) ou completa. */
	function unavailable(h: HourStatus): string {
		if (h.past) return t(locale, 'hora.pasou', { hora: h.time });
		if (!h.closed) return t(locale, 'hora.completa', { hora: h.time });
		if (h.closed.reason.startsWith('Evento:')) return `${h.time}, ${h.closed.reason}`;
		return h.closed.reason
			? t(locale, 'hora.pechada', { hora: h.time, motivo: h.closed.reason })
			: t(locale, 'hora.pechada.sen_motivo', { hora: h.time });
	}
</script>

<!--
	Libre: borde oscuro. Elegida: relleno del color del deporte. Llena: gris tachado y disabled.
	Pechada: disabled, sen tachar, con «Pechada» e o motivo no nome accesible.
-->
<fieldset class="hours">
	<legend class="sr">{t(locale, 'hora.lenda')}</legend>
	{#each hours as h (h.time)}
		<label
			class="hour"
			class:oc={!h.free && !h.closed}
			class:pech={!!h.closed}
			class:on={h.free && selected === h.time}
		>
			<input
				type="radio"
				{name}
				value={h.time}
				bind:group={selected}
				disabled={!h.free}
				aria-label={h.free ? undefined : unavailable(h)}
			/>
			<span>{h.time}</span>
			{#if h.closed}
				<small aria-hidden="true">{h.closed.reason.startsWith('Evento:') ? h.closed.reason : t(locale, 'hora.pechada.curto')}</small>
			{:else if h.free && h.remainingSeats !== null}
				<small>{t(locale, 'hora.libres', { n: h.remainingSeats })}</small>
			{:else if h.past}
				<small aria-hidden="true">{t(locale, 'hora.pasou.curto')}</small>
			{/if}
		</label>
	{/each}
</fieldset>

<style>
	.hours {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
		gap: 8px;
	}

	.hour {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: var(--toque);
		padding: 6px 4px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font-size: 16px;
		font-weight: 800;
		cursor: pointer;
	}

	.hour small {
		font-size: 12px;
		font-weight: 600;
	}

	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.hour:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.hour.on {
		background: var(--deporte, var(--pista));
		border-color: var(--deporte, var(--pista));
		color: var(--deporte-txt, var(--txt));
	}

	/* Pechada: inactiva sen tachar; o fondo --ceo a distingue dunha completa */
	.hour.pech {
		border-color: var(--ceo);
		background: var(--ceo);
		color: var(--texto-suave);
		cursor: not-allowed;
	}

	/* Llena: inactiva, pero legible (--gris cumple 4.5:1 sobre blanco; el tachado la distingue) */
	.hour.oc {
		border-color: var(--liña);
		color: var(--gris);
		text-decoration: line-through;
		cursor: not-allowed;
	}
</style>
