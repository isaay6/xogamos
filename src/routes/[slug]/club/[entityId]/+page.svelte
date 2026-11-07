<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { TZDate } from '@date-fns/tz';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import { formatEuros, formatTime, longDate } from '#lib/ui/format.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	function localDate(date: Date) {
		const local = new TZDate(date.getTime(), 'Europe/Madrid');
		return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
	}
	function bookingDate(date: Date) {
		const iso = localDate(date);
		const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
		return t(locale, 'vec.club.data_reserva', {
			dia: t(locale, `vec.club.semana.${weekday}` as MessageKey),
			data: longDate(locale, iso)
		});
	}
	function conditions() {
		const price =
			data.entity.priceMode === 'free'
				? t(locale, 'vec.club.condicions.gratis')
				: data.entity.priceMode === 'fixed'
					? t(locale, 'vec.club.condicions.fixo', {
							prezo: formatEuros(data.entity.fixedPriceCents ?? 0, locale)
						})
					: t(locale, 'vec.club.condicions.normal');
		return [
			price,
			data.entity.advanceDays == null
				? null
				: t(locale, 'vec.club.condicions.adianto', { n: data.entity.advanceDays }),
			data.entity.maxActiveBookings == null
				? null
				: t(locale, 'vec.club.condicions.activas', { n: data.entity.maxActiveBookings }),
			t(
				locale,
				data.entity.noShowsCount ? 'vec.club.condicions.faltas' : 'vec.club.condicions.sen_faltas'
			)
		].filter(Boolean);
	}
</script>

<svelte:head
	><title>{t(locale, 'vec.club.titulo')} · {data.entity.name} · {data.municipality.name}</title
	></svelte:head
>
<main class="club">
	<a class="volver" href="{base}/eu/perfil">{t(locale, 'vec.eu.volver')}</a>
	<header class="cabecera">
		<span class="sigla">{data.entity.shortName}</span>
		<div>
			<p>{t(locale, 'vec.club.titulo')}</p>
			<h1>{data.entity.name}</h1>
		</div>
	</header>
	<section class="tarxeta">
		<h2>{t(locale, 'vec.club.condicions')}</h2>
		<ul class="condicions">
			{#each conditions() as condition (condition)}<li>{condition}</li>{/each}
		</ul>
	</section>
	<section>
		<h2>{t(locale, 'vec.club.reservas')}</h2>
		{#if data.upcoming.length === 0}<p class="vacio">
				{t(locale, 'vec.club.reservas_baleiro')}
			</p>{:else}<ul class="reservas">
				{#each data.upcoming as booking (booking.id)}<li class="reserva">
						<div>
							<span class="data">{bookingDate(booking.startsAt)}</span><b>{booking.facilityName}</b
							><span>{formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}</span>
						</div>
						<form method="POST" action="?/cancelar">
							<input type="hidden" name="bookingId" value={booking.id} /><Button
								type="submit"
								variant="out">{t(locale, 'vec.reserva.cancelar')}</Button
							>
						</form>
					</li>{/each}
			</ul>{/if}
	</section>
	<section>
		<h2>{t(locale, 'vec.club.tempadas')}</h2>
		{#if data.seasons.length === 0}<p class="vacio">
				{t(locale, 'vec.club.tempadas_baleiro')}
			</p>{:else}<ul class="tempadas">
				{#each data.seasons as season (season.id)}<li>
						<b>{t(locale, `vec.club.semana.${season.weekday}` as MessageKey)}</b><span
							>{season.startsTime}–{season.endsTime}</span
						><span
							>{t(locale, 'vec.club.rango_datas', {
								desde: longDate(locale, season.fromDate),
								ata: longDate(locale, season.toDate)
							})}</span
						>
					</li>{/each}
			</ul>{/if}
	</section>
	<section>
		<h2>{t(locale, 'vec.club.solicitudes')}</h2>
		<Button href={`${base}/solicitudes/nova?entityId=${data.entity.id}`}
			>{t(locale, 'vec.sol.nova')}</Button
		>
	</section>
</main>

<style>
	.club {
		max-width: 720px;
		padding: 12px 16px 24px;
	}
	.volver {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: inherit;
		font-weight: 800;
	}
	.cabecera {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 8px 0 20px;
	}
	.sigla {
		display: grid;
		place-items: center;
		min-width: 56px;
		min-height: 56px;
		padding: 0 8px;
		border-radius: 14px;
		background: var(--txt);
		color: var(--branco);
		font-size: 18px;
		font-weight: 900;
	}
	.cabecera p {
		margin: 0 0 2px;
		color: var(--texto-suave);
		font-weight: 700;
	}
	h1,
	h2 {
		margin: 0;
		font-weight: 900;
	}
	h1 {
		font-size: 28px;
		overflow-wrap: anywhere;
	}
	h2 {
		margin-bottom: 8px;
		font-size: 20px;
	}
	section {
		margin-top: 20px;
	}
	.tarxeta {
		padding: 14px;
		border-radius: var(--radio);
		background: var(--ceo);
	}
	.condicions,
	.reservas,
	.tempadas {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.condicions {
		display: grid;
		gap: 5px;
		color: var(--texto-suave);
		font-weight: 600;
	}
	.reserva {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 2px solid var(--ceo);
	}
	.reserva > div {
		display: grid;
		gap: 2px;
	}
	.data {
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--gris);
	}
	.reserva b {
		font-size: 18px;
	}
	.reserva span:not(.data),
	.tempadas span {
		color: var(--texto-suave);
		font-weight: 600;
	}
	.tempadas {
		display: grid;
		gap: 8px;
	}
	.tempadas li {
		display: grid;
		grid-template-columns: minmax(92px, 1fr) auto;
		gap: 2px 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--liña);
	}
	.tempadas li span:last-child {
		grid-column: 1/-1;
		font-size: 14px;
	}
	.vacio {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}
</style>
