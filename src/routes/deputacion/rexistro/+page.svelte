<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.rexistro.titulo')} · Deputación</title>
</svelte:head>
<section>
	<h1>{t(data.locale, 'adm.rexistro.titulo')}</h1>
	<form method="GET">
		<label for="concello">{t(data.locale, 'dep.admins.concello')}</label>
		<select id="concello" name="concello">
			{#each data.municipalities as municipality}
				<option value={municipality.id} selected={municipality.id === data.selected}
					>{municipality.name}</option
				>
			{/each}
		</select>
		<button type="submit">{t(data.locale, 'adm.rexistro.filtrar')}</button>
	</form>
	<ul>
		{#each data.entries as entry (entry.id)}
			<li>{entry.actorName}</li>
		{/each}
	</ul>
</section>
