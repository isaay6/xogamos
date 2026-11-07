<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>
<section>
	<h1>{t(data.locale, 'adm.rexistro.titulo')}</h1>
	<form method="GET">
		<select name="concello">
			{#each data.municipalities as municipality}
				<option value={municipality.id} selected={municipality.id === data.selected}>{municipality.name}</option>
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
