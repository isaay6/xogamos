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
</style>
