<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Wizard from './Wizard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.asis.titulo')} · {data.municipality.name}</title>
</svelte:head>

<!-- Cada respuesta del servidor trae el paso y el estado: el asistente se vuelve a montar -->
{#key form}
	<Wizard
		locale={data.locale}
		municipalityName={data.municipality.name}
		listHref="/{data.municipality.slug}/admin/instalacions"
		paso={form?.paso ?? data.paso}
		values={form?.values ?? {}}
		errors={form?.errors ?? {}}
		issues={form && 'issues' in form ? (form.issues as { message: string }[]) : []}
		buildings={data.buildings}
		templates={data.templates}
	/>
{/key}
