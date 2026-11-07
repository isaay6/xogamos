<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const busca = $derived(form && 'busca' in form ? form.busca : null);
	const roles = ['conserxe', 'apertura', 'admin'] as const;
	const provider = (p: string) => (p === 'clave' ? 'Cl@ve' : 'Chave365');
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.persoal.titulo')} · {data.municipality.name}</title>
</svelte:head>

<h1>{t(data.locale, 'adm.persoal.titulo')}</h1>

{#if form && 'error' in form && form.error}
	<p class="erro" role="alert">
		{t(data.locale, `adm.erro.${form.error}` as MessageKey)}
	</p>
{:else if form && 'removed' in form}
	<p class="ok" role="status">{t(data.locale, 'adm.persoal.quitado')}</p>
{:else if form && 'added' in form}
	<p class="ok" role="status">{t(data.locale, 'adm.persoal.engadido')}</p>
{/if}

<table data-tour="persoal">
	<thead>
		<tr>
			<th>{t(data.locale, 'adm.persoal.nome')}</th>
			<th>{t(data.locale, 'adm.persoal.rol')}</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.staff as s (s.roleId)}
			<tr>
				<td>{s.displayName}</td>
				<td>{t(data.locale, `adm.rol.${s.role}` as MessageKey)}</td>
				<td class="acc">
					<!-- Dous pasos sen JS: «Quitar» abre a confirmación e só esta envía o formulario. -->
					<details class="quitar">
						<summary aria-label={t(data.locale, 'adm.persoal.quitar_a', { nome: s.displayName })}
							>{t(data.locale, 'adm.persoal.quitar')}</summary
						>
						<form method="POST" action="?/quitar">
							<input type="hidden" name="roleId" value={s.roleId} />
							<p>{t(data.locale, 'adm.persoal.quitar.pregunta', { nome: s.displayName })}</p>
							<Button type="submit" variant="perigo"
								>{t(data.locale, 'adm.persoal.quitar.si')}</Button
							>
						</form>
					</details>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<section class="engadir">
	<h2>{t(data.locale, 'adm.persoal.engadir')}</h2>
	<form
		method="POST"
		action="?/buscar"
		class="busca"
		role="search"
		use:enhance={() =>
			async ({ update }) => {
				await update({ reset: false });
			}}
	>
		<label for="q">{t(data.locale, 'adm.persoal.buscar')}</label>
		<div>
			<input id="q" name="q" type="search" value={busca?.q ?? ''} autocomplete="off" />
			<Button type="submit" variant="out">{t(data.locale, 'adm.persoal.buscar_boton')}</Button>
		</div>
	</form>

	{#if busca && busca.candidates.length === 0}
		<p class="vacio">{t(data.locale, 'adm.persoal.sen_resultados')}</p>
	{/if}
	<ul>
		{#each busca?.candidates ?? [] as c (c.userId)}
			<li>
				<span>{c.displayName} <small>{provider(c.provider)}</small></span>
				<form method="POST" action="?/engadir">
					<input type="hidden" name="userId" value={c.userId} />
					{#each roles as r (r)}
						<Button type="submit" variant="out" name="role" value={r}
							>{t(data.locale, 'adm.persoal.dar', {
								rol: t(data.locale, `adm.rol.${r}` as MessageKey)
							})}</Button
						>
					{/each}
				</form>
			</li>
		{/each}
	</ul>
	<h3>{t(data.locale, 'adm.persoal.identidade')}</h3>
	<form method="POST" action="?/engadirIdentidade" class="busca">
		<label for="displayName">{t(data.locale, 'adm.persoal.nome')}</label>
		<input id="displayName" name="displayName" required />
		<label for="provider">{t(data.locale, 'adm.persoal.provedor')}</label>
		<select id="provider" name="provider"
			><option value="clave">Cl@ve</option><option value="chave365">Chave365</option></select
		>
		<label for="subject">{t(data.locale, 'adm.persoal.id')}</label>
		<input id="subject" name="subject" required />
		{#each roles as r (r)}
			<Button type="submit" variant="out" name="role" value={r}
				>{t(data.locale, 'adm.persoal.dar', {
					rol: t(data.locale, `adm.rol.${r}` as MessageKey)
				})}</Button
			>
		{/each}
	</form>
</section>

<style>
	.quitar summary {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--radio);
		color: var(--perigo);
		font-weight: 700;
		cursor: pointer;
	}

	.quitar form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-end;
		margin-top: 6px;
	}

	.quitar p {
		margin: 0;
		max-width: 260px;
		text-align: right;
	}

	h1 {
		margin: 0 0 16px;
		font-size: 28px;
		font-weight: 900;
	}

	h2 {
		margin: 0 0 8px;
		font-size: 20px;
		font-weight: 900;
	}

	table {
		width: 100%;
		max-width: 620px;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--gris);
	}

	th,
	td {
		padding: 8px 10px;
		border-bottom: 1px solid var(--liña);
		font-weight: 700;
	}

	.acc {
		text-align: right;
	}

	.engadir {
		max-width: 620px;
		margin-top: 28px;
	}

	.busca label {
		display: block;
		margin-bottom: 6px;
		font-weight: 800;
	}

	.busca div {
		display: flex;
		gap: 8px;
	}

	input[type='search'] {
		flex: 1;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		font: inherit;
	}

	ul {
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid var(--liña);
		font-weight: 800;
	}

	li form {
		display: flex;
		gap: 6px;
	}

	small {
		color: var(--gris);
		font-weight: 700;
	}

	.vacio {
		color: var(--texto-suave);
		font-weight: 600;
	}

	.ok,
	.erro {
		margin: 0 0 14px;
		font-weight: 800;
	}

	.erro {
		color: var(--perigo);
	}
</style>
