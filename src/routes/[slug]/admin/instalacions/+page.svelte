<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { howText, pricesLabel } from './text';
	import { localDate } from '#lib/ui/closure-text.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/${data.municipality.slug}/admin/instalacions`);
	const typeOf = (id: string) => data.types.find((x) => x.id === id);
	const typeName = (id: string) => {
		const type = typeOf(id);
		return type ? (data.locale === 'es' ? type.nameEs : type.nameGl) : '';
	};
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.inst.titulo')} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<div>
		<p class="k">{t(data.locale, data.facilities.length === 1 ? 'adm.inst.k.un' : 'adm.inst.k', {
				n: data.facilities.length
			})}</p>
		<h1>{t(data.locale, 'adm.inst.titulo')}</h1>
	</div>
	<Button href="{base}/asistente" data-tour="nova-instalacion">{t(data.locale, 'adm.inst.nova')}</Button>
</header>

{#if data.facilities.length === 0}
	<p class="vacio">{t(data.locale, 'adm.inst.sen')}</p>
{:else}
	<p class="desliza" aria-hidden="true">{t(data.locale, 'taboa.desliza')}</p>
	<!-- Rexión desprazable: debe poder recibir o foco para moverse co teclado (WCAG 2.1.1). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="taboa" role="region" aria-label={t(data.locale, 'taboa.rexion')} tabindex="0">
		<table>
			<thead>
				<tr>
					<th scope="col">{t(data.locale, 'adm.inst.col.instalacion')}</th>
					<th scope="col">{t(data.locale, 'adm.inst.col.deporte')}</th>
					<th scope="col">{t(data.locale, 'adm.inst.col.como')}</th>
					<th scope="col">{t(data.locale, 'adm.inst.col.prezos')}</th>
					<th scope="col">{t(data.locale, 'adm.inst.col.estado')}</th>
					<th scope="col"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.facilities as f (f.id)}
					{@const type = typeOf(f.typeId)}
					<tr>
						<td>
							<span class="nome">
								<Mascot
									kind={type?.mascot ?? 'sala'}
									size={28}
									animated={false}
									color={type?.color}
								/>
								<span>
									{f.name}
									{#if f.location}<small>{f.location}</small>{/if}
								</span>
							</span>
						</td>
						<td>{typeName(f.typeId)}</td>
						<td>{howText(data.locale, f, type?.mascot ?? 'sala')}</td>
						<td>{pricesLabel(data.locale, f.priceResidentCents, f.priceNonResidentCents)}</td>
						<td>
							<span class="estado" class:off={!f.active}
								>{f.closure
									? localDate(data.locale, f.closure)
									: t(data.locale, f.active ? 'adm.inst.activa' : 'adm.inst.desactivada')}</span
							>
						</td>
						<td class="acc">
							<a
								href="{base}/{f.id}"
								aria-label={t(data.locale, 'adm.inst.editar_a', { nome: f.name })}
								>{t(data.locale, 'adm.inst.editar')}</a
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<section class="tipos">
	<header class="mh">
		<h2>{t(data.locale, 'adm.tipos.titulo')}</h2>
		<Button href="{base}/tipos/novo" variant="out">{t(data.locale, 'adm.tipos.novo')}</Button>
	</header>
	{#if data.types.length === 0}
		<p class="vacio">{t(data.locale, 'adm.tipos.sen')}</p>
	{:else}
		<ul>
			{#each data.types as type (type.id)}
				<li>
					<span class="nome">
						<Mascot kind={type.mascot} size={32} animated={false} color={type.color} />
						{data.locale === 'es' ? type.nameEs : type.nameGl}
						<small>{t(data.locale, `adm.modo.${type.bookingMode}`)}</small>
					</span>
					<a
						href="{base}/tipos/{type.id}"
						aria-label={t(data.locale, 'adm.tipos.editar_a', {
							nome: data.locale === 'es' ? type.nameEs : type.nameGl
						})}>{t(data.locale, 'adm.inst.editar')}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	/* Pista só en pantallas estreitas, onde a táboa non cabe */
	.desliza {
		display: none;
		margin: 6px 0 0;
		font-size: 13px;
		color: var(--texto-suave);
	}

	@media (max-width: 760px) {
		.desliza {
			display: block;
		}
	}

	.mh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 800;
		color: var(--gris);
	}

	h1,
	h2 {
		margin: 0;
		font-weight: 900;
	}

	h1 {
		font-size: 28px;
	}

	h2 {
		font-size: 20px;
	}

	.taboa {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--texto-suave);
	}

	th,
	td {
		padding: 10px;
		border-bottom: 1px solid var(--liña);
		font-weight: 700;
		vertical-align: middle;
	}

	.nome {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	small {
		display: block;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.estado {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		background: #d9f0e0;
		color: #14532d;
		font-size: 14px;
		font-weight: 800;
	}

	.estado.off {
		background: var(--ceo);
		color: var(--texto-suave);
	}

	.acc {
		text-align: right;
	}

	.acc a,
	li a {
		display: inline-grid;
		place-items: center;
		min-height: var(--toque);
		padding: 0 6px;
		color: var(--txt);
		font-weight: 800;
	}

	.tipos {
		margin-top: 32px;
		max-width: 620px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-bottom: 1px solid var(--liña);
		font-weight: 800;
	}

	li .nome small {
		margin-left: 4px;
		display: inline;
	}

	.vacio {
		color: var(--texto-suave);
		font-weight: 600;
	}
</style>
