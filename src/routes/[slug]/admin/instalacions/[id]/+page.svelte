<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import WeekHours from '#lib/ui/WeekHours.svelte';
	import FacilityForm from '../FacilityForm.svelte';
	import { eurosInput } from '../text';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const base = $derived(`/${data.municipality.slug}/admin/instalacions`);
	const f = $derived(data.facility);
	// Los valores de un aviso de reservas afectadas son del horario o del cierre, no de la ficha.
	const v = $derived(form && 'values' in form && !('affected' in form) ? (form.values ?? {}) : {});
	const initial = $derived({
		typeId: v.typeId ?? f.typeId,
		name: v.name ?? f.name,
		location: v.location ?? f.location,
		address: v.address ?? f.address,
		latitude: v.latitude ?? (f.latitude === null ? '' : String(f.latitude)),
		longitude: v.longitude ?? (f.longitude === null ? '' : String(f.longitude)),
		units: v.units ?? String(f.units),
		capacity: v.capacity ?? String(f.capacity),
		slotMinutes: v.slotMinutes ?? String(f.slotMinutes),
		priceResident: v.priceResident ?? eurosInput(f.priceResidentCents),
		priceNonResident: v.priceNonResident ?? eurosInput(f.priceNonResidentCents),
		priceSocial:
			v.priceSocial ?? (f.priceSocialCents === null ? '' : eurosInput(f.priceSocialCents)),
		accessible: 'accessible' in v || 'name' in v ? v.accessible === 'on' : f.accessible,
		stepFreeAccess:
			v.stepFreeAccess === 'yes' || v.stepFreeAccess === 'no' || v.stepFreeAccess === 'partial'
				? v.stepFreeAccess
				: f.stepFreeAccess,
		adaptedToilet:
			v.adaptedToilet === 'yes' ? true : v.adaptedToilet === 'no' ? false : f.adaptedToilet,
		adaptedChangingRoom:
			v.adaptedChangingRoom === 'yes'
				? true
				: v.adaptedChangingRoom === 'no'
					? false
					: f.adaptedChangingRoom,
		accessibleParkingNearby:
			v.accessibleParkingNearby === 'yes'
				? true
				: v.accessibleParkingNearby === 'no'
					? false
					: f.accessibleParkingNearby,
		hearingLoop: v.hearingLoop === 'yes' ? true : v.hearingLoop === 'no' ? false : f.hearingLoop,
		supportContact: v.supportContact ?? f.supportContact,
		accessibilityNotes: v.accessibilityNotes ?? f.accessibilityNotes,
		needsOpening: 'accessInfo' in v ? v.needsOpening === 'on' : f.needsOpening,
		accessInfo: v.accessInfo ?? f.accessInfo,
		accessInfoEs: v.accessInfoEs ?? f.accessInfoEs ?? '',
		rules: v.rules ?? f.rules
	});

	const err = $derived(form && 'error' in form ? form.error : null);
	const detailError = $derived(
		form && 'hoursError' in form
			? null
			: form && ('closureError' in form || 'cancelReasonError' in form)
				? null
				: err === 'HAS_FUTURE_BOOKINGS'
					? null
					: err
	);
	const affected = $derived(form && 'affected' in form ? form : null);
	// Campos del cierre que se repiten en la confirmación.
	const closureValues = $derived(
		Object.entries(affected?.values ?? {}).filter(([name]) => name !== 'confirmar')
	);
	const dateOf = (d: string) => {
		const [y, m, day] = d.split('-');
		return `${day}/${m}/${y}`;
	};
</script>

{#snippet confirmar(accion: 'horario' | 'peche')}
	{#if affected && affected.accion === accion}
		<form method="POST" action="?/{accion}" class="afectadas" role="alert">
			<p>
				{t(data.locale, affected.affected === 1 ? 'adm.afectadas.un' : 'adm.afectadas', {
					n: affected.affected
				})}
			</p>
			{#each Object.entries(affected.values ?? {}) as [name, value] (name)}
				{#if name !== 'confirmar'}<input type="hidden" {name} {value} />{/if}
			{/each}
			<input type="hidden" name="confirmar" value="1" />
			<Button type="submit" variant="perigo">{t(data.locale, 'adm.afectadas.confirmar')}</Button>
		</form>
	{/if}
{/snippet}

<svelte:head>
	<title>{f.name} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<div>
		<p class="k"><a href={base}>{t(data.locale, 'adm.fac.k')}</a></p>
		<h1>{f.name}</h1>
	</div>
	<div class="botons">
		<Button href="#peche" variant="out">{t(data.locale, 'adm.peche.titulo')}</Button>
		<Button type="submit" form="fac-form">{t(data.locale, 'adm.gardar')}</Button>
	</div>
</header>

{#if data.created && !form}
	<p class="ok" role="status">{t(data.locale, 'adm.asis.creada')}</p>
{/if}
{#if form && 'saved' in form && form.saved}
	<p class="ok" role="status">{t(data.locale, 'adm.fac.gardado')}</p>
{:else if form && 'closed' in form && form.closed}
	<p class="ok" role="status">{t(data.locale, 'adm.fac.desactivada')}</p>
{:else if form && 'reactivated' in form && form.reactivated}
	<p class="ok" role="status">{t(data.locale, 'adm.fac.reactivada')}</p>
{:else if err === 'HAS_FUTURE_BOOKINGS'}
	<p class="erro" role="alert">
		{#if form && 'count' in form}
			{t(
				data.locale,
				form.count === 1 ? 'adm.erro.HAS_FUTURE_BOOKINGS.un' : 'adm.erro.HAS_FUTURE_BOOKINGS',
				{ n: form.count ?? 0 }
			)}
		{/if}
		<a href="/{data.municipality.slug}/conserxeria?vista=semana&inst={f.id}"
			>{t(data.locale, 'adm.fac.ver_reservas')}</a
		>
	</p>
{/if}
{#if !f.active}
	<form method="POST" action="?/reactivar" class="aviso">
		<span>{t(data.locale, 'adm.fac.inactiva')}</span>
		<Button type="submit">{t(data.locale, 'adm.fac.reactivar')}</Button>
	</form>
{/if}

{#key form}
	<FacilityForm
		action="?/gardar"
		types={data.types}
		{initial}
		locale={data.locale}
		error={detailError}
		issues={form && 'issues' in form && !('hoursError' in form) ? form.issues : []}
		showAccessibility
		showSimpleAccessible={false}
	>
		{#snippet aside()}
			<section aria-labelledby="fotos-t">
				<h2 id="fotos-t">{t(data.locale, 'adm.fotos.titulo')}</h2>
				<p class="axuda">{t(data.locale, 'adm.fotos.axuda')}</p>
				{#if form && 'photoSaved' in form && form.photoSaved}
					<p class="ok" role="status">{t(data.locale, 'adm.fotos.gardada')}</p>
				{:else if form && 'photoDeleted' in form && form.photoDeleted}
					<p class="ok" role="status">{t(data.locale, 'adm.fotos.borrada')}</p>
				{:else if form && 'photoMoved' in form && form.photoMoved}
					<p class="ok" role="status">{t(data.locale, 'adm.fotos.movida')}</p>
				{:else if form && 'photoError' in form}
					<p class="erro" role="alert">
						{t(data.locale, `adm.fotos.erro.${form.photoError}` as MessageKey)}
					</p>
				{/if}
				{#if data.photos.length}
					<ol class="fotos">
						{#each data.photos as photo, index (photo.id)}
							<li>
								{#if f.active}
									<img
										src="/api/v1/m/{data.municipality.slug}/facilities/{f.id}/photos/{photo.id}"
										alt={photo.altGl}
									/>
								{/if}
								<span>{photo.altGl}</span>
								<div class="foto-accions">
									<form method="POST" action="?/moverFoto">
										<input type="hidden" name="photoId" value={photo.id} />
										<input type="hidden" name="direction" value="up" />
										<Button type="submit" variant="out" disabled={index === 0}
											>{t(data.locale, 'adm.fotos.subir')}</Button
										>
									</form>
									<form method="POST" action="?/moverFoto">
										<input type="hidden" name="photoId" value={photo.id} />
										<input type="hidden" name="direction" value="down" />
										<Button type="submit" variant="out" disabled={index === data.photos.length - 1}
											>{t(data.locale, 'adm.fotos.baixar')}</Button
										>
									</form>
									<form method="POST" action="?/borrarFoto">
										<input type="hidden" name="photoId" value={photo.id} />
										<Button type="submit" variant="perigo"
											>{t(data.locale, 'adm.fotos.borrar')}</Button
										>
									</form>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
				{#if data.photos.length < 3}
					<form method="POST" action="?/foto" enctype="multipart/form-data" class="foto-form">
						<label for="foto"
							>{t(data.locale, 'adm.fotos.ficheiro')}<input
								id="foto"
								name="foto"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								required
							/></label
						>
						<label for="alt-gl"
							>{t(data.locale, 'adm.fotos.alt_gl')}<input
								id="alt-gl"
								name="altGl"
								maxlength="200"
								required
							/></label
						>
						<label for="alt-es"
							>{t(data.locale, 'adm.fotos.alt_es')}<input
								id="alt-es"
								name="altEs"
								maxlength="200"
							/></label
						>
						<Button type="submit" variant="out">{t(data.locale, 'adm.fotos.engadir')}</Button>
					</form>
				{/if}
			</section>

			<section aria-labelledby="horario-t">
				<h2 id="horario-t">{t(data.locale, 'adm.fac.horario')}</h2>
				<p class="axuda">{t(data.locale, 'adm.fac.horario_axuda')}</p>
				{#if form && 'hoursSaved' in form && form.hoursSaved}
					<p class="ok" role="status">{t(data.locale, 'adm.fac.horario_gardado')}</p>
				{:else if form && 'hoursError' in form}
					<div class="erro" role="alert">
						<p>
							{t(
								data.locale,
								err === 'INVALID_CONFIG' ? 'adm.erro.INVALID_CONFIG' : 'adm.erro.INVALID'
							)}
						</p>
						<ul>
							{#if form && 'dayErrors' in form && form.dayErrors}
								{#each Object.entries(form.dayErrors) as [d, code] (d)}
									<li>
										{t(data.locale, 'adm.asis.erro.dia', {
											dia: t(data.locale, `adm.hor.dia.${d}` as MessageKey),
											erro: t(data.locale, `adm.asis.erro.${code}` as MessageKey)
										})}
									</li>
								{/each}
							{/if}
							{#if form && 'issues' in form && form.issues}
								{#each form.issues as i, n (n)}<li>{i.message}</li>{/each}
							{/if}
						</ul>
					</div>
				{/if}
				{@render confirmar('horario')}
				<form method="POST" action="?/horario">
					<WeekHours hours={f.hours} locale={data.locale} editable />
					<div class="gardar">
						<Button type="submit">{t(data.locale, 'adm.fac.horario_gardar')}</Button>
					</div>
				</form>
			</section>

			<section id="peche" aria-labelledby="peche-t">
				<h2 id="peche-t">{t(data.locale, 'adm.peche.titulo')}</h2>
				<p class="axuda">{t(data.locale, 'adm.peche.axuda')}</p>
				{#if form && 'cancelled' in form && typeof form.cancelled === 'number'}
					<p class="ok" role="status">
						{t(
							data.locale,
							form.cancelled === 1 ? 'adm.peche.cancelado.un' : 'adm.peche.cancelado',
							{
								n: form.cancelled
							}
						)}
					</p>
				{:else if form && 'closureSaved' in form && form.closureSaved}
					<p class="ok" role="status">{t(data.locale, 'adm.peche.gardado')}</p>
				{:else if form && 'closureDeleted' in form && form.closureDeleted}
					<p class="ok" role="status">{t(data.locale, 'adm.peche.quitado')}</p>
				{:else if form && 'closureError' in form}
					<p class="erro" role="alert">{t(data.locale, 'adm.peche.erro')}</p>
				{/if}
				{#if affected && affected.accion === 'peche'}
					<div class="afectadas" role="alert">
						<p>
							{t(data.locale, affected.affected === 1 ? 'adm.afectadas.un' : 'adm.afectadas', {
								n: affected.affected
							})}
						</p>
						<form method="POST" action="?/peche" class="opcion">
							{#each closureValues as [name, value] (name)}
								<input type="hidden" {name} {value} />
							{/each}
							<input type="hidden" name="confirmar" value="1" />
							<Button type="submit" variant="perigo"
								>{t(data.locale, 'adm.peche.afectadas.cancelar')}</Button
							>
						</form>
					</div>
				{/if}
				<form method="POST" action="?/peche" class="peche">
					<div class="campo">
						<label for="c-from">{t(data.locale, 'adm.peche.desde')}</label>
						<input id="c-from" name="from" type="date" required />
					</div>
					<div class="campo">
						<label for="c-to">{t(data.locale, 'adm.peche.ata')}</label>
						<input id="c-to" name="to" type="date" required />
					</div>
					<div class="campo ancho">
						<label for="c-reason">{t(data.locale, 'adm.peche.motivo')}</label>
						<input id="c-reason" name="reason" minlength="1" maxlength="200" required />
					</div>
					<div>
						<Button type="submit" variant="out">{t(data.locale, 'adm.peche.pechar')}</Button>
					</div>
				</form>

				<h3>{t(data.locale, 'adm.peche.lista')}</h3>
				{#if data.closures.length === 0}
					<p class="axuda">{t(data.locale, 'adm.peche.sen')}</p>
				{:else}
					<ul class="lista">
						{#each data.closures as c (c.id)}
							<li>
								<span>
									{t(data.locale, 'adm.peche.rango', { desde: dateOf(c.from), ata: dateOf(c.to) })}
									{#if c.reason}<small>{c.reason}</small>{/if}
								</span>
								<form method="POST" action="?/borrarPeche">
									<input type="hidden" name="closureId" value={c.id} />
									<Button
										type="submit"
										variant="perigo"
										aria-label={t(data.locale, 'adm.peche.quitar_a', {
											desde: dateOf(c.from),
											ata: dateOf(c.to)
										})}>{t(data.locale, 'adm.peche.quitar')}</Button
									>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			{#if f.active}
				<section>
					<form method="POST" action="?/pechar">
						<Button type="submit" variant="perigo">{t(data.locale, 'adm.fac.desactivar')}</Button>
					</form>
				</section>
			{/if}
		{/snippet}
	</FacilityForm>
{/key}

<style>
	.mh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.botons {
		display: flex;
		gap: 8px;
	}

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 800;
	}

	.k a {
		color: var(--txt);
	}

	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}

	h2 {
		margin: 0 0 4px;
		font-size: 20px;
		font-weight: 900;
	}

	h3 {
		margin: 16px 0 6px;
		font-size: 16px;
		font-weight: 800;
	}

	.axuda {
		margin: 0 0 10px;
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

	.erro p {
		margin: 0 0 4px;
	}

	.aviso {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		margin: 0 0 14px;
		padding: 10px 14px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}

	.afectadas {
		margin: 0 0 14px;
		padding: 10px 14px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		font-weight: 800;
	}

	.afectadas p {
		margin: 0 0 8px;
	}

	.opcion {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 10px 0;
	}

	.opcion input:not([type='hidden']) {
		align-self: stretch;
	}

	.gardar {
		margin-top: 12px;
	}

	.peche {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		align-items: end;
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.campo.ancho {
		grid-column: 1 / -1;
	}

	label {
		font-weight: 800;
	}

	input:not([type='hidden']) {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	.lista {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.fotos,
	.foto-form {
		display: grid;
		gap: 10px;
	}

	.fotos {
		padding: 0;
		list-style: none;
	}

	.fotos li {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 8px;
		align-items: center;
	}

	.fotos img {
		width: 96px;
		height: 72px;
		object-fit: cover;
		border-radius: 8px;
	}

	.foto-accions {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.foto-accions form {
		margin: 0;
	}

	.lista li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 0;
		border-bottom: 1px solid var(--liña);
		font-weight: 800;
	}

	small {
		display: block;
		color: var(--texto-suave);
		font-weight: 600;
	}
</style>
