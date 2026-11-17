<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { mapHref } from '#lib/ui/map-link.js';
	import { googleCalendarUrl, outlookCalendarUrl } from '#lib/ui/calendar-links.js';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import {
		cancellationText,
		dayLabel,
		durationText,
		facilityLabel,
		localDateOfInstant,
		nounFor
	} from '#lib/ui/booking-text.js';
	import Button from '#lib/ui/Button.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatDay, formatEuros, formatTime, longDate } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STATUS_TEXT: Record<'cancelled' | 'no_show' | 'attended', MessageKey> = {
		cancelled: 'vec.reserva.estado.cancelled',
		no_show: 'vec.reserva.estado.no_show',
		attended: 'vec.reserva.estado.attended'
	};

	const locale = $derived(data.locale);
	const slug = $derived(data.municipality.slug);
	const f = $derived(data.facility);
	const accessInfo = $derived(locale === 'es' ? f.accessInfoEs || f.accessInfo : f.accessInfo);
	const sport = $derived(locale === 'es' ? f.nameEs : f.nameGl);
	const date = $derived(localDateOfInstant(data.startsAt));
	const rel = $derived(dayLabel(locale, date, data.today));
	// «Pádel, mañá ás 19:00»; si no es hoy ni mañana, con la fecha:
	// «Pádel, 27 de novembro ás 19:00».
	const title = $derived(
		t(locale, 'vec.reserva.pin_cando', {
			deporte: sport,
			dia: /\d/.test(rel) ? longDate(locale, date) : rel.toLocaleLowerCase(locale),
			hora: formatTime(data.startsAt)
		})
	);
	const unit = $derived(
		facilityLabel(locale, f.name, data.unitIndex, nounFor(f.bookingMode, f.mascot))
	);
	const place = $derived([f.location, f.address].filter(Boolean).join(' · '));
	const calEvent = $derived({
		title: `${title} · ${data.municipality.name}`,
		start: new Date(data.startsAt),
		end: new Date(data.endsAt),
		location: place
	});
	// `geo:` abre la app de mapas del sistema, sin terceros; sin dirección no hay enlace.
	const map = $derived(
		mapHref({
			latitude: f.latitude ?? null,
			longitude: f.longitude ?? null,
			address: f.address,
			municipalityName: data.municipality.name
		})
	);
	// Una confirmada que ya empezó no cambia el texto de estado salvo para decir que empezó.
	const note = $derived(
		data.status !== 'confirmed'
			? t(locale, STATUS_TEXT[data.status])
			: data.editable
				? null
				: t(locale, 'vec.reserva.estado.pasada')
	);
</script>

<svelte:head>
	<title>{title} · {data.municipality.name}</title>
</svelte:head>

<main class="detalle">
	<a class="volver" href="/{slug}/reservas"
		><span aria-hidden="true">‹</span>{t(locale, 'vec.reserva.volver')}</a
	>

	<!-- Cancelada, usada o con falta: el código ya no abre nada, no se enseña -->
	{#if data.status === 'confirmed' && data.code}
		<div class="chaveiro">
			<Fob
				code={data.code}
				color={f.color}
				size="xl"
				qr={data.qr}
				qrLabel={t(locale, 'vec.reserva.qr')}
				{locale}
			/>
		</div>
	{/if}

	<h1>{title}</h1>
	{#if data.entityName}<span class="club-chip">{data.entityName}</span>{/if}
	{#if note}<p class="nota">{note}</p>{/if}

	<ul class="datos">
		<li>
			<svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
				<rect
					x="3"
					y="5"
					width="18"
					height="16"
					rx="3"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
				/>
				<path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
			</svg>
			<span
				><b>{formatDay(locale, date).weekday} {longDate(locale, date)}</b>{t(
					locale,
					'vec.reserva.cando',
					{
						inicio: formatTime(data.startsAt),
						fin: formatTime(data.endsAt),
						duracion: durationText(locale, data.startsAt, data.endsAt)
					}
				)}</span
			>
		</li>
		<li>
			<span class="ico"><Mascot kind={f.mascot} color={f.color} size={20} animated={false} /></span>
			<span
				><b>{sport} · {unit}</b>{place}
				{#if map}
					· <a class="chegar" href={map} target="_blank" rel="noopener noreferrer"
						>{t(locale, 'vec.mapa.ver')}</a
					>
				{/if}</span
			>
		</li>
		<li>
			<span class="ico euro" aria-hidden="true">€</span>
			<span>
				<b>{formatEuros(data.priceCents, locale)}</b>
				{t(locale, 'vec.reserva.prezo')}
				{#if data.priceCents > 0}
					<br />
					{t(
						locale,
						data.paymentMethod === 'wallet'
							? 'vec.reserva.pago_monedero'
							: 'vec.reserva.pago_instalacion'
					)}
				{/if}
			</span>
		</li>
	</ul>

	<div class="normas">
		<b>{t(locale, 'vec.reserva.normas')}</b>
		{#if f.rules}<p class="propias">{f.rules}</p>{/if}
		{#if locale === 'es' && f.rules}<p class="propias">{t(locale, 'vec.info.gl')}</p>{/if}
		{#if accessInfo}
			<p><b>{t(locale, 'vec.acceso.titulo')}</b></p>
			<p class="propias">{accessInfo}</p>
		{/if}
		<p>{cancellationText(locale, f.cancellationDeadlineMinutes)}</p>
		{#if data.code}<p>{t(locale, 'vec.reserva.amosar')}</p>{/if}
	</div>

	{#if data.editable}
		<div class="accions">
			{#if data.inTime}
				<Button variant="out" href="/{slug}/reserva/{data.id}/cambiar"
					>{t(locale, 'vec.reserva.cambiar')}</Button
				>
			{:else}
				<p class="nota tarde">{t(locale, 'vec.reserva.cambiar_tarde')}</p>
			{/if}
			{#if data.inTime}
				<a class="cancelar" href="/{slug}/reserva/{data.id}/cancelar"
					>{t(locale, 'vec.reserva.cancelar')}</a
				>
			{:else}
				<p class="nota tarde">{t(locale, 'vec.cancelar.tarde')}</p>
			{/if}
		</div>
	{/if}
	{#if data.status === 'confirmed'}
		<div class="cal">
			<Button href="/api/v1/m/{slug}/me/bookings.ics?booking={data.id}"
				>{t(locale, 'vec.reserva.calendario')}</Button
			>
			<div class="cal-outros">
				<a href={googleCalendarUrl(calEvent)} target="_blank" rel="noopener noreferrer"
					>{t(locale, 'vec.reserva.google')}</a
				>
				<a href={outlookCalendarUrl(calEvent)} target="_blank" rel="noopener noreferrer"
					>{t(locale, 'vec.reserva.outlook')}</a
				>
			</div>
		</div>
	{/if}
</main>

<style>
	.detalle {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 12px 16px 24px;
	}

	.volver {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 4px;
		min-height: var(--toque);
		font-size: 15px;
		font-weight: 800;
		color: var(--texto-suave);
		text-decoration: none;
	}

	.chaveiro {
		display: flex;
		justify-content: center;
	}

	h1 {
		font-size: 28px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.nota {
		font-weight: 800;
	}
	.club-chip {
		width: fit-content;
		padding: 4px 8px;
		border-radius: 99px;
		background: var(--ceo);
		font-size: 13px;
		font-weight: 800;
	}

	/* Datos en filas cun pequeno símbolo (mockup B3, opción 1) */
	.datos {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.datos li {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr);
		gap: 10px;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.35;
	}

	.datos b {
		display: block;
		font-weight: 900;
	}

	.ico {
		display: flex;
		margin-top: 2px;
		color: var(--txt);
	}

	.euro {
		justify-content: center;
		font-size: 18px;
		font-weight: 900;
	}

	.chegar {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: var(--txt);
		text-decoration: underline;
	}

	.normas {
		display: grid;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--ceo);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.45;
	}

	.normas b {
		font-weight: 900;
	}

	/* Las normas propias son texto llano: se respetan los saltos de línea */
	.propias {
		white-space: pre-line;
	}

	.accions {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 8px;
	}

	.tarde {
		align-self: center;
		font-size: 14px;
	}

	.cal {
		display: grid;
		gap: 8px;
	}

	/* Google e Outlook: ligazóns discretas baixo o botón do .ics */
	.cal-outros {
		display: flex;
		gap: 16px;
		justify-content: center;
	}

	.cal-outros a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 700;
	}

	/* Mismo aspecto que un botón «out», pero en rojo: es la acción destructiva */
	.cancelar {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--toque);
		padding: 12px 16px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--perigo);
		font-size: 16px;
		font-weight: 800;
		text-align: center;
		text-decoration: none;
	}
</style>
