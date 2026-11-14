<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';
	import Mascot from './Mascot.svelte';

	let {
		rows,
		locale
	}: {
		rows: { id: string; name: string; mascot: string; color: string; occupancy: number }[];
		locale: Locale;
	} = $props();

	const pct = (n: number) => Math.round(n * 100);
</script>

<div class="bars">
	{#each rows as r (r.id)}
		<div class="r">
			<span class="n"><Mascot kind={r.mascot} size={22} animated={false} />{r.name}</span>
			<div
				class="t"
				role="img"
				aria-label={t(locale, 'adm.ocupacion.valor', { nome: r.name, valor: pct(r.occupancy) })}
			>
				<i style:width="{pct(r.occupancy)}%" style:background={r.color}></i>
			</div>
			<span class="v" aria-hidden="true">{pct(r.occupancy)}%</span>
		</div>
	{/each}
</div>
<details class="taboa">
	<summary>{t(locale, 'adm.ocupacion.ver_taboa')}</summary>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="desliza" tabindex="0" role="region" aria-label={t(locale, 'adm.ocupacion.ver_taboa')}>
		<table>
			<thead
				><tr
					><th scope="col">{t(locale, 'adm.ocupacion.instalacion')}</th><th scope="col"
						>{t(locale, 'adm.ocupacion.porcentaxe')}</th
					></tr
				></thead
			>
			<tbody
				>{#each rows as r (r.id)}<tr><td>{r.name}</td><td>{pct(r.occupancy)}%</td></tr
					>{/each}</tbody
			>
		</table>
	</div>
</details>

<style>
	.r {
		display: grid;
		grid-template-columns: minmax(110px, 160px) 1fr 40px;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 13px;
		font-weight: 800;
	}

	.n {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.t {
		height: 14px;
		border-radius: 7px;
		background: var(--ceo);
		overflow: hidden;
	}

	.t i {
		display: block;
		height: 100%;
		border-radius: 7px;
	}

	.v {
		text-align: right;
	}
	.taboa summary {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		font-weight: 800;
		cursor: pointer;
	}
	.taboa table {
		border-collapse: collapse;
		width: 100%;
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
