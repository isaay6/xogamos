<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const f = $derived(
		(form ?? {}) as {
			erro?: 'NINGUN';
			empadroadoErro?: boolean;
			deixarErro?: 'NOT_FOLLOWED' | 'FUTURE_BOOKINGS' | 'ACTIVE_PASS';
		}
	);
	// Seguidos sen empadroamento verificado: os xa declarados amosan «pendente de comprobar» e o
	// resto, o botón para declaralo.
	const declarables = $derived(data.municipalities.filter((m) => m.checked && !m.isResident));
</script>

<svelte:head>
	<title>{t(locale, 'vec.concellos.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="concellos">
	<a class="volver" href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{t(locale, 'vec.concellos.titulo')}</h1>
	<p class="texto">{t(locale, 'vec.concellos.texto')}</p>

	{#if data.saved && !form}
		<p class="ok" role="status">{t(locale, 'vec.concellos.gardado')}</p>
	{/if}

	<section class="lista" aria-label={t(locale, 'vec.concellos.titulo')}>
		{#each data.municipalities as m (m.id)}
			<div class="conc">
				<Escudo municipality={m} width={28} />
				<span class="nome">
					<b>{m.name}</b>
					{#if m.checked && m.isResident}
						<small>{t(locale, 'vec.concellos.teu')}</small>
					{:else if m.checked && m.declared}
						<small class="tag">{t(locale, 'vec.pendente')}</small>
					{:else}
						<small>{m.province}</small>
					{/if}
				</span>
				{#if m.checked}
					<form method="POST" action="?/deixar" use:enhance>
						<input type="hidden" name="concello" value={m.id} />
						<Button type="submit" variant="out">{t(locale, 'vec.concellos.deixar')}</Button>
					</form>
				{:else}
					<form method="POST" action="?/unirse" use:enhance>
						<input type="hidden" name="concello" value={m.id} />
						<Button type="submit">{t(locale, 'vec.concellos.unirse')}</Button>
					</form>
				{/if}
			</div>
		{/each}
	</section>

	{#if f.deixarErro}
		<p class="erro" role="alert">{t(locale, `vec.concellos.deixar.${f.deixarErro}`)}</p>
	{/if}

	{#if declarables.length > 0}
		<section class="padron" aria-labelledby="padron-titulo">
			<h2 id="padron-titulo">{t(locale, 'vec.concellos.empadroamento')}</h2>
			<p class="nota">{t(locale, 'vec.benvida.empadroado.nota')}</p>
			{#if f.empadroadoErro}
				<p class="erro" role="alert">{t(locale, 'vec.benvida.empadroado.erro')}</p>
			{/if}
			{#each declarables as m (m.id)}
				{#if m.declared}
					<p class="feito">
						{t(locale, 'vec.benvida.empadroado.en', { concello: m.name })}
						<span class="tag">{t(locale, 'vec.pendente')}</span>
					</p>
				{:else}
					<form method="POST" action="?/declarar" use:enhance>
						<input type="hidden" name="concello" value={m.id} />
						<Button type="submit" variant="out"
							>{t(locale, 'vec.benvida.empadroado.en', { concello: m.name })}</Button
						>
					</form>
				{/if}
			{/each}
		</section>
	{/if}
</main>

<style>
	.concellos {
		padding: 12px 16px 24px;
	}

	.volver {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: inherit;
	}

	h1 {
		font-size: 28px;
	}

	h2 {
		font-size: 20px;
	}

	.texto {
		margin: 8px 0 14px;
		font-weight: 600;
		line-height: 1.35;
	}

	form {
		display: grid;
		gap: 12px;
		max-width: 480px;
	}

	.lista {
		display: grid;
		gap: 8px;
		max-width: 480px;
	}

	.conc {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 8px 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
		justify-content: space-between;
	}

	.nome {
		flex: 1;
		min-width: 0;
	}

	.nome b {
		display: block;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.nome small {
		font-weight: 600;
		color: var(--texto-suave);
	}

	.conc form { display: block; }

	.conc :global(button) {
		min-width: 100px;
	}

	.tag,
	.nome small.tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--foco);
		font-size: 13px;
		font-weight: 800;
		color: var(--txt);
	}

	.padron {
		display: grid;
		gap: 10px;
		max-width: 480px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 2px solid var(--ceo);
	}

	.nota {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.feito {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		font-weight: 800;
	}

	.erro {
		font-weight: 800;
		color: var(--perigo);
	}

	.ok {
		margin: 8px 0;
		padding: 10px 12px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}
</style>
