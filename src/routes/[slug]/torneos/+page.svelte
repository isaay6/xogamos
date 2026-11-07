<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatEuros, longDate } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/torneos`);

	function dates(startsOn: string, endsOn: string) {
		if (startsOn === endsOn) return longDate(locale, startsOn);
		return t(locale, 'vec.torneo.datas', {
			desde: longDate(locale, startsOn),
			ata: longDate(locale, endsOn)
		});
	}
</script>

<svelte:head>
	<title>{t(locale, 'vec.torneo.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="torneos">
	<h1>{t(locale, 'vec.torneo.proximos')}</h1>
	<p class="subtitulo">{t(locale, 'vec.torneo.subtitulo')}</p>

	{#if data.rows.length === 0}
		<div class="baleiro">
			<Mascot kind="sala" mood="triste" size={72} />
			<p>{t(locale, 'vec.torneo.baleiro')}</p>
		</div>
	{:else}
		<ul>
			{#each data.rows as row (row.tournament.id)}
				{@const left = row.tournament.maxEntries - Number(row.entries)}
				<li>
					<a href={`${base}/${row.tournament.id}`} style="--deporte: {row.color}">
						<Mascot kind={row.mascot} color={row.color} size={56} />
						<span class="texto">
							<b>{row.tournament.title}</b>
							<span
								>{row.facilityName} · {dates(row.tournament.startsOn, row.tournament.endsOn)}</span
							>
							<span class="detalles">
								<span class="chip" class:esgotado={left <= 0}>
									{left > 0
										? t(locale, 'vec.torneo.prazas', { n: left })
										: t(locale, 'vec.torneo.cheo')}
								</span>
								<span class="chip">
									{row.tournament.feeCents > 0
										? formatEuros(row.tournament.feeCents, locale)
										: t(locale, 'vec.torneo.de_balde')}
								</span>
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.torneos {
		max-width: 720px;
		padding: 12px 16px 24px;
	}
	h1 {
		margin: 8px 0 4px;
		font-size: 28px;
		font-weight: 900;
	}
	.subtitulo {
		margin: 0 0 16px;
		color: var(--texto-suave);
		font-weight: 600;
	}
	ul {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
		border: 2px solid transparent;
		border-radius: var(--radio);
		background: var(--ceo);
		color: inherit;
		text-decoration: none;
	}
	a:hover,
	a:focus-visible {
		border-color: var(--deporte, var(--txt));
	}
	.texto {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.texto b {
		font-size: 18px;
		font-weight: 900;
	}
	.texto > span {
		color: var(--texto-suave);
		font-weight: 600;
	}
	.detalles {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
	}
	.chip {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--branco);
		color: var(--txt);
		font-size: 13px;
		font-weight: 800;
	}
	.chip.esgotado {
		background: #f5dedb;
		color: #8a2f23;
	}
	.baleiro {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 24px;
		text-align: center;
		font-weight: 700;
	}
</style>
