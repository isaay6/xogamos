<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import NoticeComposer from './NoticeComposer.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const base = $derived(`/${data.municipality.slug}/admin/avisos`);
	const values = $derived(form && 'values' in form ? (form.values ?? {}) : null);
	const initial = $derived(
		values
			? {
					id: values.id ?? '',
					title: values.title ?? '',
					body: values.body ?? '',
					from: values.from ?? '',
					to: values.to ?? ''
				}
			: data.editing
				? {
						id: data.editing.id,
						title: data.editing.title,
						body: data.editing.body,
						from: data.editing.from,
						to: data.editing.to ?? ''
					}
				: { id: '', title: '', body: '', from: data.today, to: '' }
	);
	// Escudo y color del concello para la vista previa (la cabecera los trae del layout).
	const look = $derived({
		slug: data.municipality.slug,
		name: data.municipality.name,
		primaryColor: data.municipality.primaryColor ?? '#9AA1A0',
		hasLogo: data.municipality.hasLogo,
		logoVersion: data.municipality.logoVersion ?? 0
	});
	const dateOf = (d: string) => {
		const [y, m, day] = d.split('-');
		return `${day}/${m}/${y}`;
	};
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.av.titulo')} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<h1>{t(data.locale, 'adm.av.titulo')}</h1>
	<p class="axuda">{t(data.locale, 'adm.av.axuda')}</p>
</header>

{#if form && 'published' in form}
	<p class="ok" role="status">{t(data.locale, 'adm.av.publicado')}</p>
{:else if form && 'saved' in form}
	<p class="ok" role="status">{t(data.locale, 'adm.av.gardado')}</p>
{:else if form && 'deleted' in form}
	<p class="ok" role="status">{t(data.locale, 'adm.av.quitado')}</p>
{:else if form && 'error' in form && form.error === 'NOT_FOUND'}
	<p class="erro" role="alert">{t(data.locale, 'adm.erro.NOT_FOUND')}</p>
{/if}

<section data-tour="avisos-compor">
	{#key initial}
		<NoticeComposer
			{initial}
			locale={data.locale}
			municipality={look}
			titleMax={data.titleMax}
			bodyMax={data.bodyMax}
			error={Boolean(form && 'error' in form && form.error === 'INVALID')}
			{base}
		/>
	{/key}
</section>

<section class="lista" aria-labelledby="av-lista-t">
	<h2 id="av-lista-t">{t(data.locale, 'adm.av.lista')}</h2>
	{#if data.notices.length === 0}
		<p class="axuda">{t(data.locale, 'adm.av.sen')}</p>
	{:else}
		<ul>
			{#each data.notices as n (n.id)}
				<li>
					<div class="txt">
						<span class="estado {n.state}"
							>{t(data.locale, `adm.av.estado.${n.state}` as MessageKey)}</span
						>
						<b>{n.title}</b>
						<small>
							{n.to
								? t(data.locale, 'adm.peche.rango', { desde: dateOf(n.from), ata: dateOf(n.to) })
								: t(data.locale, 'adm.av.rango_aberto', { desde: dateOf(n.from) })}
						</small>
					</div>
					<div class="accions">
						<Button
							href="{base}?editar={n.id}"
							variant="out"
							aria-label={t(data.locale, 'adm.av.editar_a', { titulo: n.title })}
							>{t(data.locale, 'adm.av.editar_btn')}</Button
						>
						<form method="POST" action="?/borrar">
							<input type="hidden" name="id" value={n.id} />
							<Button
								type="submit"
								variant="perigo"
								aria-label={t(data.locale, 'adm.av.quitar_a', { titulo: n.title })}
								>{t(data.locale, 'adm.peche.quitar')}</Button
							>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.mh {
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}

	h2 {
		margin: 0 0 8px;
		font-size: 20px;
		font-weight: 900;
	}

	.axuda {
		margin: 4px 0 0;
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

	.lista {
		margin-top: 32px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--liña);
	}

	.txt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		min-width: 0;
	}

	.txt small {
		flex-basis: 100%;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.estado {
		padding: 2px 10px;
		border-radius: 999px;
		border: 2px solid var(--txt);
		font-size: 14px;
		font-weight: 800;
	}

	.estado.activo {
		background: #dff3e5;
		border-color: var(--herba);
	}

	.estado.proximo {
		background: var(--foco);
		border-color: var(--foco);
	}

	.estado.caducado {
		border-color: var(--granito);
		color: var(--texto-suave);
	}

	.accions {
		display: flex;
		gap: 8px;
	}
</style>
