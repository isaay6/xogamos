<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>Documentación da API</title></svelte:head>
<main>
	<p class="k">API REST · OpenAPI 3.1</p>
	<h1>Documentación da API</h1>
	<p>Referencia xerada no servidor. <a href="/api/v1/openapi.json">Abrir openapi.json</a></p>
	{#each data.endpoints as endpoint (`${endpoint.method} ${endpoint.path}`)}
		<section>
			<h2><code>{endpoint.method}</code> <code>{endpoint.path}</code></h2>
			<p>{endpoint.summary}</p>
			{#if endpoint.parameters?.length}
				<h3>Parámetros</h3><ul>{#each endpoint.parameters as parameter}<li><code>{parameter.name}</code> ({parameter.in}){parameter.required ? ', obrigatorio' : ''}</li>{/each}</ul>
			{/if}
			<h3>Respostas</h3><ul>{#each Object.entries(endpoint.responses) as [status, response]}<li><code>{status}</code> {(response as any).description}</li>{/each}</ul>
		</section>
	{/each}
</main>
<style>
	main { max-width: 900px; margin: 32px auto; padding: 0 16px; }
	section { border-top: 1px solid var(--line, #ccd); padding: 16px 0; }
	code { font-weight: 700; }
	.k { font-weight: 800; }
</style>
