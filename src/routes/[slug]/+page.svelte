<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { dayLabel, facilityLabel, localDateOfInstant, nounFor } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import { formatAmount, formatEuros, formatTime, longDate } from '#lib/ui/format.js';
	import Lamps from '#lib/ui/Lamps.svelte';
	import { localDate } from '#lib/ui/closure-text.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const sportName = (s: { nameGl: string; nameEs: string }) =>
		locale === 'es' ? s.nameEs : s.nameGl;

	/** Día de la semana de una fecha local, 0 = domingo (como `semana.N`). */
	function weekday(date: string): number {
		const [y, m, d] = date.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	}

	// Sin sesión: «Xoves 22 de outubro · 16:40».
	const dateLine = $derived(
		t(locale, 'vec.inicio.data', {
			semana: t(locale, `vec.semana.longo.${weekday(data.today)}` as MessageKey),
			data: longDate(locale, data.today),
			hora: formatTime(data.now)
		})
	);

	const next = $derived(data.next);
	// «Pádel, mañá ás 19:00»; si no es hoy ni mañana, con la fecha (como en el detalle).
	const nextTitle = $derived.by(() => {
		if (!next) return '';
		const date = localDateOfInstant(next.startsAt);
		const rel = dayLabel(locale, date, data.today);
		return t(locale, 'vec.reserva.pin_cando', {
			deporte: locale === 'es' ? next.sportEs : next.sportGl,
			dia: /\d/.test(rel) ? longDate(locale, date) : rel.toLocaleLowerCase(locale),
			hora: formatTime(next.startsAt)
		});
	});
	const nextPlace = $derived(
		next
			? facilityLabel(
					locale,
					next.facilityName,
					next.unitIndex,
					nounFor(next.bookingMode, next.mascot)
				)
			: ''
	);
	const streakText = $derived(
		data.streak === 0
			? t(locale, 'vec.eu.racha.zero')
			: data.streak < 4
				? data.streak === 3
					? t(locale, 'vec.eu.racha.case', { n: data.streak })
					: t(locale, 'vec.eu.racha.pouca', {
							n: data.streak,
							plural: data.streak === 1 ? '' : 's',
							faltan: 4 - data.streak
						})
				: t(locale, 'vec.eu.racha.torre', { n: data.streak })
	);

	/** Lo que dice cada deporte de la rejilla: su siguiente hora libre o el peche. */
	function sportStatus(s: (typeof data.sports)[number]): string {
		if (s.next) {
			const key =
				s.next.date === data.today ? 'vec.inicio.deporte.libre' : 'vec.inicio.deporte.mana';
			return t(locale, key, { hora: s.next.time });
		}
		if (s.closed?.holiday) return t(locale, 'dia.festivo', { nome: s.closed.reason });
		if (s.closed) return localDate(locale, s.closed);
		return t(locale, 'vec.inicio.deporte.sen');
	}
</script>

<svelte:head>
	<title>{t(locale, 'vec.inicio.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="inicio">
	{#if page.url.searchParams.has('conta-eliminada')}
		<p class="conta-eliminada" role="status">{t(locale, 'vec.datos.borrar.feito')}</p>
	{/if}
	{#if data.signedIn && data.walletCents !== null}
		<a class="monedero-chip" href="{base}/eu/monedero">
			{t(locale, 'vec.monedero.saldo')}: {formatAmount(data.walletCents)}
		</a>
	{/if}
	{#if data.easyBooking}
		<h1>{t(locale, 'vec.inicio.titulo')}</h1>
		<nav class="facil-home" aria-label={t(locale, 'vec.inicio.titulo')}>
			<a href="{base}/reservar/facil">{t(locale, 'vec.facil.reservar')}</a>
			<a href="{base}/reservas">{t(locale, 'vec.inicio.abonos.qr')}</a>
			<a href="{base}/avisos">{t(locale, 'vec.inicio.avisos')}</a>
		</nav>
	{:else}
		<p class="k">{data.saudo ?? dateLine}</p>
		<h1 class:sr={!!next}>{t(locale, 'vec.inicio.titulo')}</h1>

		<!-- 1. A túa próxima reserva: chaveiro co PIN e o QR pequeno; tócase para velo grande -->
		{#if next}
			<section class="proxima">
				<h2 class="k">{t(locale, 'vec.inicio.proxima')}</h2>
				<p class="titular">{nextTitle}</p>
				<a class="chave" href="{base}/reserva/{next.id}">
					<span class="sr">{t(locale, 'vec.inicio.ver_reserva')}</span>
					<Fob
						size="row"
						code={next.code}
						color={next.color}
						qr={next.qr}
						subtitle={nextPlace}
						{locale}
					/>
					{#if next.entityName}<span class="club-chip">{next.entityName}</span>{/if}
				</a>
				<p class="mini"><Lamps lit={Math.min(data.streak, 4)} />{streakText}</p>
			</section>
		{/if}

		{#if data.unread > 0}
			<p class="senler">
				<a href="{base}/avisos"
					>{data.unread === 1
						? t(locale, 'vec.inicio.sen_ler.un')
						: t(locale, 'vec.inicio.sen_ler.varios', { n: data.unread })}</a
				>
			</p>
		{/if}

		<!-- 4. Avisos do concello: un resumo que abre a pestana Avisos -->
		{#if data.notices.length > 0}
			<section class="avisos-seccion">
				<div class="hs">
					<h2>{t(locale, 'vec.inicio.avisos')}</h2>
					<a href="{base}/avisos">{t(locale, 'vec.inicio.avisos.todos', { n: data.noticeCount })}</a
					>
				</div>
				<div class="bando">
					<div class="bh">
						<Escudo municipality={data.municipality} width={16} />
						{t(locale, 'vec.avisos.bando')}
					</div>
					<ul>
						{#each data.notices as n (n.id)}
							<li>
								{#if n.from}<em>{n.from}</em>{/if}<b>{n.title}</b>{n.body}
							</li>
						{/each}
					</ul>
				</div>
			</section>
		{/if}

		<!-- Todos os deportes, cada un coa súa seguinte hora libre -->
		<section class="deportes-seccion">
			<h2 class="hs">{t(locale, 'vec.inicio.deportes')}</h2>
			{#if data.sports.length > 0}
				<ul class="deportes" data-tour="deportes">
					{#each data.sports as s (s.sport.typeId)}
						<li class:off={!s.next}>
							<a href="{base}/reservar/{s.sport.typeId}">
								<Mascot kind={s.sport.mascot} color={s.sport.color} size={48} animated={!!s.next} />
								<span>{sportName(s.sport)}</span>
								<small class:libre={!!s.next}>{sportStatus(s)}</small>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="baleiro">
					<Mascot kind="sala" mood="triste" size={72} />
					<Bubble>{t(locale, 'vec.inicio.baleiro')}</Bubble>
				</div>
			{/if}
			{#if data.sports.length > 0}
				<p class="facil-ligazon">
					{t(locale, 'vec.inicio.facil')}
					<a href="{base}/reservar/facil">{t(locale, 'vec.inicio.facil.ligazon')}</a>
				</p>
			{/if}
		</section>

		{#if !data.signedIn}
			<div class="cta">
				<Mascot kind="padel" size={54} animated={false} />
				<div>
					<p>{t(locale, 'vec.inicio.cta')}</p>
					<Button href="{base}/entrar?redirectTo={encodeURIComponent(base)}"
						>{t(locale, 'vec.inicio.entrar')}</Button
					>
				</div>
			</div>
		{/if}

		<section class="abonos" data-tour="inicio-abonos">
			<h2 class="hs">{t(locale, 'vec.inicio.abonos')}</h2>
			{#if data.signedIn && data.passes.length > 0}
				<ul>
					{#each data.passes as pass (pass.id)}
						<li>
							<b>{pass.name}</b> · {locale === 'es' ? pass.sportEs : pass.sportGl} · {t(
								locale,
								'vec.inicio.abonos.ata',
								{
									data: longDate(locale, pass.endsOn)
								}
							)} ·
							<a href="{base}/reservas?abono={pass.id}">{t(locale, 'vec.inicio.abonos.ver_qr')}</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.passTypes.length > 0}
				<ul>
					{#each data.passTypes as pass (pass.id)}
						<li>
							<b>{pass.name}</b> · {locale === 'es' ? pass.nameEs : pass.nameGl} · {formatEuros(
								pass.priceCents,
								locale
							)}
							<small class="mostrador">{t(locale, 'vec.inicio.abonos.mostrador')}</small>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
		{#if data.tournaments.length > 0}
			<section class="torneos" aria-labelledby="torneos-titulo">
				<div class="hs">
					<h2 id="torneos-titulo">{t(locale, 'vec.torneo.proximos')}</h2>
					<a href={`${base}/torneos`}>{t(locale, 'vec.torneo.ver_todos')}</a>
				</div>
				<ul>
					{#each data.tournaments as tournament (tournament.id)}
						<li>
							<a href={`${base}/torneos/${tournament.id}`}>
								<b>{tournament.title}</b>
								<span
									>{tournament.facilityName} · {t(locale, 'vec.torneo.datas', {
										desde: longDate(locale, tournament.startsOn),
										ata: longDate(locale, tournament.endsOn)
									})}</span
								>
								{#if tournament.joined}<span class="inscrito"
										>{t(locale, 'vec.torneo.inscrito')}</span
									>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</main>

<style>
	.monedero-chip {
		display: inline-flex;
		min-height: var(--toque);
		align-items: center;
		margin-bottom: 10px;
		padding: 0 12px;
		border-radius: 99px;
		background: var(--foco);
		color: var(--txt);
		font-weight: 800;
	}
	.inicio {
		display: flex;
		flex-direction: column;
		padding: 12px 16px 24px;
	}
	.club-chip,
	.inscrito {
		display: inline-flex;
		width: fit-content;
		margin-top: 6px;
		padding: 4px 8px;
		border-radius: 99px;
		background: var(--ceo);
		font-size: 13px;
		font-weight: 800;
	}
	.inscrito {
		background: var(--foco);
	}
	.facil-home {
		display: grid;
		gap: 16px;
		margin-top: 24px;
	}

	.facil-home a {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 88px;
		padding: 16px;
		border-radius: var(--radio);
		background: var(--ceo);
		color: inherit;
		font-size: 27px;
		font-weight: 900;
		text-align: center;
		text-decoration: none;
	}

	.deportes-seccion {
		order: 1;
	}
	.proxima {
		order: 2;
	}
	.senler,
	.avisos-seccion {
		order: 3;
	}
	.abonos {
		order: 4;
	}
	.torneos {
		order: 5;
	}
	.cta {
		order: 6;
	}

	.k {
		margin: 4px 0 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	h1 {
		margin: 4px 0 8px;
		font-size: 30px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	/* A próxima reserva */
	.proxima {
		margin-top: 4px;
	}

	.proxima h2.k {
		margin-top: 2px;
	}

	.titular {
		margin: 2px 0 12px;
		font-size: 28px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.chave {
		display: block;
		border-radius: 18px 18px 40px 40px;
		color: inherit;
		text-decoration: none;
	}

	.mini {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 12px 0 0;
		font-size: 14px;
		font-weight: 700;
	}

	/* Cabeceiras de capa */
	.hs {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin: 26px 0 10px;
		font-size: 19px;
		font-weight: 900;
		letter-spacing: -0.01em;
	}

	.hs h2 {
		margin: 0;
		font-size: inherit;
	}

	.hs a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-size: 14px;
		font-weight: 800;
		color: var(--txt);
		text-underline-offset: 3px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Bando do concello */
	.bando {
		overflow: hidden;
		border: 2px solid var(--txt);
		border-radius: 14px;
	}

	.bh {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--txt);
		color: var(--branco);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.bando li {
		padding: 11px 12px;
		border-top: 2px solid var(--ceo);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
	}

	.bando li:first-child {
		border-top: 0;
	}

	.bando li b {
		display: block;
		font-weight: 900;
	}

	.bando li em {
		font-size: 12px;
		font-style: normal;
		font-weight: 900;
		color: var(--texto-suave);
	}

	/* Avisos persoais sen ler: unha liña que leva a Avisos */
	.senler {
		margin: 8px 0 0;
	}

	.senler a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: var(--txt);
	}

	/* Acceso á reserva fácil, sempre visible baixo os deportes */
	.facil-ligazon {
		margin-top: 12px;
		font-size: 15px;
	}

	.facil-ligazon a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: inherit;
	}

	/* Todos os deportes */
	.deportes {
		display: grid;
		/* Tres columnas en un móvil normal; con el texto ampliado baja a menos columnas y no
		   parte palabras. */
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 96px), 1fr));
		gap: 8px;
	}

	.deportes a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
		min-height: var(--toque);
		padding: 10px 4px 9px;
		border-radius: 16px;
		background: var(--ceo);
		color: var(--txt);
		font-size: 14px;
		font-weight: 800;
		line-height: 1.15;
		text-align: center;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.deportes a:hover {
		background: var(--liña);
	}

	.deportes small {
		font-size: 12px;
		font-weight: 700;
		color: var(--texto-suave);
	}

	/* Libre: un punto verde; o texto queda escuro para cumprir 4.5:1 sobre --ceo */
	.deportes small.libre::before {
		content: '';
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-right: 4px;
		border-radius: 50%;
		background: var(--herba);
		vertical-align: 1px;
	}

	/* Pechado ou sen horas: o debuxo apágase, o texto non (contraste) */
	.off :global(.mascot) {
		opacity: 0.5;
		filter: grayscale(1);
	}

	/* Que no se balanceen todos a la vez */
	.deportes li:nth-child(3n + 2) :global(.mascot) {
		animation-delay: -0.9s;
	}

	.deportes li:nth-child(3n) :global(.mascot) {
		animation-delay: -1.7s;
	}

	.baleiro {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 12px;
	}

	.cta {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 24px;
		padding: 16px;
		border-radius: 18px;
		background: var(--ceo);
	}

	.cta p {
		margin: 0 0 8px;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.3;
	}

	.torneos {
		margin-top: 20px;
	}

	.torneos h2 {
		font-size: 19px;
		font-weight: 900;
	}

	.torneos li {
		border-bottom: 1px solid var(--liña);
	}

	.torneos a {
		display: flex;
		flex-direction: column;
		min-height: 44px;
		padding: 10px 0;
		color: var(--txt);
		text-decoration: none;
	}

	.torneos span {
		color: var(--texto-suave);
	}
	.abonos .mostrador {
		display: block;
		color: var(--texto-suave);
	}
	.conta-eliminada {
		padding: 12px 16px;
		border: 2px solid currentColor;
		border-radius: 12px;
		font-weight: 700;
	}
</style>
