<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const kinds = [
		'facility_saved',
		'hours_saved',
		'closure_created',
		'holiday_saved',
		'rules_saved',
		'staff_added',
		'notice_saved',
		'season_saved',
		'pass_sold',
		'booking_cancelled',
		'request_decided'
	];
	const sentence = (entry: PageData['entries'][number]) =>
		t(data.locale, `adm.rexistro.${entry.kind}` as never, {
			persoa: entry.actorName,
			...entry.params
		});
</script>

<svelte:head>
	<title
		>{t(data.locale, 'adm.rexistro.titulo')}{data.municipality
			? ` · ${data.municipality.name}`
			: ''}</title
	>
</svelte:head>

<section data-tour="rexistro">
	<h1>{t(data.locale, 'adm.rexistro.titulo')}</h1>
	<form method="GET">
		<label>
			{t(data.locale, 'adm.rexistro.tipo')}
			<select name="tipo">
				<option value="">{t(data.locale, 'adm.rexistro.todos')}</option>
				{#each kinds as kind}
					<option value={kind} selected={data.filters.kind === kind}
						>{t(data.locale, `adm.rexistro.tipo.${kind}` as never)}</option
					>
				{/each}
			</select>
		</label>
		<label>
			{t(data.locale, 'adm.rexistro.desde')}
			<input type="date" name="desde" value={data.filters.from} />
		</label>
		<label>
			{t(data.locale, 'adm.rexistro.ata')}
			<input type="date" name="ata" value={data.filters.to} />
		</label>
		<button type="submit">{t(data.locale, 'adm.rexistro.filtrar')}</button>
	</form>
	{#if data.entries.length}
		<ul>
			{#each data.entries as entry (entry.id)}
				<li>
					<time datetime={entry.createdAt.toISOString()}
						>{entry.createdAt.toLocaleString(data.locale)}</time
					>
					<span>{sentence(entry)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p>{t(data.locale, 'adm.rexistro.sen_entradas')}</p>
	{/if}
</section>
