<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/admin/temporadas`);
	const DAYS = [0, 1, 2, 3, 4, 5, 6];

	// Valores del formulario: los enviados si algo falló; si no, los de la temporada que se edita.
	const sent = $derived(form && 'values' in form ? form : null);
	const initial = $derived.by(() => {
		if (sent) {
			const v = sent.values ?? {};
			return {
				id: v.id ?? '',
				entityName: v.entityName ?? '',
				entityId: v.entityId ?? '',
				lugar: v.lugar ?? '',
				weekdays: sent.weekdays ?? [],
				startsTime: v.startsTime ?? '',
				endsTime: v.endsTime ?? '',
				fromDate: v.fromDate ?? '',
				toDate: v.toDate ?? ''
			};
		}
		const e = data.editing;
		if (e) {
			return {
				id: e.id,
				entityName: e.entityName,
				entityId: e.entityId ?? '',
				lugar: e.unitIndex === null ? e.facilityId : `${e.facilityId}:${e.unitIndex}`,
				weekdays: [e.weekday],
				startsTime: e.startsTime,
				endsTime: e.endsTime,
				fromDate: e.fromDate,
				toDate: e.toDate
			};
		}
		return {
			id: '',
			entityName: '',
			entityId: '',
			lugar: '',
			weekdays: [] as number[],
			startsTime: '',
			endsTime: '',
			fromDate: data.today,
			toDate: ''
		};
	});
	const editing = $derived(initial.id !== '');

	/** Opciones de «Instalación»: en modo unidade, enteira y cada unidad («Pista 1»…). */
	const places = $derived(
		data.facilities
			.filter((f) => f.active || initial.lugar.startsWith(f.id))
			.flatMap((f) =>
				f.bookingMode === 'unit'
					? [
							{ value: f.id, label: t(locale, 'adm.temp.enteira', { nome: f.name }) },
							...Array.from({ length: f.units }, (_, i) => ({
								value: `${f.id}:${i}`,
								label: facilityLabel(locale, f.name, i, nounFor('unit', f.mascot))
							}))
						]
					: [{ value: f.id, label: f.name }]
			)
	);
	const placeOf = (facilityId: string, unitIndex: number | null) => {
		const f = data.facilities.find((x) => x.id === facilityId);
		if (!f) return '';
		return facilityLabel(locale, f.name, unitIndex, nounFor(f.bookingMode, f.mascot));
	};
	const dateOf = (d: string) => {
		const [y, m, day] = d.split('-');
		return `${day}/${m}/${y}`;
	};
	const dayName = (d: number) => t(locale, `adm.hor.dia.${d}` as MessageKey);
	const franxa = (s: { weekday: number; startsTime: string; endsTime: string }) =>
		t(locale, 'adm.temp.franxa', { dia: dayName(s.weekday), de: s.startsTime, a: s.endsTime });
	const rango = (s: { fromDate: string; toDate: string }) =>
		t(locale, 'adm.peche.rango', { desde: dateOf(s.fromDate), ata: dateOf(s.toDate) });

	const err = $derived(form && 'error' in form ? form.error : null);
	const conflicts = $derived(
		form && 'conflicts' in form && form.conflicts
			? {
					list: form.conflicts,
					total: form.total ?? 0,
					weekdays: form.weekdays ?? []
				}
			: null
	);
	const cancelled = $derived(form && 'saved' in form ? (form.cancelled ?? 0) : 0);
	const overlaps = $derived(form && 'overlaps' in form ? form.overlaps : null);
	// Lo que se reenvía al confirmar la cancelación (sin la elección anterior ni los días).
	const resend = $derived(
		Object.entries(sent?.values ?? {}).filter(([name]) => !['confirmar', 'weekday'].includes(name))
	);
</script>

<svelte:head>
	<title>{t(locale, 'adm.temp.titulo')} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<h1>{t(locale, 'adm.temp.titulo')}</h1>
	<p class="axuda">{t(locale, 'adm.temp.axuda')}</p>
</header>

{#if form && 'saved' in form}
	<p class="ok" role="status">
		{#if cancelled > 0}
			{t(locale, cancelled === 1 ? 'adm.temp.canceladas.un' : 'adm.temp.canceladas', {
				n: cancelled
			})}
		{:else}
			{t(locale, 'adm.temp.gardada')}
		{/if}
	</p>
{:else if form && 'deleted' in form}
	<p class="ok" role="status">{t(locale, 'adm.temp.quitada')}</p>
{:else if err === 'NOT_FOUND'}
	<p class="erro" role="alert">{t(locale, 'adm.erro.NOT_FOUND')}</p>
{/if}

<section class="nova" aria-labelledby="criterios-t">
	<h2 id="criterios-t">{t(locale, 'adm.temp.criterios')}</h2>
	<p class="axuda">{t(locale, 'adm.temp.criterios_axuda')}</p>
	{#if form && 'criteriaSaved' in form}<p class="ok" role="status">
			{t(locale, 'adm.temp.criterios_gardados')}
		</p>{/if}
	{#if form && 'criteriaError' in form}<p class="erro" role="alert">
			{t(locale, 'adm.temp.criterios_erro')}
		</p>{/if}
	<form method="POST" action="?/criterios" class="campos">
		<label class="campo ancho" for="criterios"
			><span>{t(locale, 'adm.temp.criterios')}</span><textarea
				id="criterios"
				name="seasonPriorityCriteria"
				maxlength="1000">{data.seasonPriorityCriteria}</textarea
			></label
		>
		<div class="botons ancho"><Button type="submit">{t(locale, 'adm.gardar')}</Button></div>
	</form>
</section>

<section class="nova" data-tour="tempadas" aria-labelledby="temp-form-t">
	<h2 id="temp-form-t">{t(locale, editing ? 'adm.temp.editar' : 'adm.temp.nova')}</h2>

	{#if err === 'INVALID'}
		<p class="erro" role="alert">{t(locale, 'adm.temp.erro')}</p>
	{/if}

	{#if overlaps}
		<div class="choque" role="alert">
			<p>{t(locale, 'adm.temp.solapa')}</p>
			<ul>
				{#each overlaps as o (o.id)}
					<li>
						<b>{o.entityName}</b> · {placeOf(o.facilityId, o.unitIndex)} · {franxa(o)} · {rango(o)}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if conflicts}
		<div class="choque" role="alert">
			<p>
				{t(locale, conflicts.total === 1 ? 'adm.temp.conflitos.un' : 'adm.temp.conflitos', {
					n: conflicts.total
				})}
			</p>
			<ul>
				{#each conflicts.list as c (c.id)}
					<li>
						{dateOf(c.date)} · {c.start}–{c.end} · {placeOf(c.facilityId, c.unitIndex)}
					</li>
				{/each}
				{#if conflicts.total > conflicts.list.length}
					<li>
						{t(locale, 'adm.temp.conflitos_mais', {
							n: conflicts.total - conflicts.list.length
						})}
					</li>
				{/if}
			</ul>
			<p class="axuda">{t(locale, 'adm.temp.conflitos_axuda')}</p>
			<form method="POST" action="?/gardar">
				{#each resend as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				{#each conflicts.weekdays as d (d)}
					<input type="hidden" name="weekday" value={d} />
				{/each}
				<input type="hidden" name="confirmar" value="1" />
				<Button type="submit" variant="perigo">{t(locale, 'adm.temp.conflitos_confirmar')}</Button>
			</form>
		</div>
	{/if}

	{#key initial}
		<form method="POST" action="?/gardar" class="campos">
			{#if editing}<input type="hidden" name="id" value={initial.id} />{/if}
			<div class="campo ancho">
				<label for="t-entidade">{t(locale, 'adm.temp.entidade')}</label>
				<input
					id="t-entidade"
					name="entityName"
					required
					maxlength={data.entityMax}
					value={initial.entityName}
				/>
				<select name="entityId" aria-label={t(locale, 'adm.temp.entidade')}>
					<option value="">{t(locale, 'adm.temp.texto_libre')}</option>
					{#each data.entities as entity (entity.id)}
						<option value={entity.id} selected={entity.id === initial.entityId}
							>{entity.name}</option
						>
					{/each}
				</select>
			</div>
			<div class="campo ancho">
				<label for="t-lugar">{t(locale, 'adm.temp.instalacion')}</label>
				<select id="t-lugar" name="lugar" required>
					{#each places as p (p.value)}
						<option value={p.value} selected={p.value === initial.lugar}>{p.label}</option>
					{/each}
				</select>
			</div>
			<fieldset class="campo ancho">
				<legend>{t(locale, editing ? 'adm.temp.dia' : 'adm.temp.dias')}</legend>
				<div class="dias">
					{#each DAYS as d (d)}
						<label class="dia">
							<input
								type={editing ? 'radio' : 'checkbox'}
								name="weekday"
								value={d}
								checked={initial.weekdays.includes(d)}
							/>
							{dayName(d)}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="campo">
				<label for="t-de">{t(locale, 'adm.temp.de')}</label>
				<input id="t-de" name="startsTime" type="time" required value={initial.startsTime} />
			</div>
			<div class="campo">
				<label for="t-a">{t(locale, 'adm.temp.a')}</label>
				<input id="t-a" name="endsTime" type="time" required value={initial.endsTime} />
			</div>
			<div class="campo">
				<label for="t-desde">{t(locale, 'adm.peche.desde')}</label>
				<input id="t-desde" name="fromDate" type="date" required value={initial.fromDate} />
			</div>
			<div class="campo">
				<label for="t-ata">{t(locale, 'adm.peche.ata')}</label>
				<input id="t-ata" name="toDate" type="date" required value={initial.toDate} />
			</div>
			<div class="botons ancho">
				<Button type="submit">{t(locale, editing ? 'adm.gardar' : 'adm.temp.crear')}</Button>
				{#if editing}<Button href={base} variant="out">{t(locale, 'adm.av.volver')}</Button>{/if}
			</div>
		</form>
	{/key}
</section>

<section class="lista" aria-labelledby="temp-lista-t">
	<h2 id="temp-lista-t">{t(locale, 'adm.temp.lista')}</h2>
	{#if data.seasons.length === 0}
		<p class="axuda">{t(locale, 'adm.temp.sen')}</p>
	{:else}
		<ul>
			{#each data.seasons as s (s.id)}
				<li>
					<div class="txt">
						<b>{s.entityName}</b>
						<span>{placeOf(s.facilityId, s.unitIndex) || s.facilityName} · {franxa(s)}</span>
						<small>{rango(s)}</small>
					</div>
					<div class="accions">
						<Button
							href="{base}?editar={s.id}"
							variant="out"
							aria-label={t(locale, 'adm.temp.editar_a', { entidade: s.entityName })}
							>{t(locale, 'adm.av.editar_btn')}</Button
						>
						<form method="POST" action="?/borrar">
							<input type="hidden" name="id" value={s.id} />
							<Button
								type="submit"
								variant="perigo"
								aria-label={t(locale, 'adm.temp.quitar_a', { entidade: s.entityName })}
								>{t(locale, 'adm.peche.quitar')}</Button
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
		margin: 0 0 10px;
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

	.nova {
		max-width: 640px;
	}

	.choque {
		margin: 0 0 14px;
		padding: 10px 14px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		font-weight: 700;
	}

	.choque p {
		margin: 0 0 6px;
		font-weight: 800;
	}

	.choque ul {
		margin: 0 0 8px;
		padding-left: 20px;
	}

	.choque .axuda {
		margin: 0 0 10px;
	}

	.campos {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	.ancho {
		grid-column: 1 / -1;
	}

	label,
	legend {
		padding: 0;
		font-weight: 800;
	}

	input:not([type='hidden']):not([type='checkbox']):not([type='radio']),
	select {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	.dias {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.dia {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--ceo);
		border-radius: 999px;
		font-weight: 700;
		cursor: pointer;
	}

	.dia:has(input:checked) {
		border-color: var(--txt);
		background: var(--ceo);
	}

	.dia input {
		width: 20px;
		height: 20px;
	}

	.botons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.lista {
		margin-top: 32px;
	}

	.lista ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lista li {
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
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		font-weight: 700;
	}

	.txt small {
		color: var(--texto-suave);
		font-weight: 600;
	}

	.accions {
		display: flex;
		gap: 8px;
	}
</style>
