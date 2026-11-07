<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { longDate } from '#lib/ui/format.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/admin/solicitudes`);
	const states = ['pendente', 'mais_datos', 'aprobada', 'rexeitada', 'retirada'] as const;
	const kinds = ['tempada', 'evento', 'outro'] as const;

	const statusLabel = (status: string) => t(locale, `vec.sol.estado.${status}` as MessageKey);
	const kindLabel = (kind: string) => t(locale, `vec.sol.tipo.${kind}` as MessageKey);
	const open = (status: string) => status === 'pendente' || status === 'mais_datos';

	function dates(request: { fromDate: string; toDate: string }) {
		if (request.fromDate === request.toDate) return longDate(locale, request.fromDate);
		return t(locale, 'adm.peche.rango', {
			desde: longDate(locale, request.fromDate),
			ata: longDate(locale, request.toDate)
		});
	}

	function who(row: { requesterName: string; entityName: string | null }) {
		return row.entityName
			? t(locale, 'adm.sol.pide_club', { persoa: row.requesterName, club: row.entityName })
			: t(locale, 'adm.sol.pide', { persoa: row.requesterName });
	}
</script>

<svelte:head>
	<title>{t(locale, 'adm.sol.titulo')} · {data.municipality.name}</title>
</svelte:head>

<h1>{t(locale, 'adm.sol.titulo')}</h1>
<p class="subtitulo">{t(locale, 'adm.sol.subtitulo')}</p>

<form method="GET" class="filtros">
	<label>
		{t(locale, 'adm.sol.estado')}
		<select name="estado">
			<option value="">{t(locale, 'adm.sol.todas')}</option>
			{#each states as state (state)}
				<option value={state} selected={data.filters.status === state}>{statusLabel(state)}</option>
			{/each}
		</select>
	</label>
	<label>
		{t(locale, 'adm.sol.tipo')}
		<select name="tipo">
			<option value="">{t(locale, 'adm.sol.todas')}</option>
			{#each kinds as kind (kind)}
				<option value={kind} selected={data.filters.kind === kind}>{kindLabel(kind)}</option>
			{/each}
		</select>
	</label>
	<Button type="submit" variant="out">{t(locale, 'adm.sol.filtros')}</Button>
</form>

{#if form && 'approved' in form}
	<p class="ok" role="status">{t(locale, 'adm.sol.ok_aprobada')}</p>
{:else if form && ('rejected' in form || 'asked' in form)}
	<p class="ok" role="status">{t(locale, 'adm.sol.ok_resposta')}</p>
{/if}
{#if form && 'error' in form}
	<p class="erro" role="alert">
		{form.error === 'CONFLICTS' ? t(locale, 'adm.sol.erro_conflitos') : t(locale, 'adm.sol.erro')}
	</p>
{/if}

<div class="split">
	<ul class="lista">
		{#each data.rows as row (row.request.id)}
			<li>
				<a
					class="ficha"
					class:actual={data.selected?.request.id === row.request.id}
					href={`${base}?id=${row.request.id}`}
				>
					<span class="cab">
						<b>{row.request.title}</b>
						<span class="estado {row.request.status}">{statusLabel(row.request.status)}</span>
					</span>
					<span class="meta">
						{kindLabel(row.request.kind)}{row.facilityName ? ` · ${row.facilityName}` : ''}
					</span>
					<span class="meta"
						>{dates(row.request)} · {row.request.startsTime}–{row.request.endsTime}</span
					>
					<span class="meta">{who(row)}</span>
				</a>
			</li>
		{:else}
			<li class="vacio">{t(locale, 'adm.sol.sen')}</li>
		{/each}
	</ul>

	{#if data.selected}
		{@const request = data.selected.request}
		<section class="detalle" aria-labelledby="sol-titulo">
			<a class="volver" href={base}>{t(locale, 'adm.sol.volver')}</a>
			<header>
				<h2 id="sol-titulo">{request.title}</h2>
				<span class="estado {request.status}">{statusLabel(request.status)}</span>
			</header>
			<p class="meta">
				{kindLabel(request.kind)}{data.selected.facilityName
					? ` · ${data.selected.facilityName}`
					: ''}
			</p>
			<p class="meta">{dates(request)} · {request.startsTime}–{request.endsTime}</p>
			<p class="meta">{who(data.selected)}</p>
			{#if request.people}
				<p class="meta">{t(locale, 'adm.sol.persoas', { n: request.people })}</p>
			{/if}
			{#if request.phone}
				<p class="meta">{t(locale, 'adm.sol.telefono', { tel: request.phone })}</p>
			{/if}
			{#if request.description}
				<p class="descricion">{request.description}</p>
			{/if}
			{#if request.response}
				<p class="resposta">{t(locale, 'adm.sol.resposta_actual', { texto: request.response })}</p>
			{/if}

			{#if open(request.status)}
				<p class:aviso={data.conflicts.length > 0}>
					{data.conflicts.length
						? t(locale, 'adm.sol.conflitos', { n: data.conflicts.length })
						: t(locale, 'adm.sol.sen_conflitos')}
				</p>

				<h3>{t(locale, 'adm.sol.decidir')}</h3>
				<form method="POST" action="?/aprobar" class="decision">
					<input type="hidden" name="id" value={request.id} />
					<label>
						{t(locale, 'adm.sol.resposta')}
						<textarea name="response" rows="2"></textarea>
					</label>
					{#if request.kind === 'evento' && data.conflicts.length}
						<label class="check">
							<input type="checkbox" name="cancelAffected" value="1" />
							{t(locale, 'adm.sol.cancelar', { n: data.conflicts.length })}
						</label>
					{/if}
					<Button type="submit">{t(locale, 'adm.sol.aprobar')}</Button>
				</form>
				<form method="POST" action="?/responder" class="decision">
					<input type="hidden" name="id" value={request.id} />
					<label>
						{t(locale, 'adm.sol.motivo')}
						<textarea name="message" rows="2" required></textarea>
					</label>
					<div class="botons">
						<Button type="submit" variant="out" name="decision" value="maisDatos">
							{t(locale, 'adm.sol.mais_datos')}
						</Button>
						<Button type="submit" variant="out" name="decision" value="rexeitar">
							{t(locale, 'adm.sol.rexeitar')}
						</Button>
					</div>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	h1 {
		margin: 0 0 4px;
		font-size: 28px;
		font-weight: 900;
	}
	h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 900;
	}
	h3 {
		margin: 20px 0 8px;
		font-size: 16px;
		font-weight: 900;
	}
	.subtitulo,
	.meta,
	.vacio {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}
	.filtros {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
		margin: 16px 0;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 700;
	}
	select,
	textarea {
		min-height: var(--toque);
		padding: 8px 10px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
	}
	.split {
		display: grid;
		grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 760px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.lista {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ficha {
		display: grid;
		gap: 4px;
		padding: 12px 14px;
		border: 2px solid transparent;
		border-radius: var(--radio);
		background: var(--ceo);
		color: inherit;
		text-decoration: none;
	}
	.ficha:hover,
	.ficha:focus-visible {
		border-color: var(--txt);
	}
	.ficha.actual {
		border-color: var(--txt);
	}
	.cab,
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.estado {
		display: inline-flex;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 800;
		background: var(--ceo-escuro, #e3e7ea);
	}
	.estado.pendente {
		background: #fff1c2;
		color: #6b4e00;
	}
	.estado.mais_datos {
		background: #e1ecfb;
		color: #1d4b8f;
	}
	.estado.aprobada {
		background: #d9f3df;
		color: #1f6a35;
	}
	.estado.rexeitada {
		background: #f5dedb;
		color: #8a2f23;
	}
	.detalle {
		display: grid;
		gap: 6px;
		padding: 16px;
		border-radius: var(--radio);
		background: var(--ceo);
	}
	.volver {
		font-weight: 700;
	}
	.descricion,
	.resposta {
		margin: 8px 0 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--branco);
	}
	.aviso {
		color: #8a2f23;
		font-weight: 800;
	}
	.decision {
		display: grid;
		gap: 8px;
		margin-bottom: 12px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.check input {
		width: 22px;
		height: 22px;
	}
	.botons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.ok {
		color: #1f7a3b;
		font-weight: 800;
	}
	.erro {
		color: var(--perigo);
		font-weight: 800;
	}
</style>
