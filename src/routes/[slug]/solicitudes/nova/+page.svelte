<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Valor inicial: o tipo da solicitude que se corrixe, ou «outro».
	let kind = $state(untrack(() => data.request?.kind ?? 'outro'));
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/solicitudes`);
	const errorText = $derived(
		form && 'error' in form
			? t(
					locale,
					`vec.sol.erro.${['NOT_FOUND', 'VALIDATION_FAILED'].includes(form.error) ? form.error : 'OTHER'}` as MessageKey
				)
			: null
	);
</script>

<svelte:head><title>{t(locale, 'vec.sol.nova')} · {data.municipality.name}</title></svelte:head>
<main class="formulario">
	<a href={base}>{t(locale, 'vec.sol.volver')}</a>
	<h1>{t(locale, 'vec.sol.nova')}</h1>
	{#if errorText}<p class="erro" role="alert">{errorText}</p>{/if}
	<form method="POST" action="?/gardar">
		{#if data.request}<input type="hidden" name="id" value={data.request.id} />{/if}
		<label
			>{t(locale, 'vec.sol.tipo')}<select name="kind" bind:value={kind}
				><option value="outro">{t(locale, 'vec.sol.tipo.outro')}</option><option value="evento"
					>{t(locale, 'vec.sol.tipo.evento')}</option
				><option value="tempada">{t(locale, 'vec.sol.tipo.tempada')}</option></select
			></label
		>
		{#if kind !== 'outro'}<label
				>{t(locale, 'vec.sol.instalacion')}<select name="facilityId" required
					><option value="">{t(locale, 'vec.sol.escolla')}</option
					>{#each data.facilities as facility (facility.id)}<option
							value={facility.id}
							selected={data.request?.facilityId === facility.id}>{facility.name}</option
						>{/each}</select
				></label
			>{/if}
		{#if kind === 'tempada'}<fieldset>
				{#if data.seasonPriorityCriteria}<p class="axuda">
						<b>{t(locale, 'vec.sol.criterios')}</b>
						{data.seasonPriorityCriteria}
					</p>{/if}
				<legend>{t(locale, 'vec.sol.dias')}</legend>{#each [0, 1, 2, 3, 4, 5, 6] as day}<label
						class="check"
						><input
							type="checkbox"
							name="weekdays"
							value={day}
							checked={data.request?.weekdays?.includes(day)}
						/>{t(locale, `vec.sol.dia.${day}` as MessageKey)}</label
					>{/each}
			</fieldset>{/if}
		<label
			>{t(locale, 'vec.sol.titulo_campo')}<input
				name="title"
				required
				value={data.request?.title ?? ''}
			/></label
		>
		<label
			>{t(locale, 'vec.sol.descricion')}<textarea name="description"
				>{data.request?.description ?? ''}</textarea
			></label
		>
		<div class="dous">
			<label
				>{t(locale, 'vec.sol.desde')}<input
					name="fromDate"
					type="date"
					required
					value={data.request?.fromDate ?? ''}
				/></label
			><label
				>{t(locale, 'vec.sol.ata')}<input
					name="toDate"
					type="date"
					required
					value={data.request?.toDate ?? ''}
				/></label
			>
		</div>
		<div class="dous">
			<label
				>{t(locale, 'vec.sol.inicio')}<input
					name="startsTime"
					type="time"
					required
					value={data.request?.startsTime ?? ''}
				/></label
			><label
				>{t(locale, 'vec.sol.fin')}<input
					name="endsTime"
					type="time"
					required
					value={data.request?.endsTime ?? ''}
				/></label
			>
		</div>
		<label
			>{t(locale, 'vec.sol.persoas')}<input
				name="people"
				type="number"
				min="1"
				value={data.request?.people ?? ''}
			/></label
		>
		<label
			>{t(locale, 'vec.sol.telefono')}<input
				name="phone"
				required
				value={data.request?.phone ?? ''}
			/></label
		>
		{#if data.entities.length > 0}<label
				>{t(locale, 'vec.sol.presenta')}<select name="entityId"
					><option value="">{t(locale, 'vec.sol.eu')}</option
					>{#each data.entities as entity (entity.id)}<option
							value={entity.id}
							selected={data.request?.entityId === entity.id}>{entity.name}</option
						>{/each}</select
				></label
			>{/if}
		<Button type="submit">{t(locale, data.request ? 'vec.sol.reenviar' : 'vec.sol.enviar')}</Button>
	</form>
</main>

<style>
	.formulario {
		max-width: 640px;
		padding: 12px 16px 24px;
	}
	h1 {
		margin: 10px 0 16px;
		font-size: 30px;
		font-weight: 900;
	}
	form {
		display: grid;
		gap: 14px;
	}
	label,
	fieldset {
		display: grid;
		gap: 5px;
		font-weight: 800;
	}
	input,
	select,
	textarea {
		min-height: 44px;
		padding: 8px;
		border: 2px solid var(--txt);
		border-radius: 8px;
		background: var(--branco);
		font: inherit;
	}
	textarea {
		min-height: 90px;
	}
	.dous {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	fieldset {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border: 0;
		padding: 0;
	}
	legend {
		grid-column: 1 / -1;
	}
	.check {
		display: flex;
		align-items: center;
		min-height: 44px;
	}
	.check input {
		min-height: auto;
	}
	.erro {
		color: var(--perigo);
	}
</style>
