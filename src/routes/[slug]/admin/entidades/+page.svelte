<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import { formatEuros } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	type Entity = (typeof data.entities)[number];
	type PriceMode = 'normal' | 'free' | 'fixed';
	let edit = $state<Entity | null>(null);
	let priceMode = $state<PriceMode>('normal');
	let fixedPriceEuros = $state('');
	const search = $derived(form && 'responsibleSearch' in form ? form.responsibleSearch : null);

	function startEdit(entity: Entity | null) {
		edit = entity;
		priceMode = entity?.priceMode ?? 'normal';
		fixedPriceEuros = entity?.fixedPriceCents == null ? '' : String(entity.fixedPriceCents / 100);
	}
	const cents = () => {
		const value = Number(fixedPriceEuros.replace(',', '.'));
		return Number.isFinite(value) && value >= 0 ? String(Math.round(value * 100)) : '';
	};
	function summary(entity: Entity) {
		const price =
			entity.priceMode === 'free'
				? t(data.locale, 'adm.entidades.resumo.gratis')
				: entity.priceMode === 'fixed'
					? t(data.locale, 'adm.entidades.resumo.fixo', {
							prezo: formatEuros(entity.fixedPriceCents ?? 0, data.locale)
						})
					: t(data.locale, 'adm.entidades.resumo.normal');
		return [
			price,
			entity.advanceDays == null
				? null
				: t(data.locale, 'adm.entidades.resumo.adianto', { n: entity.advanceDays }),
			entity.maxActiveBookings == null
				? null
				: t(data.locale, 'adm.entidades.resumo.activas', { n: entity.maxActiveBookings }),
			entity.maxConsecutiveSlots == null
				? null
				: t(data.locale, 'adm.entidades.resumo.seguidas', { n: entity.maxConsecutiveSlots }),
			t(
				data.locale,
				entity.noShowsCount ? 'adm.entidades.resumo.faltas' : 'adm.entidades.resumo.sen_faltas'
			)
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

<svelte:head
	><title>{t(data.locale, 'adm.entidades.titulo')} · {data.municipality.name}</title></svelte:head
>
<h1>{t(data.locale, 'adm.entidades.titulo')}</h1>
{#if form && 'error' in form && form.error}
	<p class="erro" role="alert">{t(data.locale, `adm.erro.${form.error}` as MessageKey)}</p>
{:else if form && 'saved' in form && form.saved}
	<p class="ok" role="status">{t(data.locale, 'adm.gardado')}</p>
{/if}
<div class="cab">
	<p>{t(data.locale, 'adm.entidades.entrada')}</p>
	<Button type="button" onclick={() => startEdit(null)}
		>{t(data.locale, 'adm.entidades.nova')}</Button
	>
</div>
<div class="lista">
	{#each data.entities as entity (entity.id)}
		<article>
			<header>
				<span class="sigla">{entity.shortName}</span>
				<div>
					<h2>{entity.name}</h2>
					<span class:activa={entity.active} class:inactiva={!entity.active} class="estado"
						>{entity.active
							? t(data.locale, 'adm.entidades.activa')
							: t(data.locale, 'adm.entidades.inactiva')}</span
					>
				</div>
			</header>
			<p class="resumo">{summary(entity)}</p>
			<h3>{t(data.locale, 'adm.entidades.responsables')}</h3>
			{#if entity.members.length === 0}<p class="vacio">
					{t(data.locale, 'adm.entidades.sen_responsables')}
				</p>{:else}<ul>
					{#each entity.members as member (member.userId)}<li>
							<span>{member.name}</span>
							<form method="POST" action="?/quitarResponsable">
								<input type="hidden" name="entityId" value={entity.id} /><input
									type="hidden"
									name="userId"
									value={member.userId}
								/><Button type="submit" variant="out"
									>{t(data.locale, 'adm.entidades.quitar_responsable')}</Button
								>
							</form>
						</li>{/each}
				</ul>{/if}
			<details>
				<summary>{t(data.locale, 'adm.entidades.buscar_responsable')}</summary>
				<form
					method="POST"
					action="?/buscarResponsable"
					class="busca"
					use:enhance={() =>
						async ({ update }) => {
							await update({ reset: false });
						}}
				>
					<input type="hidden" name="entityId" value={entity.id} /><label for="q-{entity.id}"
						>{t(data.locale, 'adm.entidades.buscar_responsable')}</label
					>
					<div>
						<input
							id="q-{entity.id}"
							name="q"
							type="search"
							value={search?.entityId === entity.id ? search.q : ''}
							autocomplete="off"
						/><Button type="submit" variant="out">{t(data.locale, 'adm.entidades.buscar')}</Button>
					</div>
				</form>
				{#if search?.entityId === entity.id}{#if search.candidates.length === 0}<p class="vacio">
							{t(data.locale, 'adm.entidades.sen_resultados')}
						</p>{/if}
					<ul>
						{#each search.candidates as candidate (candidate.userId)}<li>
								<span>{candidate.displayName}</span>
								<form method="POST" action="?/engadirResponsable">
									<input type="hidden" name="entityId" value={entity.id} /><input
										type="hidden"
										name="userId"
										value={candidate.userId}
									/><Button type="submit" variant="out"
										>{t(data.locale, 'adm.entidades.engadir_responsable')}</Button
									>
								</form>
							</li>{/each}
					</ul>{/if}
			</details>
			<footer>
				<Button type="button" variant="out" onclick={() => startEdit(entity)}
					>{t(data.locale, 'adm.entidades.editar')}</Button
				>
				<form method="POST" action="?/activar">
					<input type="hidden" name="id" value={entity.id} /><input
						type="hidden"
						name="active"
						value={String(!entity.active)}
					/><Button type="submit" variant={entity.active ? 'perigo' : 'out'}
						>{entity.active
							? t(data.locale, 'adm.entidades.desactivar')
							: t(data.locale, 'adm.entidades.activar')}</Button
					>
				</form>
			</footer>
		</article>
	{/each}
</div>
<section class="editor">
	<h2>{edit ? t(data.locale, 'adm.entidades.editar') : t(data.locale, 'adm.entidades.nova')}</h2>
	<form method="POST" action="?/gardar" use:enhance>
		<input type="hidden" name="id" value={edit?.id ?? ''} />
		<fieldset>
			<legend>{t(data.locale, 'adm.entidades.datos')}</legend><label
				>{t(data.locale, 'adm.entidades.nome')}<input
					name="name"
					required
					maxlength="120"
					value={edit?.name ?? ''}
				/></label
			><label
				>{t(data.locale, 'adm.entidades.sigla')}<input
					name="shortName"
					minlength="2"
					maxlength="3"
					required
					value={edit?.shortName ?? ''}
				/></label
			><label
				>{t(data.locale, 'adm.entidades.telefono')}<input
					name="phone"
					type="tel"
					maxlength="40"
					value={edit?.phone ?? ''}
				/></label
			>
		</fieldset>
		<fieldset>
			<legend>{t(data.locale, 'adm.entidades.condicions')}</legend><label
				>{t(data.locale, 'adm.entidades.prezo')}<select name="priceMode" bind:value={priceMode}
					><option value="normal">{t(data.locale, 'adm.entidades.normal')}</option><option
						value="free">{t(data.locale, 'adm.entidades.gratis')}</option
					><option value="fixed">{t(data.locale, 'adm.entidades.fixo')}</option></select
				></label
			>{#if priceMode === 'fixed'}<label
					>{t(data.locale, 'adm.entidades.prezo_euros')}<input
						type="number"
						min="0"
						step="0.01"
						inputmode="decimal"
						bind:value={fixedPriceEuros}
						required
					/></label
				>{/if}<input
				type="hidden"
				name="fixedPriceCents"
				value={priceMode === 'fixed' ? cents() : ''}
			/><label
				>{t(data.locale, 'adm.entidades.adianto')}<input
					type="number"
					min="0"
					name="advanceDays"
					value={edit?.advanceDays ?? ''}
				/></label
			><label
				>{t(data.locale, 'adm.entidades.maximas')}<input
					type="number"
					min="1"
					name="maxActiveBookings"
					value={edit?.maxActiveBookings ?? ''}
				/></label
			><label
				>{t(data.locale, 'adm.entidades.maximas_seguidas')}<input
					type="number"
					min="1"
					name="maxConsecutiveSlots"
					value={edit?.maxConsecutiveSlots ?? ''}
				/></label
			><label class="check"
				><input type="checkbox" name="noShowsCount" checked={edit?.noShowsCount ?? true} />{t(
					data.locale,
					'adm.entidades.faltas'
				)}</label
			>
			<div class="instalacions">
				<span>{t(data.locale, 'adm.entidades.instalacions')}</span
				>{#each data.facilities as facility (facility.id)}<label class="check"
						><input
							type="checkbox"
							name="facilityId"
							value={facility.id}
							checked={edit?.facilityIds.includes(facility.id)}
						/>{facility.name}</label
					>{/each}
			</div>
		</fieldset>
		<Button type="submit">{t(data.locale, 'adm.entidades.gardar')}</Button>
	</form>
</section>

<style>
	h1,
	h2,
	h3 {
		margin: 0;
		font-weight: 900;
	}
	h1 {
		margin-bottom: 12px;
		font-size: 28px;
	}
	h2 {
		font-size: 20px;
	}
	h3 {
		margin-top: 16px;
		font-size: 15px;
	}
	.cab,
	header,
	footer,
	li,
	.busca div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.cab {
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.cab p,
	.resumo,
	.vacio {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}
	.lista {
		display: grid;
		gap: 12px;
		max-width: 720px;
	}
	article,
	.editor {
		padding: 16px;
		border-radius: var(--radio);
		background: var(--ceo);
	}
	header {
		align-items: flex-start;
	}
	.sigla {
		display: grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0 8px;
		border-radius: 12px;
		background: var(--txt);
		color: var(--branco);
		font-weight: 900;
	}
	.estado {
		display: inline-flex;
		margin-top: 4px;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 800;
	}
	.activa {
		background: #d9f3df;
		color: #1f6a35;
	}
	.inactiva {
		background: #f5dedb;
		color: #8a2f23;
	}
	.resumo {
		margin-top: 12px;
		line-height: 1.4;
	}
	ul {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--liña);
		font-weight: 700;
	}
	details {
		margin-top: 8px;
	}
	summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		cursor: pointer;
	}
	.busca {
		margin-top: 8px;
	}
	.busca label {
		display: block;
		margin-bottom: 4px;
		font-weight: 800;
	}
	.busca input {
		flex: 1;
	}
	footer {
		justify-content: flex-end;
		margin-top: 14px;
	}
	.editor {
		max-width: 720px;
		margin-top: 24px;
	}
	.editor form {
		display: grid;
		gap: 16px;
		margin-top: 12px;
	}
	fieldset {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		min-width: 0;
		padding: 14px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
	}
	legend {
		padding: 0 5px;
		font-weight: 900;
	}
	label {
		display: grid;
		gap: 5px;
		font-weight: 800;
	}
	input,
	select {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--toque);
		padding: 0 10px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		font: inherit;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
	}
	.check input {
		width: 20px;
		min-height: 20px;
	}
	.instalacions {
		display: grid;
		grid-column: 1/-1;
		gap: 6px;
	}
	.instalacions > span {
		font-weight: 800;
	}
	.ok,
	.erro {
		margin: 0 0 14px;
		font-weight: 800;
	}
	.ok {
		color: #1f7a3b;
	}
	.erro {
		color: var(--perigo);
	}
</style>
