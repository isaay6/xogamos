<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import {
		dayLabel,
		durationText,
		facilityLabel,
		localDateOfInstant,
		longDate,
		nounFor,
		priceText
	} from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import AccessibilitySheet from '#lib/ui/AccessibilitySheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import BookingRules from '#lib/ui/BookingRules.svelte';
	import { formatAmount, formatTime } from '#lib/ui/format.js';
	import { formatEuros } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const f = $derived(data.facility);
	const accessInfo = $derived(locale === 'es' ? f.accessInfoEs || f.accessInfo : f.accessInfo);
	const sportName = $derived(locale === 'es' ? f.nameEs : f.nameGl);
	const noun = $derived(nounFor(f.bookingMode, f.mascot));
	const when = $derived(
		t(locale, 'vec.ao', {
			dia: dayLabel(locale, localDateOfInstant(data.startsAt), data.today),
			hora: formatTime(data.startsAt)
		})
	);
	const back = $derived(encodeURIComponent(data.redirectTo));

	let sending = $state(false);
</script>

<svelte:head>
	<title>{when} · {data.municipality.name}</title>
	<script type="application/ld+json">{JSON.stringify({
		'@context': 'https://schema.org', '@type': 'SportsActivityLocation', name: f.name,
		address: f.address, geo: f.latitude === null || f.longitude === null ? undefined : { '@type': 'GeoCoordinates', latitude: f.latitude, longitude: f.longitude },
		isAccessibleForFree: false,
		amenityFeature: [{ '@type': 'LocationFeatureSpecification', name: 'Accesibilidade', value: f.stepFreeAccess === 'yes' }],
		url: `/${data.municipality.slug}/confirmar?facility=${f.id}`
	})}</script>
</svelte:head>

<main class="confirmar" class:easy={data.easy}>
	{#if data.easy}
		<p class="paso">{t(locale, 'vec.facil.paso', { n: 4 })}</p>
		<div class="progreso"></div>
		<a class="atras" href="/{data.municipality.slug}/reservar/facil"
			>{t(locale, 'vec.facil.atras')}</a
		>
	{/if}
	{#if data.photos[0]}
		<img
			class="foto-principal"
			src="/api/v1/m/{data.municipality.slug}/facilities/{f.id}/photos/{data.photos[0].id}"
			alt={locale === 'es' ? (data.photos[0].altEs ?? data.photos[0].altGl) : data.photos[0].altGl}
		/>
	{:else}
		<Mascot kind={f.mascot} color={f.color} size={72} />
	{/if}
	<h1>{when}</h1>
	<dl class="resumo">
		<div>
			<dt>{t(locale, 'vec.confirmar.instalacion')}</dt>
			<dd>{sportName}, {facilityLabel(locale, f.name, data.unitIndex, noun)}</dd>
		</div>
		{#if f.location}
			<div>
				<dt>{t(locale, 'vec.confirmar.lugar')}</dt>
				<dd>{f.location}</dd>
			</div>
		{/if}
		<div>
			<dt>{t(locale, 'vec.confirmar.duracion')}</dt>
			<dd>{durationText(locale, data.startsAt, data.endsAt)}</dd>
		</div>
		<div>
			<dt>{t(locale, 'vec.confirmar.prezo')}</dt>
			<dd>
				{priceText(
					locale,
					data.resident,
					data.priceResidentCents,
					data.priceNonResidentCents,
					data.priceCents
				)}
				{#if data.priceCents && data.priceCents > 0}<br />{t(locale, 'vec.prezo.pago')}{/if}
			</dd>
		</div>
	</dl>
	{#if accessInfo}
		<section class="acceso" aria-labelledby="acceso-t">
			<h2 id="acceso-t">{t(locale, 'vec.acceso.titulo')}</h2>
			<p>{accessInfo}</p>
		</section>
	{/if}
	<AccessibilitySheet facility={f} {locale} />
	{#if data.photos.length}
		<section class="galeria" aria-labelledby="galeria-t">
			<h2 id="galeria-t">{t(locale, 'vec.fotos.titulo')}</h2>
			<div>
				{#each data.photos as photo (photo.id)}
					<img
						src="/api/v1/m/{data.municipality.slug}/facilities/{f.id}/photos/{photo.id}"
						alt={locale === 'es' ? (photo.altEs ?? photo.altGl) : photo.altGl}
					/>
				{/each}
			</div>
		</section>
	{/if}

	{#if form && 'penaltyUntil' in form && form.penaltyUntil}
		<div class="aviso" role="alert">
			<Mascot kind={f.mascot} color={f.color} mood="triste" size={56} />
			<Bubble
				>{t(locale, 'vec.confirmar.penalizado', {
					data: longDate(locale, new Date(form.penaltyUntil))
				})}</Bubble
			>
		</div>
	{:else if form && 'error' in form && form.error}
		<div class="aviso" role="alert">
			<Mascot kind={f.mascot} color={f.color} mood="triste" size={56} />
			<Bubble>{t(locale, `vec.erro.${form.error}` as MessageKey)}</Bubble>
		</div>
	{/if}

	{#if data.needsLogin}
		<div class="entra">
			<Mascot kind={f.mascot} color={f.color} size={56} />
			<Bubble>{t(locale, 'vec.confirmar.entra')}</Bubble>
		</div>
		<div class="botons">
			<Button href="/auth/clave/start?redirectTo={back}">{t(locale, 'vec.confirmar.clave')}</Button>
			<Button variant="out" href="/auth/chave365/start?redirectTo={back}"
				>{t(locale, 'vec.confirmar.chave365')}</Button
			>
		</div>
	{:else}
		<form
			method="POST"
			class="botons"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					await update();
					sending = false;
				};
			}}
		>
			{#if data.clubOptions.length}
				<fieldset class="club">
					<legend>{t(locale, 'vec.club.reservar_para')}</legend>
					<label class="club-opcion">
						<input type="radio" name="entityId" value="" checked={!data.selectedEntityId} />
						<span>{t(locale, 'vec.club.eu')}</span>
					</label>
					{#each data.clubOptions as club (club.id)}
						<label class="club-opcion">
							<input
								type="radio"
								name="entityId"
								value={club.id}
								checked={club.id === data.selectedEntityId}
							/>
							<span>{t(locale, 'vec.club.para_club', { club: club.name })}</span>
						</label>
					{/each}
				</fieldset>
			{/if}
			<BookingRules
				{locale}
				cancellationMinutes={data.cancellationDeadlineMinutes}
				noShowThreshold={data.rules.noShowThreshold}
				penaltyDays={data.rules.penaltyDays}
				maxDaysAhead={data.rules.maxDaysAhead}
				rulesHref={`/${data.municipality.slug}/legal/normas`}
				showAccept={!data.rules.accepted}
			/>
			{#if data.priceCents && data.priceCents > 0}
				<fieldset class="pago">
					<legend>{t(locale, 'vec.confirmar.prezo')}</legend>
					{#if data.walletCents !== null && data.walletCents >= data.priceCents}
						<label>
							<input type="radio" name="paymentMethod" value="wallet" checked />
							{t(locale, 'vec.monedero.pagar', { saldo: formatAmount(data.walletCents) })}
						</label>
					{:else if data.walletCents !== null}
						<p>
							{t(locale, 'vec.monedero.falta', {
								importe: formatAmount(data.priceCents - data.walletCents)
							})}
							<a href="/{data.municipality.slug}/eu/monedero"
								>{t(locale, 'vec.monedero.recargar_enlace')}</a
							>
						</p>
					{/if}
					<label>
						<input
							type="radio"
							name="paymentMethod"
							value="facility"
							checked={data.walletCents === null || data.walletCents < data.priceCents}
						/>
						{t(locale, 'vec.monedero.pagar_instalacion')}
					</label>
				</fieldset>
			{/if}
			<Button type="submit" disabled={sending} aria-busy={sending}>
				{t(locale, sending ? 'vec.confirmar.enviando' : 'vec.confirmar.reservar')}
			</Button>
		</form>
	{/if}
</main>

<style>
	.confirmar {
		padding: 20px 16px 24px;
	}
	.acceso {
		margin: 16px 0;
		padding: 12px;
		border-radius: var(--radio);
		background: var(--ceo);
	}
	.acceso h2,
	.acceso p {
		margin: 0;
	}
	.acceso p {
		margin-top: 4px;
	}
	.paso {
		font-size: 20px;
		font-weight: 800;
	}

	.progreso {
		height: 10px;
		margin: 8px 0 18px;
		border-radius: 99px;
		background: var(--concello);
	}

	.atras {
		display: inline-flex;
		min-height: var(--toque);
		align-items: center;
		color: inherit;
		font-weight: 800;
	}

	.confirmar :global(button) {
		min-height: 64px;
		font-size: 24px;
	}

	.confirmar.easy {
		font-size: 22px;
	}

	.confirmar.easy h1 {
		font-size: 42px;
	}

	.confirmar.easy :global(.normas) {
		font-size: 21px;
	}

	.confirmar.easy :global(button) {
		min-height: 88px;
		font-size: 32px;
	}

	.pago {
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
	}
	.club {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.club legend {
		font-weight: 800;
	}
	.club-opcion {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--toque);
		padding: 10px 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}
	.club-opcion input {
		width: 20px;
		height: 20px;
	}

	.pago label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
	}

	h1 {
		font-size: 30px;
		margin-bottom: 12px;
	}

	.resumo {
		display: grid;
		gap: 0;
		margin: 0;
	}

	.resumo div {
		display: grid;
		grid-template-columns: 7.5em 1fr;
		gap: 8px;
		padding: 10px 0;
		border-bottom: 2px solid var(--ceo);
	}

	dt {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	dd {
		margin: 0;
		font-weight: 800;
	}

	.entra,
	.aviso {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 18px;
	}

	.botons {
		display: grid;
		gap: 10px;
		margin-top: 18px;
	}

	.galeria {
		margin-top: 18px;
	}

	.galeria h2 {
		font-size: 18px;
	}

	.galeria > div {
		display: flex;
		gap: 8px;
		overflow-x: auto;
	}

	.galeria img {
		width: 152px;
		height: 104px;
		flex: 0 0 auto;
		object-fit: cover;
		border-radius: 10px;
	}

	.foto-principal {
		width: 100%;
		max-width: 420px;
		height: 180px;
		object-fit: cover;
		border-radius: 12px;
	}
</style>
