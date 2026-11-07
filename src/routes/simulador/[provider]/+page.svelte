<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	let { data } = $props();

	const name = $derived(data.provider === 'clave' ? 'Cl@ve' : 'Chave365');

	let query = $state('');
	const fold = (text: string) =>
		text
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	const others = $derived(
		query.trim()
			? data.others.filter((i) => fold(`${i.displayName} ${i.note}`).includes(fold(query.trim())))
			: data.others
	);
</script>

{#snippet identityList(list: typeof data.featured)}
	<ul class="lista">
		{#each list as identity (identity.subject)}
			<li>
				<form method="POST">
					<input type="hidden" name="state" value={data.state} />
					<input type="hidden" name="subject" value={identity.subject} />
					<input type="hidden" name="displayName" value={identity.displayName} />
					<button type="submit">
						<strong>{identity.displayName}</strong>
						<span>{identity.note}</span>
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/snippet}

<svelte:head>
	<title>Simulador de {name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<p class="aviso" role="note">Simulador de proba — non é {name} real</p>
	<h1>Entrar con {name}</h1>
	<p>Escolle unha identidade ficticia para continuar.</p>

	<h2>Persoas destacadas</h2>
	{@render identityList(data.featured)}

	<details class="mais">
		<summary>Máis persoas ({data.others.length})</summary>
		<label class="busca">
			Buscar por nome ou concello
			<input type="search" bind:value={query} autocomplete="off" />
		</label>
		{@render identityList(others)}
	</details>

	<h2>Ou escribe outra identidade</h2>
	<form method="POST" class="outra">
		<input type="hidden" name="state" value={data.state} />
		<label>
			Nome
			<input name="displayName" required maxlength="120" autocomplete="off" />
		</label>
		<label>
			DNI ficticio
			<input name="subject" required maxlength="64" autocomplete="off" placeholder="00000000T" />
		</label>
		<button type="submit">Entrar</button>
	</form>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.aviso {
		background: #fff3cd;
		border: 2px dashed #8a6d00;
		padding: 0.75rem 1rem;
		font-weight: 700;
	}
	.lista {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.lista button {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		text-align: left;
		cursor: pointer;
	}
	.lista span {
		color: #555;
		font-size: 0.875rem;
	}
	.mais {
		margin: 1.5rem 0;
	}
	.mais summary {
		cursor: pointer;
		font-weight: 700;
		padding: 0.5rem 0;
	}
	.busca {
		display: grid;
		gap: 0.25rem;
		margin: 0.5rem 0;
	}
	.outra {
		display: grid;
		gap: 0.75rem;
	}
	.outra label {
		display: grid;
		gap: 0.25rem;
	}
</style>
