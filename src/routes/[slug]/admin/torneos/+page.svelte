<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const base = $derived(`/${data.municipality.slug}`);
	const errorKey = $derived.by(() => {
		if (!form || !('error' in form)) return null;
		const keys: Record<string, MessageKey> = {
			FEE_LOCKED: 'adm.torneo.erro_prezo_bloqueado',
			MAX_BELOW_ENTRIES: 'adm.torneo.erro_max_baixo',
			DEADLINE_INVALID: 'adm.torneo.erro_data_limite'
		};
		return form.error ? (keys[form.error] ?? null) : null;
	});
</script>

<svelte:head>
	<title
		>{t(data.locale, 'adm.torneo.titulo')}{data.municipality
			? ` · ${data.municipality.name}`
			: ''}</title
	>
</svelte:head>

<h1>{t(data.locale, 'adm.torneo.titulo')}</h1>
{#if errorKey}<p role="alert">{t(data.locale, errorKey)}</p>{/if}
<form method="POST" action="?/crear" class="formulario">
	<label>{t(data.locale, 'adm.torneo.campo.titulo')}<input name="title" required /></label>
	<label
		>{t(data.locale, 'adm.torneo.campo.deporte')}<input name="sportDescription" required /></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.instalacion')}<select name="facilityId" required
			>{#each data.facilities as facility (facility.id)}<option value={facility.id}
					>{facility.name}</option
				>{/each}</select
		></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.comeza')}<input
			name="startsOn"
			type="date"
			required
		/></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.remata')}<input name="endsOn" type="date" required /></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.limite')}<input
			name="signupDeadline"
			type="datetime-local"
			required
		/></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.prazas')}<input
			name="maxEntries"
			type="number"
			min="1"
			required
		/></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.formato')}<select name="format"
			><option value="individual">{t(data.locale, 'vec.torneo.formato.individual')}</option><option
				value="parellas">{t(data.locale, 'vec.torneo.formato.parellas')}</option
			><option value="equipos">{t(data.locale, 'vec.torneo.formato.equipos')}</option></select
		></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.prezo')}<input
			name="feeEuros"
			type="number"
			min="0"
			step="0.01"
			value="0"
		/></label
	>
	<label
		>{t(data.locale, 'adm.torneo.campo.descricion')}<textarea name="description"></textarea></label
	>
	<label>{t(data.locale, 'adm.torneo.campo.normas')}<textarea name="rules"></textarea></label>
	<Button type="submit">{t(data.locale, 'adm.torneo.novo')}</Button>
</form>
<ul>
	{#each data.rows as tournament (tournament.id)}<li>
			<b>{tournament.title}</b> · {t(
				data.locale,
				`adm.torneo.estado.${tournament.status}` as MessageKey
			)}
			<a href={`${base}/admin/torneos/${tournament.id}/export.csv`}
				>{t(data.locale, 'adm.torneo.exportar')}</a
			>
			<details>
				<summary>{t(data.locale, 'adm.entidades.editar')}</summary>
				<form method="POST" action="?/editar" class="formulario">
					<input type="hidden" name="id" value={tournament.id} />
					<label
						>{t(data.locale, 'adm.torneo.campo.titulo')}<input
							name="title"
							value={tournament.title}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.deporte')}<input
							name="sportDescription"
							value={tournament.sportDescription}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.instalacion')}<select name="facilityId" required
							>{#each data.facilities as facility (facility.id)}<option
									value={facility.id}
									selected={facility.id === tournament.facilityId}>{facility.name}</option
								>{/each}</select
						></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.comeza')}<input
							name="startsOn"
							type="date"
							value={tournament.startsOn}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.remata')}<input
							name="endsOn"
							type="date"
							value={tournament.endsOn}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.limite')}<input
							name="signupDeadline"
							type="datetime-local"
							value={tournament.signupDeadlineLocal}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.prazas')}<input
							name="maxEntries"
							type="number"
							min="1"
							value={tournament.maxEntries}
							required
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.formato')}<select
							name="format"
							value={tournament.format}
							><option value="individual">{t(data.locale, 'vec.torneo.formato.individual')}</option
							><option value="parellas">{t(data.locale, 'vec.torneo.formato.parellas')}</option
							><option value="equipos">{t(data.locale, 'vec.torneo.formato.equipos')}</option
							></select
						></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.prezo')}<input
							name="feeEuros"
							type="number"
							min="0"
							step="0.01"
							value={tournament.feeCents / 100}
						/></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.descricion')}<textarea name="description"
							>{tournament.description}</textarea
						></label
					>
					<label
						>{t(data.locale, 'adm.torneo.campo.normas')}<textarea name="rules"
							>{tournament.rules}</textarea
						></label
					>
					<Button type="submit">{t(data.locale, 'adm.entidades.gardar')}</Button>
				</form>
			</details>
			<form method="POST" action="?/cancelar">
				<input type="hidden" name="id" value={tournament.id} /><Button type="submit" variant="out"
					>{t(data.locale, 'adm.torneo.cancelar')}</Button
				>
			</form>
		</li>{/each}
</ul>

<style>
	.formulario {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		max-width: 640px;
	}
	label {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 4px;
		font-weight: 700;
	}
	input,
	select,
	textarea {
		min-height: 44px;
		font: inherit;
	}
	li {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		margin: 12px 0;
	}

	details {
		width: 100%;
		min-width: 0;
	}
</style>
