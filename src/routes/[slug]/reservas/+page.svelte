<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { dayLabel, durationText, facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import MonthCalendar from '#lib/ui/MonthCalendar.svelte';
	import Qr from '#lib/ui/Qr.svelte';
	import { formatDay, formatTime, longDate } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = NonNullable<typeof data.calendar>['agenda'][number];

	const GROUP: Record<'hoxe' | 'semana' | 'adiante', MessageKey> = {
		hoxe: 'vec.reservas.hoxe',
		semana: 'vec.reservas.semana',
		adiante: 'vec.reservas.adiante'
	};

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const cal = $derived(data.calendar);
	const empty = $derived(data.vista === 'lista' && data.groups.length === 0);

	const sport = (b: Row) => (locale === 'es' ? b.sportEs : b.sportGl);
	const place = (b: Row) =>
		facilityLabel(locale, b.facilityName, b.unitIndex, nounFor(b.bookingMode, b.mascot));
	// Só as filas da lista levan o club; as do calendario non.
	const club = (b: Row & { entityName?: string | null }) => b.entityName ?? null;

	/** «Mañá · Mér 25»: el día relativo y, si no es hoy ni mañana, solo el día. */
	function day(b: Row): string {
		const rel = dayLabel(locale, b.date, data.todayDate);
		const f = formatDay(locale, b.date);
		const plain = t(locale, 'vec.dia.semana', { semana: f.weekday, dia: f.day });
		return rel === plain ? rel : `${rel} · ${plain}`;
	}

	/** Cabecera de la agenda: «Mañá · Mér 25 de novembro» o «Ven 27 de novembro». */
	function agendaTitle(date: string): string {
		const rel = dayLabel(locale, date, data.todayDate);
		const long = `${formatDay(locale, date).weekday} ${longDate(locale, date)}`;
		return /\d/.test(rel) ? long : `${rel} · ${long}`;
	}

	const calHref = (mes: string, dia?: string) =>
		`${base}/reservas?vista=calendario&mes=${mes}${dia ? `&dia=${dia}` : ''}`;
</script>

<svelte:head>
	<title>{t(locale, 'vec.reservas.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="reservas">
	<h1>{t(locale, 'vec.reservas.titulo')}</h1>

	{#if data.needsLogin}
		<div class="fala">
			<Mascot kind="sala" color="#9AA1A0" size={72} />
			<Bubble>{t(locale, 'vec.reservas.entra')}</Bubble>
		</div>
		<div class="botons">
			<Button href="{base}/entrar?redirectTo={encodeURIComponent(`${base}/reservas`)}"
				>{t(locale, 'vec.reservas.entrar')}</Button
			>
		</div>
	{:else}
		<nav class="seg" aria-label={t(locale, 'vec.reservas.vista')}>
			<a href="{base}/reservas" aria-current={data.vista === 'lista' ? 'page' : undefined}
				>{t(locale, 'vec.reservas.lista')}</a
			>
			<a
				href="{base}/reservas?vista=calendario"
				aria-current={data.vista === 'calendario' ? 'page' : undefined}
				>{t(locale, 'vec.reservas.calendario')}</a
			>
		</nav>
		{#if data.vista === 'lista' && data.passes.length > 0}
			<section class="abonos" aria-labelledby="abonos-titulo">
				<h2 id="abonos-titulo">{t(locale, 'vec.abonos.titulo')}</h2>
				{#each data.passes as pass (pass.id)}
					<!-- Tócase e ábrese o chaveiro grande co QR, coma nunha reserva -->
					<details class="abono" open={page.url.searchParams.get('abono') === pass.id}>
						<summary>
							<Fob
								code={pass.pin}
								color="#1AA6C8"
								mascot={pass.mascot}
								size="sm"
								{locale}
								qr={pass.qr}
							/>
							<div class="abono-texto">
								<b>{pass.name}</b>
								<span>{locale === 'es' ? pass.sportEs : pass.sportGl}</span>
								<span
									>{t(locale, 'vec.abonos.valido', {
										desde: longDate(locale, pass.startsOn),
										ata: longDate(locale, pass.endsOn)
									})}</span
								>
								{#if pass.qr}<span class="ampliar">{t(locale, 'vec.abonos.ampliar')}</span>{/if}
							</div>
							{#if pass.qr}<Qr value={pass.qr} size={82} framed={false} decorative />{/if}
						</summary>
						<div class="abono-grande">
							<Fob
								code={pass.pin}
								color="#1AA6C8"
								mascot={pass.mascot}
								size="xl"
								qr={pass.qr}
								qrLabel={t(locale, 'vec.reserva.qr')}
								{locale}
							/>
						</div>
					</details>
				{/each}
			</section>
		{/if}
		{#if data.vista === 'lista' && data.tournamentEntries.length > 0}
			<section class="torneos" aria-labelledby="inscricions-titulo">
				<h2 id="inscricions-titulo">{t(locale, 'vec.torneo.as_minas')}</h2>
				<ul>
					{#each data.tournamentEntries as entry (entry.id)}
						<li>
							<a href={`${base}/torneos/${entry.tournamentId}`}>
								<b>{entry.title}</b>
								<span
									>{entry.facilityName} · {t(locale, 'vec.torneo.datas', {
										desde: longDate(locale, entry.startsOn),
										ata: longDate(locale, entry.endsOn)
									})}</span
								>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if data.vista === 'lista' && data.waitlist.length > 0}
			<section class="espera" aria-labelledby="espera-titulo">
				<h2 id="espera-titulo">{t(locale, 'vec.espera.titulo')}</h2>
				<ul>
					{#each data.waitlist as entry (entry.id)}
						<li>
							<div>
								<b>{entry.facilityName}</b>
								<span>{agendaTitle(entry.date)} · {formatTime(entry.startsAt)}</span>
								<span>{t(locale, `vec.espera.${entry.status}` as MessageKey)}</span>
								{#if entry.status === 'offered' && entry.offeredUntil}
									<small
										>{t(locale, 'vec.espera.ata', { hora: formatTime(entry.offeredUntil) })}</small
									>
								{/if}
							</div>
							{#if entry.status === 'offered'}
								<a
									class="reservar-agora"
									href={`${base}/confirmar?facility=${entry.facilityId}&startsAt=${entry.startsAt.toISOString()}`}
									>{t(locale, 'vec.espera.reservar')}</a
								>
							{/if}
							{#if entry.status === 'waiting' || entry.status === 'offered'}
								<form method="POST" action="?/leaveWaitlist">
									<input type="hidden" name="id" value={entry.id} />
									<button type="submit">{t(locale, 'vec.espera.saír')}</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if empty}
			<div class="fala">
				<Mascot kind="sala" color="#9AA1A0" size={72} />
				<Bubble>{t(locale, 'vec.reservas.baleiro')}</Bubble>
			</div>
			<div class="botons">
				<Button href={base}>{t(locale, 'vec.reservas.reservar')}</Button>
			</div>
		{:else if cal}
			<MonthCalendar
				{locale}
				month={cal.month}
				today={data.todayDate}
				selected={cal.selected}
				days={cal.days}
				href={(d) => calHref(cal.month, d)}
				prevHref={cal.prev ? calHref(cal.prev) : null}
				nextHref={cal.next ? calHref(cal.next) : null}
			/>

			{#if cal.legend.length > 0}
				<ul class="lenda" aria-label={t(locale, 'vec.cal.lenda')}>
					{#each cal.legend as l (l.gl)}
						<li>
							<i style:background={l.color} aria-hidden="true"></i>{locale === 'es' ? l.es : l.gl}
						</li>
					{/each}
				</ul>
			{/if}

			{#if cal.selected}
				<section class="axenda" aria-labelledby="axenda-dia">
					<div class="axenda-cab">
						<h2 id="axenda-dia">{agendaTitle(cal.selected)}</h2>
						{#if cal.agenda.length > 0}
							<span class="k"
								>{t(locale, cal.agenda.length === 1 ? 'vec.cal.conta.un' : 'vec.cal.conta.varios', {
									n: cal.agenda.length
								})}</span
							>
						{/if}
					</div>
					{#if cal.agenda.length === 0}
						<div class="libre">
							<p>{t(locale, 'vec.cal.libre')}</p>
							<Button variant="out" href={base}>{t(locale, 'vec.cal.reservar')}</Button>
						</div>
					{:else}
						<ul class="ag">
							{#each cal.agenda as b (b.id)}
								<li>
									<a class="ag-fila" href="{base}/reserva/{b.id}">
										<span class="tm">{formatTime(b.startsAt)}</span>
										<span class="bx" style:--c={b.color}>
											<Mascot kind={b.mascot} color={b.color} size={34} animated={false} />
											<span class="tx">
												<b>{sport(b)}</b>
												<small>{place(b)} · {durationText(locale, b.startsAt, b.endsAt)}</small>
											</span>
											<span class="pin"
												><span class="sr">{t(locale, 'chaveiro.codigo')}</span>{b.code}</span
											>
										</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{:else}
			{#each data.groups as g (g.key)}
				<h2 class="grp">{t(locale, GROUP[g.key])}</h2>
				<ul class="lista">
					{#each g.items as b (b.id)}
						<li>
							<a class="kc" href="{base}/reserva/{b.id}" data-tour="chave">
								<Fob code={b.code} color={b.color} mascot={b.mascot} size="sm" {locale} />
								<span class="tx">
									<span class="d">{day(b)}</span>
									<b class="w"
										>{t(locale, 'vec.reservas.cando', {
											deporte: sport(b),
											hora: formatTime(b.startsAt)
										})}</b
									>
									<span class="p">{place(b)} · {durationText(locale, b.startsAt, b.endsAt)}</span>
									{#if club(b)}<span class="club-chip">{club(b)}</span>{/if}
								</span>
								{#if b.qr}
									<span class="q">
										<Qr value={b.qr} size={58} framed={false} decorative />
									</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	{/if}
</main>

<style>
	.reservas {
		padding: 12px 16px 24px;
	}
	/* Abonos: van antes das reservas, cada un coma un billete co seu PIN e QR */
	.abonos {
		margin: 16px 0 20px;
	}

	.abonos h2 {
		margin-bottom: 6px;
		font-size: 19px;
		font-weight: 900;
	}

	.abono {
		border-bottom: 1px solid var(--liña);
	}

	.abono summary {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		padding: 12px 0;
		list-style: none;
		cursor: pointer;
	}

	.abono summary::-webkit-details-marker {
		display: none;
	}

	.abono summary:focus-visible {
		outline: 3px solid var(--foco);
		outline-offset: 2px;
	}

	.abono .ampliar {
		color: var(--txt);
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.abono[open] .ampliar {
		display: none;
	}

	.abono-grande {
		display: flex;
		justify-content: center;
		padding: 8px 0 20px;
	}

	.abono-texto {
		display: flex;
		flex: 1 1 160px;
		flex-direction: column;
		gap: 2px;
	}

	.abono-texto span {
		color: var(--texto-suave);
		font-size: 14px;
	}

	.torneos {
		margin: 16px 0 20px;
	}

	.torneos h2 {
		margin-bottom: 6px;
		font-size: 19px;
		font-weight: 900;
	}

	.torneos ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.torneos li {
		border-bottom: 1px solid var(--liña);
	}
	.club-chip {
		display: inline-flex;
		width: fit-content;
		margin-top: 4px;
		padding: 3px 8px;
		border-radius: 99px;
		background: var(--ceo);
		font-size: 13px;
		font-weight: 800;
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
		font-size: 14px;
	}

	.espera {
		margin: 16px 0 20px;
	}
	.espera h2 {
		font-size: 19px;
		font-weight: 900;
	}
	.espera ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.espera li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--liña);
	}
	.espera li > div {
		display: flex;
		flex: 1 1 190px;
		flex-direction: column;
	}
	.espera span,
	.espera small {
		color: var(--texto-suave);
		font-size: 14px;
	}
	.espera button,
	.reservar-agora {
		min-height: var(--toque);
		padding: 0 10px;
		border: 2px solid var(--txt);
		border-radius: 9px;
		background: var(--branco);
		color: var(--txt);
		font-weight: 800;
		text-decoration: none;
	}
	.reservar-agora {
		display: inline-flex;
		align-items: center;
		background: var(--amarelo, #f6cf45);
	}

	h1 {
		margin-bottom: 12px;
		font-size: 30px;
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	/* Interruptor Lista | Calendario: dos enlaces, funciona sin JS */
	.seg {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radio);
		background: var(--ceo);
	}

	.seg a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 16px;
		border-radius: 9px;
		font-size: 15px;
		font-weight: 800;
		color: var(--texto-suave);
		text-decoration: none;
	}

	.seg a[aria-current='page'] {
		background: var(--branco);
		color: var(--txt);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
	}

	/* Lista: chaveiros colgados (mockup B1, opción 1) */
	.grp {
		margin: 18px 0 0;
		font-size: 15px;
		font-weight: 900;
	}

	.lista,
	.ag,
	.lenda {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.kc {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 2px solid var(--ceo);
		color: inherit;
		text-decoration: none;
	}

	.tx {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.d {
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--gris);
	}

	.w {
		margin: 1px 0;
		font-size: 18px;
		font-weight: 900;
	}

	.p {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.q {
		flex: none;
		padding: 3px;
		border: 2px solid var(--ceo);
		border-radius: 10px;
	}

	/* Calendario: leyenda de colores y agenda del día (mockup B2, opción 2) */
	.lenda {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		margin-top: 10px;
		font-size: 13px;
		font-weight: 800;
	}

	.lenda li {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.lenda i {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.axenda-cab {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin: 18px 0 10px;
	}

	.axenda-cab h2 {
		font-size: 19px;
		font-weight: 900;
	}

	.k {
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}

	.ag li + li {
		margin-top: 8px;
	}

	.ag-fila {
		display: flex;
		align-items: stretch;
		gap: 10px;
		color: inherit;
		text-decoration: none;
	}

	.tm {
		flex: none;
		width: 48px;
		padding-top: 12px;
		font-size: 15px;
		font-weight: 900;
	}

	.bx {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 10px;
		min-width: 0;
		min-height: var(--toque);
		padding: 10px 12px;
		border-left: 6px solid var(--c);
		border-radius: 14px;
		background: color-mix(in srgb, var(--c) 16%, var(--branco));
	}

	.bx b {
		font-size: 16px;
		font-weight: 900;
	}

	.bx small {
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.pin {
		margin-left: auto;
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 0.06em;
	}

	.libre {
		display: grid;
		gap: 10px;
		max-width: 420px;
		padding: 14px;
		border-radius: 14px;
		background: var(--ceo);
		font-weight: 700;
	}

	.fala {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 40px;
	}

	.botons {
		display: grid;
		max-width: 420px;
		margin-top: 20px;
	}
</style>
