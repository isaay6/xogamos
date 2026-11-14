<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { dayRanges, rangeShort } from '../instalacions/text';
	import { MAX_PAIRS, weekFromValues, type Week } from '../instalacions/asistente/hours';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const DAYS = [0, 1, 2, 3, 4, 5, 6];
	const base = $derived(`/${data.municipality.slug}/admin/instalacions`);
	const typeOf = (id: string) => data.types.find((x) => x.id === id);
	const dayLong = (d: number) => t(data.locale, `adm.hor.dia.${d}` as MessageKey);

	// Respuesta del servidor para una fila: guardado, errores o el aviso de reservas afectadas.
	const answer = $derived(form && 'facilityId' in form ? form : null);
	const failed = $derived(answer && !('hoursSaved' in answer) ? answer : null);
	const saved = $derived(answer && 'hoursSaved' in answer ? answer : null);
	const affected = $derived(failed && 'affected' in failed ? failed : null);
	const dayErrors = $derived<Record<string, string>>(
		failed && 'dayErrors' in failed ? (failed.dayErrors as Record<string, string>) : {}
	);
	const issues = $derived(failed && 'issues' in failed ? (failed.issues ?? []) : []);
	const nameOf = (id: string) => data.facilities.find((f) => f.id === id)?.name ?? '';
	const holidaySaved = $derived(form && 'holidaySaved' in form);
	const holidaysLoaded = $derived(form && 'holidaysLoaded' in form);
	const holidayDeleted = $derived(form && 'holidayDeleted' in form);
	const holidayError = $derived(form && 'error' in form && !('facilityId' in form));
	const year = new Date().getFullYear();

	let js = $state(false);
	onMount(() => (js = true));

	/** Franjas en edición: las enviadas si falló, si no las guardadas; al menos 2 por día. */
	function draftFor(id: string): Week {
		const f = data.facilities.find((x) => x.id === id);
		const values =
			failed && failed.facilityId === id && 'values' in failed && failed.values
				? (failed.values as Record<string, string>)
				: null;
		const week: Week = values
			? weekFromValues(values)
			: DAYS.map((d) =>
					dayRanges(f?.hours ?? [], d).map(({ opens, closes }) => ({ opens, closes }))
				);
		return week.map((pairs) => [
			...pairs,
			...Array.from({ length: Math.max(0, 2 - pairs.length) }, () => ({ opens: '', closes: '' }))
		]);
	}

	// svelte-ignore state_referenced_locally
	const first = failed?.facilityId ?? data.editing;
	let editing = $state<string | null>(first);
	let draft = $state<Week>(first ? draftFor(first) : []);

	function edit(e: MouseEvent, id: string) {
		e.preventDefault();
		editing = id;
		draft = draftFor(id);
	}

	function cancel(e: MouseEvent) {
		e.preventDefault();
		editing = null;
	}

	const bad = (id: string, d: number) => failed?.facilityId === id && !!dayErrors[d];
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.horarios.titulo')} · {data.municipality.name}</title>
</svelte:head>

<p class="k">{t(data.locale, 'adm.hor.k')}</p>
<h1>{t(data.locale, 'adm.horarios.titulo')}</h1>
<p class="axuda">{t(data.locale, 'adm.hor.axuda')}</p>

{#if saved}
	<p class="ok" role="status">
		{t(data.locale, 'adm.hor.gardado', { nome: nameOf(saved.facilityId ?? '') })}
	</p>
{/if}

{#if data.facilities.length === 0}
	<p class="axuda">{t(data.locale, 'adm.horarios.sen')}</p>
{:else}
	<p class="desliza" aria-hidden="true">{t(data.locale, 'taboa.desliza')}</p>
	<!-- Rexión desprazable: debe poder recibir o foco para moverse co teclado (WCAG 2.1.1). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="taboa"
		data-tour="horarios"
		role="region"
		aria-label={t(data.locale, 'taboa.rexion')}
		tabindex="0"
	>
		<table>
			<thead>
				<tr>
					<th scope="col">{t(data.locale, 'adm.hor.instalacion')}</th>
					{#each DAYS as d (d)}<th scope="col">{dayLong(d)}</th>{/each}
					<th scope="col"><span class="sr">{t(data.locale, 'adm.hor.accions')}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.facilities as f (f.id)}
					{@const type = typeOf(f.typeId)}
					{@const isEditing = editing === f.id}
					<tr id="f-{f.id}" class:off={!f.active} class:editando={isEditing}>
						<th scope="row">
							<span class="nome">
								<Mascot
									kind={type?.mascot ?? 'sala'}
									size={28}
									animated={false}
									color={type?.color}
								/>
								<span>
									<a
										href="{base}/{f.id}"
										aria-label={t(data.locale, 'adm.horarios.ficha', { nome: f.name })}>{f.name}</a
									>
									{#if !f.active}<small>{t(data.locale, 'adm.inst.pechada')}</small>{/if}
								</span>
							</span>
						</th>
						{#each DAYS as d (d)}
							<td class:mal={bad(f.id, d)}>
								{#if isEditing}
									<div class="pares">
										{#each draft[d] as pair, i (i)}
											<span class="par">
												<input
													type="time"
													step="900"
													form="h-{f.id}"
													name="h-{d}-{i}-opens"
													bind:value={pair.opens}
													aria-invalid={bad(f.id, d) ? 'true' : undefined}
													aria-label={t(data.locale, 'adm.fac.tramo', {
														dia: dayLong(d),
														n: i + 1,
														campo: t(data.locale, 'adm.fac.abre')
													})}
												/>
												<input
													type="time"
													step="900"
													form="h-{f.id}"
													name="h-{d}-{i}-closes"
													bind:value={pair.closes}
													aria-invalid={bad(f.id, d) ? 'true' : undefined}
													aria-label={t(data.locale, 'adm.fac.tramo', {
														dia: dayLong(d),
														n: i + 1,
														campo: t(data.locale, 'adm.fac.pecha')
													})}
												/>
											</span>
										{/each}
										{#if js && draft[d].length < MAX_PAIRS}
											<button
												type="button"
												class="mais"
												onclick={() => draft[d].push({ opens: '', closes: '' })}
												aria-label={t(data.locale, 'adm.hor.franxa_a', { dia: dayLong(d) })}
												>{t(data.locale, 'adm.hor.franxa')}</button
											>
										{/if}
									</div>
								{:else}
									{@const ranges = dayRanges(f.hours, d)}
									{#if ranges.length === 0}
										<span class="pechado">{t(data.locale, 'adm.fac.pechado')}</span>
									{:else}
										{#each ranges as r, n (n)}<span class="po">{rangeShort(r)}</span>{/each}
									{/if}
								{/if}
							</td>
						{/each}
						<td class="acc">
							{#if isEditing}
								<form id="h-{f.id}" method="POST" action="?/horario">
									<input type="hidden" name="facilityId" value={f.id} />
									<Button
										type="submit"
										aria-label={t(data.locale, 'adm.hor.gardar_a', { nome: f.name })}
										>{t(data.locale, 'adm.hor.gardar')}</Button
									>
								</form>
								<a class="ligazon" href="?" onclick={cancel}>{t(data.locale, 'adm.hor.cancelar')}</a
								>
							{:else}
								<a
									class="ligazon"
									href="?editar={f.id}#f-{f.id}"
									onclick={(e) => edit(e, f.id)}
									aria-label={t(data.locale, 'adm.hor.cambiar_a', { nome: f.name })}
									>{t(data.locale, 'adm.hor.cambiar')}</a
								>
							{/if}
						</td>
					</tr>
					{#if failed && failed.facilityId === f.id && !affected && (Object.keys(dayErrors).length || issues.length || 'error' in failed)}
						<tr class="aviso">
							<td colspan="9">
								<div class="erro" role="alert">
									<p>{t(data.locale, 'adm.hor.erro', { nome: f.name })}</p>
									<ul>
										{#each Object.entries(dayErrors) as [d, code] (d)}
											<li>
												{t(data.locale, 'adm.asis.erro.dia', {
													dia: dayLong(Number(d)),
													erro: t(data.locale, `adm.asis.erro.${code}` as MessageKey)
												})}
											</li>
										{/each}
										{#each issues as i, n (n)}<li>{i.message}</li>{/each}
									</ul>
								</div>
							</td>
						</tr>
					{/if}
					{#if affected && affected.facilityId === f.id}
						<tr class="aviso">
							<td colspan="9">
								<form method="POST" action="?/horario" class="afectadas" role="alert">
									<p>
										{t(
											data.locale,
											affected.affected === 1 ? 'adm.afectadas.un' : 'adm.afectadas',
											{
												n: affected.affected ?? 0
											}
										)}
									</p>
									{#each Object.entries(affected.values ?? {}) as [name, value] (name)}
										{#if name !== 'confirmar'}<input type="hidden" {name} {value} />{/if}
									{/each}
									<input type="hidden" name="confirmar" value="1" />
									<Button type="submit" variant="perigo"
										>{t(data.locale, 'adm.afectadas.confirmar')}</Button
									>
								</form>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
	<p class="lenda"><i aria-hidden="true"></i>{t(data.locale, 'adm.hor.lenda')}</p>
{/if}

<section class="festivos" data-tour="festivos" aria-labelledby="festivos">
	<h2 id="festivos">{t(data.locale, 'adm.festivos.titulo')}</h2>
	<p class="axuda">{t(data.locale, 'adm.festivos.axuda')}</p>
	{#if holidaySaved}<p class="ok" role="status">{t(data.locale, 'adm.festivos.gardado')}</p>{/if}
	{#if holidaysLoaded}<p class="ok" role="status">{t(data.locale, 'adm.festivos.cargados')}</p>{/if}
	{#if holidayDeleted}<p class="ok" role="status">{t(data.locale, 'adm.festivos.quitado')}</p>{/if}
	{#if holidayError}<p class="erro" role="alert">{t(data.locale, 'adm.festivos.erro')}</p>{/if}
	<form method="POST" action="?/festivo" class="holiday-form">
		<label>
			<span>{t(data.locale, 'adm.festivos.data')}</span>
			<input type="date" name="date" required />
		</label>
		<label>
			<span>{t(data.locale, 'adm.festivos.nome')}</span>
			<input name="name" required />
		</label>
		<label>
			<span>{t(data.locale, 'adm.festivos.modo')}</span>
			<select name="mode">
				<option value="closed">{t(data.locale, 'adm.festivos.pechado')}</option>
				<option value="sunday_hours">{t(data.locale, 'adm.festivos.domingo')}</option>
			</select>
		</label>
		<Button type="submit">{t(data.locale, 'adm.festivos.engadir')}</Button>
	</form>
	<form method="POST" action="?/festivosFixos" class="fixed-form">
		<input type="hidden" name="year" value={year} />
		<Button type="submit">{t(data.locale, 'adm.festivos.cargar', { ano: year })}</Button>
	</form>
	{#if data.holidays.length === 0}
		<p class="axuda">{t(data.locale, 'adm.festivos.sen')}</p>
	{:else}
		<ul class="holiday-list">
			{#each data.holidays as holiday (holiday.id)}
				<li>
					<span
						><b>{holiday.date}</b> · {holiday.name} · {t(
							data.locale,
							holiday.mode === 'closed' ? 'adm.festivos.pechado' : 'adm.festivos.domingo'
						)}</span
					>
					<form method="POST" action="?/borrarFestivo">
						<input type="hidden" name="holidayId" value={holiday.id} />
						<button
							type="submit"
							class="remove"
							aria-label={t(data.locale, 'adm.festivos.quitar', { nome: holiday.name })}>×</button
						>
					</form>
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

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--gris);
	}

	h1 {
		margin: 0 0 6px;
		font-size: 28px;
		font-weight: 900;
	}

	.axuda {
		margin: 0 0 16px;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.ok {
		margin: 0 0 14px;
		font-weight: 800;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.taboa {
		/* Contén tamén os textos ocultos con position: absolute das celas. */
		position: relative;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 4px;
	}

	thead th {
		font-size: 13px;
		font-weight: 800;
		color: var(--gris);
		text-align: center;
	}

	thead th:first-child {
		text-align: left;
	}

	th[scope='row'] {
		min-width: 180px;
		text-align: left;
		font-weight: 900;
	}

	.nome {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nome a {
		color: var(--txt);
	}

	.nome small {
		display: block;
		font-size: 13px;
		font-weight: 700;
		color: var(--texto-suave);
	}

	td {
		padding: 5px;
		border: 1px solid var(--liña);
		border-radius: 10px;
		background: #fafbfb;
		text-align: center;
		vertical-align: middle;
	}

	td.acc {
		border: 0;
		background: none;
		min-width: 100px;
	}

	td.mal {
		border: 2px solid var(--perigo);
	}

	tr.off td:not(.acc) {
		opacity: 0.85;
	}

	tr.editando td:not(.acc) {
		border: 2px solid var(--txt);
		box-shadow: 0 0 0 3px var(--foco);
		background: var(--branco);
	}

	tr.editando td.mal {
		border-color: var(--perigo);
	}

	.po {
		display: block;
		margin: 2px 0;
		padding: 3px 6px;
		border-radius: 6px;
		background: #dbf0e1;
		color: #1d6b35;
		font-size: 14px;
		font-weight: 900;
		white-space: nowrap;
	}

	.pechado {
		font-size: 13px;
		font-weight: 700;
		color: var(--texto-suave);
	}

	.pares {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.par {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	input {
		width: 100%;
		min-width: 84px;
		min-height: var(--toque);
		padding: 0 4px;
		border: 2px solid var(--liña);
		border-radius: 6px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-size: 14px;
		font-weight: 800;
	}

	input:focus {
		border-color: var(--txt);
	}

	input[aria-invalid='true'] {
		border-color: var(--perigo);
	}

	.mais {
		min-height: var(--toque);
		border: 2px dashed var(--apagado);
		border-radius: 6px;
		background: var(--branco);
		color: var(--texto-suave);
		font: inherit;
		font-size: 13px;
		font-weight: 800;
		cursor: pointer;
	}

	.acc form {
		margin-bottom: 6px;
	}

	.ligazon {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 6px;
		color: var(--txt);
		font-weight: 800;
	}

	tr.aviso td {
		border: 0;
		background: none;
		text-align: left;
	}

	.erro,
	.afectadas {
		padding: 10px 14px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		font-weight: 800;
	}

	.erro {
		color: var(--perigo);
	}

	.erro p,
	.afectadas p {
		margin: 0 0 6px;
	}

	.erro ul {
		margin: 0;
	}

	.afectadas :global(.btn) {
		width: auto;
	}

	.lenda {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 10px 0 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--texto-suave);
	}

	.lenda i {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		background: #dbf0e1;
		border: 1px solid #1d6b35;
	}

	.festivos {
		margin-top: 30px;
		padding-top: 20px;
		border-top: 2px solid var(--liña);
	}

	.festivos h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 900;
	}

	.holiday-form {
		display: grid;
		grid-template-columns: repeat(3, minmax(120px, 1fr)) auto;
		gap: 10px;
		align-items: end;
	}

	.holiday-form label {
		display: grid;
		gap: 4px;
		font-size: 14px;
		font-weight: 800;
	}

	select {
		min-height: var(--toque);
		border: 2px solid var(--liña);
		border-radius: 6px;
		background: var(--branco);
		font: inherit;
	}

	.fixed-form {
		margin-top: 10px;
	}

	.holiday-list {
		max-width: 700px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
	}

	.holiday-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--liña);
	}

	.remove {
		min-width: var(--toque);
		min-height: var(--toque);
		border: 2px solid var(--perigo);
		border-radius: 8px;
		background: var(--branco);
		color: var(--perigo);
		font-size: 22px;
		font-weight: 900;
		cursor: pointer;
	}

	@media (max-width: 680px) {
		.holiday-form {
			grid-template-columns: 1fr;
		}
	}
</style>
