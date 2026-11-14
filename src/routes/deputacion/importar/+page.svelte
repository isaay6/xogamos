<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import type { PageProps } from './$types';
	let { form }: PageProps = $props();
</script>

<svelte:head><title>Importar configuración</title></svelte:head>
<main>
	<p class="k">Deputación</p>
	<h1>Importar configuración / Importar configuración</h1>
	<p>
		Créase un concello novo. Só se importan axustes, tipos, instalacións, horarios, peches futuros e
		festivos; nunca persoas, perfís nin reservas.
	</p>
	{#if form?.error}<p role="alert">{form.error}</p>{/if}
	<form method="POST" enctype="multipart/form-data">
		<label>Nome / Nombre <input name="name" required maxlength="200" /></label><label
			>Slug <input name="slug" required pattern="[a-z0-9-]+" maxlength="80" /></label
		><label
			>Exportación JSON <input
				name="file"
				type="file"
				accept="application/json,.json"
				required
			/></label
		><button>Importar</button>
	</form>
</main>

<style>
	main {
		max-width: 650px;
		margin: 32px auto;
		padding: 16px;
	}
	label {
		display: block;
		margin: 14px 0;
	}
	input {
		display: block;
		width: 100%;
	}
	.k {
		font-weight: 800;
	}
</style>
