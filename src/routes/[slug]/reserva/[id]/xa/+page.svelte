<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { dayLabel, facilityLabel, localDateOfInstant, nounFor } from '#lib/ui/booking-text.js';
	import Button from '#lib/ui/Button.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatTime } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const slug = $derived(data.municipality.slug);
	const f = $derived(data.facility);
	const noun = $derived(nounFor(f.bookingMode, f.mascot));
	const title = $derived(
		t(locale, 'vec.xa.chaveiro', {
			deporte: locale === 'es' ? f.nameEs : f.nameGl,
			instalacion: facilityLabel(locale, f.name, data.unitIndex, noun)
		})
	);
	const day = $derived(dayLabel(locale, localDateOfInstant(data.startsAt), data.today));
	const subtitle = $derived(`${day} ${formatTime(data.startsAt)}`);
</script>

<svelte:head>
	<title>{t(locale, 'vec.xa.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="xa" class:easy={data.easy}>
	{#if data.code}
		{#if data.photo}
			<img
				class="foto"
				src="/api/v1/m/{slug}/facilities/{f.id}/photos/{data.photo.id}"
				alt={locale === 'es' ? (data.photo.altEs ?? data.photo.altGl) : data.photo.altGl}
			/>
		{:else}
			<Mascot kind={f.mascot} color={f.color} size={72} />
		{/if}
		<Fob
			code={data.code}
			color={f.color}
			size="xl"
			qr={data.qr}
			qrLabel={t(locale, 'vec.reserva.qr')}
			drop
			{locale}
		/>
		<h1>{t(locale, 'vec.xa.titulo')}</h1>
		<p class="cal">{title} · {subtitle}</p>
		<p>{t(locale, 'vec.xa.texto')}</p>
		<div class="botons">
			<Button href="/api/v1/m/{slug}/me/bookings.ics">{t(locale, 'vec.xa.calendario')}</Button>
			<Button variant="out" href="/{slug}/reservas">{t(locale, 'vec.xa.reservas')}</Button>
		</div>
	{:else}
		<h1>{title}</h1>
		<p>{t(locale, 'vec.xa.sen_codigo')}</p>
		<div class="botons">
			<Button href="/{slug}/reserva/{data.bookingId}">{t(locale, 'vec.xa.ver_reserva')}</Button>
		</div>
	{/if}
</main>

<style>
	.xa {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px 16px 24px;
		text-align: center;
	}
	.xa.easy h1 {
		font-size: 46px;
	}

	.xa.easy :global(.chaveiro) {
		transform: scale(1.24);
		margin: 28px 0;
	}

	h1 {
		margin-top: 8px;
		font-size: 34px;
	}

	.cal {
		font-weight: 800;
		color: var(--txt);
	}

	p {
		font-size: 16px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.botons {
		display: grid;
		gap: 10px;
		width: 100%;
		max-width: 420px;
		margin-top: 12px;
	}

	.foto {
		width: 152px;
		height: 104px;
		object-fit: cover;
		border-radius: 12px;
	}
</style>
