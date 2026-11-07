<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '../i18n';
	import { longDate, monthYear } from './format';
	import Mascot from './Mascot.svelte';

	let {
		locale,
		month,
		today,
		selected,
		days,
		href,
		prevHref,
		nextHref
	}: {
		locale: Locale;
		/** Mes que se pinta, 'YYYY-MM'. */
		month: string;
		/** Hoy en Europe/Madrid, 'YYYY-MM-DD': los días anteriores no se pueden tocar. */
		today: string;
		/** Día escogido, cuya agenda va debajo. */
		selected: string | null;
		/** Sellos de cada día con reservas: la mascota y el color de cada una. */
		days: Record<string, { mascot: string; color: string }[]>;
		/** Enlace de un día (sin JS: recarga con `?dia=`). */
		href: (date: string) => string;
		prevHref: string | null;
		nextHref: string | null;
	} = $props();

	const pad = (n: number) => String(n).padStart(2, '0');

	/** Huecos antes del día 1 (la semana empieza en lunes) y los días del mes. */
	const grid = $derived.by(() => {
		const [y, m] = month.split('-').map(Number);
		// El día de la semana de una fecha de calendario no depende de la zona: se calcula en UTC.
		const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
		const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
		return {
			lead,
			dates: Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)
		};
	});

	function label(date: string): string {
		const n = days[date]?.length ?? 0;
		// Hoy lo dice también el nombre, no solo el aro rojo.
		const data =
			date === today
				? `${t(locale, 'vec.dia.hoxe')}, ${longDate(locale, date)}`
				: longDate(locale, date);
		if (n === 0) return t(locale, 'vec.cal.dia', { data });
		return t(locale, n === 1 ? 'vec.cal.dia.un' : 'vec.cal.dia.varios', { data, n });
	}
</script>

<div class="mes">
	<div class="cab">
		{#if prevHref}
			<a class="frecha" href={prevHref} aria-label={t(locale, 'vec.cal.anterior')}
				><span aria-hidden="true">‹</span></a
			>
		{:else}
			<span class="frecha off" aria-hidden="true">‹</span>
		{/if}
		<h2>{monthYear(locale, month)}</h2>
		{#if nextHref}
			<a class="frecha" href={nextHref} aria-label={t(locale, 'vec.cal.seguinte')}
				><span aria-hidden="true">›</span></a
			>
		{:else}
			<span class="frecha off" aria-hidden="true">›</span>
		{/if}
	</div>

	<div class="grella dn" aria-hidden="true">
		{#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
			<span>{t(locale, `vec.cal.dn.${d}` as MessageKey)}</span>
		{/each}
	</div>

	<ol class="grella" aria-label={monthYear(locale, month)}>
		{#each { length: grid.lead }, i (i)}
			<li class="oco" aria-hidden="true"></li>
		{/each}
		{#each grid.dates as date (date)}
			{@const stamps = days[date] ?? []}
			{@const n = Number(date.slice(8))}
			<li>
				{#if date < today}
					<span class="dia pasado">{n}</span>
				{:else}
					<a
						class="dia"
						class:has={stamps.length > 0}
						class:hoxe={date === today}
						class:sel={date === selected}
						href={href(date)}
						aria-label={label(date)}
						aria-current={date === selected ? 'true' : undefined}
					>
						<span aria-hidden="true">{n}</span>
						{#if stamps.length > 0}
							<span class="selos">
								{#each stamps.slice(0, 2) as s, i (i)}
									<Mascot kind={s.mascot} color={s.color} size={22} animated={false} />
								{/each}
							</span>
						{/if}
					</a>
				{/if}
			</li>
		{/each}
	</ol>
</div>

<style>
	.cab {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 12px 0 8px;
	}

	h2 {
		font-size: 22px;
		font-weight: 900;
	}

	h2::first-letter {
		text-transform: uppercase;
	}

	.frecha {
		display: grid;
		place-items: center;
		width: var(--toque);
		height: var(--toque);
		border-radius: var(--radio);
		font-size: 24px;
		font-weight: 900;
		color: var(--txt);
		text-decoration: none;
	}

	.frecha.off {
		color: var(--apagado);
	}

	.grella {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
		text-align: center;
	}

	.dn {
		margin-bottom: 4px;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
	}

	.dia {
		position: relative;
		display: block;
		height: 50px;
		padding-top: 4px;
		border-radius: var(--radio);
		font-size: 15px;
		font-weight: 800;
		color: var(--txt);
		text-decoration: none;
	}

	.pasado {
		font-weight: 600;
		color: var(--gris);
	}

	.has {
		background: var(--ceo);
	}

	.hoxe {
		box-shadow: inset 0 0 0 2px var(--perigo);
		color: var(--perigo);
	}

	.sel {
		background: var(--txt);
		color: var(--branco);
	}

	.selos {
		position: absolute;
		right: 0;
		bottom: 3px;
		left: 0;
		display: flex;
		justify-content: center;
	}

	.selos :global(.mascot) {
		margin: 0 -4px;
	}
</style>
