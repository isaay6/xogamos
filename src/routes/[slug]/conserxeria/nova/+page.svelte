<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import Avatar from '#lib/ui/Avatar.svelte';
	import Button from '#lib/ui/Button.svelte';
	import DayStrip from '#lib/ui/DayStrip.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import { formatEuros, formatTime } from '#lib/ui/format.js';
	import HourGrid from '#lib/ui/HourGrid.svelte';
	import BuscaPersoa from '../BuscaPersoa.svelte';
	import BookingRules from '#lib/ui/BookingRules.svelte';
	import { dayLabel } from '../dates';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/conserxeria`);
	const busca = $derived(form && 'busca' in form ? form.busca : null);
	const booked = $derived(form && 'booked' in form ? form.booked : null);
	const bookError = $derived(
		form && 'error' in form && !('novaPersoaError' in form) ? form.error : null
	);
	const personError = $derived(form && 'novaPersoaError' in form);
	const personErrorKey = $derived<MessageKey>(
		form && 'error' in form && form.error === 'DNI_EXISTS'
			? 'cons.nova.nova.DNI_EXISTS'
			: form && 'dniError' in form
				? 'cons.nova.nova.dniErro'
				: 'cons.nova.nova.erro'
	);
	// O DNI xa escrito (letra correcta, sen ninguén) pasa ao alta: non hai que volver escribilo.
	const prefillDni = $derived(busca?.mode === 'sen-dni' ? busca.dni : null);

	let date = $derived(data.date);
	let time = $derived<string | null>(data.time);

	const sportHref = (typeId: string) =>
		`?${new URLSearchParams({ ...(data.person ? { persoa: data.person.profileId } : {}), tipo: typeId })}`;
	// El estado va en la query: tras reservar, la página sigue con la misma persona y deporte.
	const reservarAction = $derived(
		`?/reservar&${new URLSearchParams({
			persoa: data.person?.profileId ?? '',
			tipo: data.sport?.typeId ?? '',
			date: data.date,
			...(data.time ? { time: data.time } : {})
		})}`
	);
	const maxSeats = $derived(Math.max(1, ...data.options.map((o) => o.remainingSeats ?? 1)));
	const optionName = (o: (typeof data.options)[number]) =>
		facilityLabel(locale, o.facilityName, o.unitIndex, nounFor('unit', data.sport?.mascot ?? ''));
	const when = (iso: string) => `${dayLabel(locale, iso)} · ${formatTime(new Date(iso))}`;
</script>

<svelte:head>
	<title>{t(locale, 'cons.nova.titulo')}</title>
</svelte:head>

<header class="mh">
	<p class="k">{t(locale, 'cons.nova.sub')}</p>
	<h1>{t(locale, 'cons.nova.titulo')}</h1>
</header>

<div class="cols">
	<div class="col">
		<!-- 1 · Persoa -->
		<section aria-labelledby="p1" data-tour="nova-reserva">
			<h2 id="p1" class="k">{t(locale, 'cons.nova.p1')}</h2>
			{#if data.person}
				<div class="card">
					<Avatar
						avatar={data.person.avatar}
						userId={data.person.userId}
						name={data.person.displayName}
						size={44}
						{locale}
						decorative
					/>
					<div>
						<b>{data.person.displayName}</b>
						<p class="k">
							{t(locale, data.person.isResident ? 'cons.panel.empadroada' : 'cons.panel.nonempadroada')}
							{#if data.person.socialTariff}
								· {t(locale, `cons.tarifa.${data.person.socialTariff}` as MessageKey)}{/if}
							{#if data.person.phone}
								· {t(locale, 'cons.nova.tel', { tel: data.person.phone })}{/if}
						</p>
						{#if data.lastBooking}
							<p class="k">
								{t(locale, 'cons.nova.ultima', {
									nome: data.lastBooking.facilityName,
									data: dayLabel(locale, new Date(data.lastBooking.startsAt).toISOString())
								})}
							</p>
						{/if}
					</div>
				</div>
				<p class="links">
					<a class="link" href={`${base}/nova`}>{t(locale, 'cons.nova.cambiar')}</a>
					<a class="link" href={`${base}/persoa?persoa=${data.person.profileId}`}
						>{t(locale, 'cons.panel.ficha')}</a
					>
				</p>
			{:else}
				<BuscaPersoa
					{locale}
					{busca}
					resetHref={`${base}/nova`}
					registerHref="#nova-persoa"
					confirmAction="?/confirmarDni"
				/>
				<p class="k">{t(locale, 'cons.nova.axuda')}</p>
				<form method="POST" action="?/novaPersoa" class="nova" id="nova-persoa">
					<h3>{t(locale, 'cons.nova.nova.titulo')}</h3>
					{#if personError}
						<p class="err" role="alert">{t(locale, personErrorKey)}</p>
					{/if}
					<label>
						<span class="k">{t(locale, 'cons.nova.nova.nome')}</span>
						<input
							name="nome"
							required
							maxlength="120"
							autocomplete="off"
							value={form && 'nome' in form ? form.nome : ''}
						/>
					</label>
					<label>
						<span class="k">{t(locale, 'cons.nova.nova.telefono')}</span>
						<input
							name="telefono"
							type="tel"
							required
							autocomplete="off"
							value={form && 'telefono' in form ? form.telefono : ''}
						/>
					</label>
					<label>
						<span class="k">{t(locale, 'cons.nova.nova.dni')}</span>
						<input
							name="dni"
							autocomplete="off"
							spellcheck="false"
							maxlength="12"
							value={form && 'dni' in form ? form.dni : (prefillDni ?? '')}
						/>
					</label>
					<Button type="submit" variant="out">{t(locale, 'cons.nova.nova.crear')}</Button>
				</form>
			{/if}
		</section>

		<!-- 3 · Confirmar -->
		<section aria-labelledby="p3">
			<h2 id="p3" class="k">{t(locale, 'cons.nova.p3')}</h2>
			{#if booked}
				<div class="feita" role="status">
					<p class="v">{t(locale, 'cons.nova.feita')}</p>
					<Fob
						code={booked.accessCode}
						color={booked.color}
						title={booked.facilityName}
						subtitle={when(booked.startsAt)}
						size="lg"
						{locale}
					/>
					<p class="dille">{t(locale, 'cons.nova.dille')}</p>
					<p class="k">
						{booked.displayName} · {formatEuros(booked.priceCents, locale)} · {t(
							locale,
							'cons.nova.pago'
						)}
					</p>
					<Button href={`${base}/nova/${booked.id}/xustificante`} variant="out"
						>{t(locale, 'cons.nova.imprimir')}</Button
					>
					<a class="link" href={`${base}/nova`}>{t(locale, 'cons.nova.outra')}</a>
				</div>
			{:else if data.person && data.options.length > 0}
				<form method="POST" action={reservarAction} class="conf">
					<input type="hidden" name="persoa" value={data.person.profileId} />
					{#if bookError}
						<p class="err" role="alert">
							{t(locale, `cons.nova.err.${bookError}` as MessageKey)}
						</p>
					{/if}
					<fieldset class="opcions">
						<legend class="k">{t(locale, 'cons.nova.opcions')}</legend>
						{#each data.options as o (o.value)}
							<label class="opcion">
								<input
									type="radio"
									name="opcion"
									value={o.value}
									required
									checked={o.value === data.selected || data.options.length === 1}
								/>
								<span
									>{t(locale, 'cons.nova.opcion', {
										nome: optionName(o),
										hora: formatTime(new Date(o.startsAt)),
										prezo: formatEuros(o.priceCents, locale)
									})}</span
								>
							</label>
						{/each}
					</fieldset>
					{#if data.sport?.bookingMode === 'capacity'}
						<label class="prazas">
							<span class="k">{t(locale, 'cons.nova.prazas', { n: maxSeats })}</span>
							<input name="seats" type="number" min="1" max={maxSeats} value="1" inputmode="numeric" />
						</label>
					{/if}
					<fieldset class="canle">
						<legend class="k">{t(locale, 'cons.nova.canle')}</legend>
						<label
							><input type="radio" name="canle" value="phone" checked />
							{t(locale, 'cons.nova.canle.phone')}</label
						>
						<label
							><input type="radio" name="canle" value="desk" />
							{t(locale, 'cons.nova.canle.desk')}</label
						>
					</fieldset>
					<p class="k">{t(locale, 'cons.nova.pago')}</p>
					{#if data.rules}
						<BookingRules
							{locale}
							cancellationMinutes={data.rules.cancellationMinutes}
							noShowThreshold={data.rules.noShowThreshold}
							penaltyDays={data.rules.penaltyDays}
							maxDaysAhead={data.rules.maxDaysAhead}
							rulesHref={`/${data.municipality.slug}/legal/normas`}
						/>
					{/if}
					<Button type="submit"
						>{t(locale, 'cons.nova.reservar', { nome: data.person.displayName })}</Button
					>
				</form>
			{/if}
		</section>
	</div>

	<!-- 2 · Que e cando -->
	<section class="col" aria-labelledby="p2">
		<h2 id="p2" class="k">{t(locale, 'cons.nova.p2')}</h2>
		{#if !data.person}
			<p class="k">{t(locale, 'cons.nova.escollePersoa')}</p>
		{:else}
			<nav class="deportes" aria-label={t(locale, 'cons.nova.deporte')}>
				{#each data.sports as s (s.typeId)}
					<a
						href={sportHref(s.typeId)}
						aria-current={data.sport?.typeId === s.typeId ? 'true' : undefined}
						class:on={data.sport?.typeId === s.typeId}
						>{locale === 'es' ? s.nameEs : s.nameGl}</a
					>
				{/each}
			</nav>
			{#if data.sport}
				<form method="GET" class="cando">
					<input type="hidden" name="persoa" value={data.person.profileId} />
					<input type="hidden" name="tipo" value={data.sport.typeId} />
					<DayStrip days={data.days} bind:selected={date} {locale} name="date" />
					{#if data.hours.length > 0}
						<HourGrid hours={data.hours} bind:selected={time} name="time" {locale} />
					{/if}
					<Button type="submit" variant="out">{t(locale, 'cons.nova.ver')}</Button>
				</form>
				{#if data.options.length === 0}
					<p class="k">
						{t(locale, data.time || data.sport.bookingMode === 'day' ? 'cons.nova.sen' : 'cons.nova.escolleHora')}
					</p>
				{/if}
			{:else}
				<p class="k">{t(locale, 'cons.nova.escolleDeporte')}</p>
			{/if}
		{/if}
	</section>
</div>

<style>
	.mh {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}
	h2.k {
		margin: 0 0 6px;
		letter-spacing: 0.04em;
	}
	h3 {
		margin: 0;
		font-size: 15px;
	}
	.k {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr 1.25fr;
		gap: 24px;
		align-items: start;
	}
	.col {
		display: grid;
		gap: 20px;
		min-width: 0;
	}
	section {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.card {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 12px;
		border: 2px solid var(--ceo);
		border-radius: var(--radio);
	}
	.card p {
		margin: 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 0;
	}
	.link {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
		font-weight: 800;
	}
	input:not([type='radio']):not([type='hidden']) {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
		width: 100%;
	}
	.nova {
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 2px dashed var(--apagado);
		border-radius: var(--radio);
	}
	.nova label {
		display: grid;
	}
	.deportes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.deportes a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 14px;
		border-radius: 10px;
		background: var(--ceo);
		color: var(--txt);
		font-weight: 800;
		text-decoration: none;
	}
	.deportes a.on {
		background: var(--txt);
		color: var(--branco);
	}
	.cando {
		display: grid;
		gap: 10px;
	}
	.conf {
		display: grid;
		gap: 10px;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: grid;
		gap: 6px;
	}
	.opcion,
	.canle label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		font-weight: 700;
	}
	input[type='radio'] {
		width: 22px;
		height: 22px;
	}
	.prazas {
		display: grid;
		max-width: 160px;
	}
	.feita {
		display: grid;
		gap: 10px;
		justify-items: center;
		padding: 16px;
		border: 2px solid var(--herba);
		border-radius: var(--radio);
		background: #eaf6ee;
		text-align: center;
	}
	.feita .k,
	.feita p {
		margin: 0;
	}
	.v {
		font-weight: 800;
		color: #1f7a3b;
	}
	.dille {
		font-size: 18px;
		font-weight: 900;
	}
	.err {
		margin: 0;
		padding: 10px 12px;
		border: 2px solid var(--perigo);
		border-radius: 8px;
		color: var(--perigo);
		font-weight: 800;
	}
	a:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	@media (max-width: 899px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
</style>
