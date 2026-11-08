<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const search = $derived(form && 'search' in form ? form.search : null);
	const confirm = $derived(form && 'confirm' in form ? form.confirm : null);
	const provider = (value: string) => t(data.locale, `dep.admins.provedor.${value}` as MessageKey);
</script>

<svelte:head>
	<title>{t(data.locale, 'dep.admins.titulo')} · Deputación</title>
</svelte:head>

<h1 data-tour="dep-admins">{t(data.locale, 'dep.admins.titulo')}</h1>
<p class="intro">{t(data.locale, 'dep.admins.intro')}</p>

{#if form && 'error' in form && form.error}
	<p class="erro" role="alert">{t(data.locale, `dep.admins.erro.${form.error}` as MessageKey)}</p>
{:else if form && 'added' in form}
	<p class="ok" role="status">{t(data.locale, 'dep.admins.engadido')}</p>
{:else if form && 'removed' in form}
	<p class="ok" role="status">{t(data.locale, 'dep.admins.quitado')}</p>
{/if}

{#if confirm}
	<section class="confirm" aria-labelledby="confirm-title">
		<h2 id="confirm-title">{t(data.locale, 'dep.admins.confirmar.titulo')}</h2>
		{#if confirm.kind === 'add'}
			<p>
				{t(data.locale, 'dep.admins.confirmar.engadir', {
					nome: confirm.candidate.displayName,
					concello: confirm.municipality
				})}
			</p>
			<form method="POST" action="?/engadir">
				<input type="hidden" name="municipalityId" value={confirm.municipalityId} />
				<input type="hidden" name="userId" value={confirm.candidate.userId} />
				<Button type="submit">{t(data.locale, 'dep.admins.confirmar.si')}</Button>
			</form>
		{:else if confirm.kind === 'identity'}
			<p>
				{t(data.locale, 'dep.admins.confirmar.engadir', {
					nome: confirm.identity.displayName,
					concello: confirm.municipality
				})}
			</p>
			<form method="POST" action="?/engadirIdentidade">
				<input type="hidden" name="municipalityId" value={confirm.municipalityId} />
				<input type="hidden" name="provider" value={confirm.identity.provider} />
				<input type="hidden" name="subject" value={confirm.identity.subject} />
				<input type="hidden" name="displayName" value={confirm.identity.displayName} />
				<Button type="submit">{t(data.locale, 'dep.admins.confirmar.si')}</Button>
			</form>
		{:else}
			<p>
				{t(data.locale, 'dep.admins.confirmar.quitar', {
					nome: confirm.admin.displayName,
					concello: confirm.municipality
				})}
			</p>
			<form method="POST" action="?/quitar">
				<input type="hidden" name="municipalityId" value={confirm.municipalityId} />
				<input type="hidden" name="roleId" value={confirm.admin.roleId} />
				<Button type="submit" variant="perigo">{t(data.locale, 'dep.admins.confirmar.si')}</Button>
			</form>
		{/if}
		<a href="/deputacion/administradores">{t(data.locale, 'dep.admins.confirmar.non')}</a>
	</section>
{:else}
	<section class="add" aria-labelledby="add-title">
		<h2 id="add-title">{t(data.locale, 'dep.admins.engadir')}</h2>
		<form method="POST" action="?/buscar" class="search" role="search">
			<label for="municipalityId">{t(data.locale, 'dep.admins.concello')}</label>
			<select id="municipalityId" name="municipalityId" required>
				<option value="">{t(data.locale, 'dep.admins.concello_escoller')}</option>
				{#each data.municipalities as municipality (municipality.id)}
					<option value={municipality.id} selected={search?.municipalityId === municipality.id}
						>{municipality.name}</option
					>
				{/each}
			</select>
			<label for="q">{t(data.locale, 'dep.admins.buscar')}</label>
			<div>
				<input id="q" name="q" type="search" value={search?.q ?? ''} autocomplete="off" />
				<Button type="submit" variant="out">{t(data.locale, 'dep.admins.buscar_boton')}</Button>
			</div>
		</form>

		{#if search && search.candidates.length === 0}
			<p class="vacio">{t(data.locale, 'dep.admins.sen_resultados')}</p>
		{/if}
		<ul>
			{#each search?.candidates ?? [] as candidate (candidate.userId)}
				<li>
					<span
						>{candidate.displayName}
						<small>{candidate.email ?? provider(candidate.provider)}</small></span
					>
					<form method="POST" action="?/preparar">
						<input type="hidden" name="municipalityId" value={search?.municipalityId} />
						<input type="hidden" name="userId" value={candidate.userId} />
						<Button type="submit" variant="out">{t(data.locale, 'dep.admins.dar')}</Button>
					</form>
				</li>
			{/each}
		</ul>

		<h3>{t(data.locale, 'dep.admins.identidade')}</h3>
		<form method="POST" action="?/prepararIdentidade" class="identity">
			<label for="identity-municipality">{t(data.locale, 'dep.admins.concello')}</label>
			<select id="identity-municipality" name="municipalityId" required>
				<option value="">{t(data.locale, 'dep.admins.concello_escoller')}</option>
				{#each data.municipalities as municipality (municipality.id)}
					<option value={municipality.id}>{municipality.name}</option>
				{/each}
			</select>
			<label for="displayName">{t(data.locale, 'dep.admins.nome')}</label>
			<input id="displayName" name="displayName" required />
			<label for="provider">{t(data.locale, 'dep.admins.provedor')}</label>
			<select id="provider" name="provider">
				<option value="clave">{t(data.locale, 'dep.admins.provedor.clave')}</option>
				<option value="chave365">{t(data.locale, 'dep.admins.provedor.chave365')}</option>
			</select>
			<label for="subject">{t(data.locale, 'dep.admins.id')}</label>
			<input id="subject" name="subject" required />
			<Button type="submit">{t(data.locale, 'dep.admins.continuar')}</Button>
		</form>
	</section>
{/if}

<section aria-labelledby="list-title">
	<h2 id="list-title">{t(data.locale, 'dep.admins.lista')}</h2>
	{#each data.municipalities as municipality (municipality.id)}
		<article>
			<h3>{municipality.name}</h3>
			{#if municipality.admins.length === 0}
				<p class="vacio">{t(data.locale, 'dep.admins.sen_admin')}</p>
			{:else}
				<ul>
					{#each municipality.admins as admin (admin.roleId)}
						<li>
							<span>{admin.displayName}</span>
							<form method="POST" action="?/prepararQuitar">
								<input type="hidden" name="municipalityId" value={municipality.id} />
								<input type="hidden" name="roleId" value={admin.roleId} />
								<Button type="submit" variant="perigo">{t(data.locale, 'dep.admins.quitar')}</Button
								>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	{/each}
</section>

<style>
	h1,
	h2,
	h3 {
		font-weight: 900;
	}

	h1 {
		margin: 0 0 8px;
		font-size: 28px;
	}

	h2 {
		margin: 0 0 12px;
		font-size: 20px;
	}

	h3 {
		margin: 20px 0 8px;
		font-size: 16px;
	}

	.intro,
	.vacio {
		color: var(--texto-suave);
		font-weight: 600;
	}

	.add,
	.confirm {
		max-width: 620px;
		margin: 28px 0;
		padding: 18px;
		border: 1px solid var(--liña);
		border-radius: var(--radio);
	}

	.search,
	.identity {
		display: grid;
		gap: 8px;
	}

	.search div {
		display: flex;
		gap: 8px;
	}

	input,
	select {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		font: inherit;
	}

	input[type='search'] {
		flex: 1;
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

	small {
		color: var(--gris);
		font-weight: 700;
	}

	.ok,
	.erro {
		font-weight: 800;
	}

	.erro {
		color: var(--perigo);
	}

	.confirm form {
		display: inline-block;
		margin-right: 12px;
	}
</style>
