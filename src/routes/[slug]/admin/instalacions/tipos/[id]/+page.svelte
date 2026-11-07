<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import TipoForm from './TipoForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<!-- El estado del formulario nace con los datos: se recrea si la respuesta cambia -->
{#key form}
	<TipoForm {data} {form} />
{/key}
