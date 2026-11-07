<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { facilityLabel, localDateOfInstant, nounFor } from '#lib/ui/booking-text.js';
	import { formatDay, formatTime, monthName, monthYear } from '#lib/ui/format.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Item = (typeof data.months)[number]['items'][number];
	const STATES = ['proxima', 'feita', 'non_fuches', 'cancelada'] as const;

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const { mes, estado } = $derived(data.filters);
	// Con meses de más de un año, el chip lleva el año para no confundir.
	const years = $derived(new Set(data.monthOptions.map((m) => m.slice(0, 4))).size);

	/** Enlace con los filtros dados (sin JS: cada chip recarga la página). */
	function href(m: string | null, e: string | null): string {
		const q = new URLSearchParams();
		if (m) q.set('mes', m);
		if (e) q.set('estado', e);
		const s = q.toString();
		return `${base}/eu/historial${s ? `?${s}` : ''}`;
	}

	const title = (b: Item) => {
		const sport = locale === 'es' ? b.sportEs : b.sportGl;
		if (b.unitIndex === null) return sport;
		const noun = nounFor(b.bookingMode, b.mascot);
		return `${sport} · ${facilityLabel(locale, b.facilityName, b.unitIndex, noun)}`;
	};

	function when(b: Item): string {
		const f = formatDay(locale, localDateOfInstant(b.startsAt));
		return `${f.weekday} ${f.day} · ${formatTime(b.startsAt)}`;
	}

	/** Primera letra en mayúscula (el ::first-letter no se aplica a un enlace flex). */
	const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

	const count = (n: number) =>
		t(locale, n === 1 ? 'vec.historial.conta.un' : 'vec.historial.conta.varios', { n });
</script>

<svelte:head>
	<title>{t(locale, 'vec.historial.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="historial">
	<a class="volver" href="{base}/eu"
		><span aria-hidden="true">‹</span>{t(locale, 'vec.eu.volver')}</a
	>
	<h1>{t(locale, 'vec.historial.titulo')}</h1>

	<nav class="chips meses" aria-label={t(locale, 'vec.historial.filtro.mes')}>
		<a href={href(null, estado)} aria-current={mes === null ? 'true' : undefined}
			>{t(locale, 'vec.historial.todos_meses')}</a
		>
		{#each data.monthOptions as m (m)}
			<a href={href(m, estado)} aria-current={mes === m ? 'true' : undefined}
				>{cap(years > 1 ? monthYear(locale, m) : monthName(locale, m))}</a
			>
		{/each}
	</nav>
	<nav class="chips" aria-label={t(locale, 'vec.historial.filtro.estado')}>
		<a href={href(mes, null)} aria-current={estado === null ? 'true' : undefined}
			>{t(locale, 'vec.historial.todas')} <em>{data.counts.todas}</em></a
		>
		{#each STATES as s (s)}
			<a href={href(mes, s)} aria-current={estado === s ? 'true' : undefined}
				>{t(locale, `vec.historial.filtro.${s}` as MessageKey)} <em>{data.counts[s]}</em></a
			>
		{/each}
	</nav>

	{#if data.months.length === 0}
		<p class="baleiro">
			{t(locale, mes || estado ? 'vec.historial.baleiro_filtro' : 'vec.historial.baleiro')}
		</p>
	{:else}
		{#each data.months as group (group.month)}
			<h2 class="mon">
				<span class="nome">{monthYear(locale, group.month)}</span>
				<span class="n">{count(group.items.length)}</span>
			</h2>
			<ul class="lista">
				{#each group.items as b (b.id)}
					<li>
						<a class="fila" class:can={b.state === 'cancelada'} href="{base}/reserva/{b.id}">
							<Mascot kind={b.mascot} color={b.color} size={36} animated={false} />
							<span class="tx">
								<b>{title(b)}</b>
								<small>{when(b)}</small>
							</span>
							<span class="sc {b.state}"
								>{t(locale, `vec.historial.estado.${b.state}` as MessageKey)}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</main>

<style>
	.historial {
		padding: 12px 16px 24px;
	}

	.volver {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: var(--toque);
		font-size: 15px;
		font-weight: 800;
		color: var(--texto-suave);
		text-decoration: none;
	}

	h1 {
		margin: 4px 0 12px;
		font-size: 30px;
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	/* Dúas filas de chips: mes e estado (mockup B4, opción 1) */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 6px;
	}

	/* Os meses poden ser moitos: desprázanse en horizontal dentro da súa fila */
	.meses {
		flex-wrap: nowrap;
		overflow-x: auto;
		margin-right: -16px;
		padding-right: 16px;
	}

	.chips a {
		display: inline-flex;
		flex: none;
		align-items: center;
		min-height: var(--toque);
		padding: 0 12px;
		border-radius: 22px;
		background: var(--ceo);
		font-size: 14px;
		font-weight: 800;
		color: var(--txt);
		text-decoration: none;
		white-space: nowrap;
	}

	.chips a[aria-current='true'] {
		background: var(--txt);
		color: var(--branco);
	}

	.chips em {
		margin-left: 4px;
		font-style: normal;
		font-weight: 600;
	}

	.mon {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin: 18px 0 0;
		font-size: 15px;
		font-weight: 900;
	}

	.nome::first-letter {
		text-transform: uppercase;
	}

	.n {
		font-weight: 700;
		color: var(--gris);
	}

	.lista {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.fila {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--toque);
		padding: 10px 0;
		border-bottom: 2px solid var(--ceo);
		color: inherit;
		text-decoration: none;
	}

	.tx {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.tx b {
		font-size: 16px;
		font-weight: 900;
	}

	.tx small {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	/* Canceladas: riscadas e en gris */
	.can b {
		color: var(--gris);
		text-decoration: line-through;
	}

	.can :global(.mascot) {
		opacity: 0.45;
		filter: grayscale(1);
	}

	.sc {
		flex: none;
		padding: 4px 8px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 900;
	}

	.proxima {
		background: var(--foco);
		color: var(--txt);
	}

	.feita {
		background: #dbf0e1;
		color: #1d6b35;
	}

	.non_fuches {
		background: #f9dedb;
		color: var(--perigo);
	}

	.cancelada {
		background: var(--ceo);
		color: var(--texto-suave);
	}

	.baleiro {
		margin-top: 24px;
		font-weight: 600;
	}
</style>
