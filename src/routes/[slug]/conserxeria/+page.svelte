<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import AgendaGrid from '#lib/ui/AgendaGrid.svelte';
	import AgendaWeek from '#lib/ui/AgendaWeek.svelte';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import { formatCode, formatEuros, formatTime, longDate } from '#lib/ui/format.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { localDate } from '#lib/ui/closure-text.js';
	import { dayLabel } from './dates';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/conserxeria`);
	const semana = $derived(data.vista === 'semana');
	// Filtro de instalaciones: se conserva en cada enlace.
	const inst = $derived(data.selected.map((id) => `&inst=${id}`).join(''));
	const dayHref = (date: string) => `?dia=${date}${inst}`;
	const weekHref = (date: string) => `?dia=${date}&vista=semana${inst}`;
	const query = $derived(`&dia=${data.date}${inst}`);
	const close = $derived(dayHref(data.date));
	const action = (name: string) => `?/${name}&reserva=${data.panel?.id}${query}`;
	const isToday = $derived(data.date === data.today);
	const heading = $derived.by(() => {
		if (!data.week) return dayLabel(locale, data.date);
		const first = data.week.days[0].date;
		const last = data.week.days[data.week.days.length - 1].date;
		const from =
			first.slice(0, 7) === last.slice(0, 7)
				? String(Number(first.slice(8)))
				: longDate(locale, first);
		return `${from} – ${longDate(locale, last)}`;
	});
	const thisWeek = $derived(data.week ? data.week.days.some((d) => d.date === data.today) : false);
	const filterLabel = $derived(
		data.selected.length === 0
			? t(locale, 'cons.axenda.inst.todas', { n: data.facilityOptions.length })
			: t(locale, 'cons.axenda.inst.algunhas', {
					k: data.selected.length,
					n: data.facilityOptions.length
				})
	);
	const summaryText = $derived.by(() => {
		const s = data.summary;
		if (!s) return t(locale, 'cons.semana.toca');
		const parts = [
			s.reservas === 1
				? t(locale, 'cons.axenda.reservas.un')
				: t(locale, 'cons.axenda.reservas.varios', { n: s.reservas })
		];
		if (s.telefono > 0) parts.push(t(locale, 'cons.axenda.resumo.telefono', { n: s.telefono }));
		if (s.nonVeu > 0)
			parts.push(
				s.nonVeu === 1
					? t(locale, 'cons.axenda.resumo.nonveu.un')
					: t(locale, 'cons.axenda.resumo.nonveu.varios', { n: s.nonVeu })
			);
		const text = parts.join(' · ');
		return isToday ? t(locale, 'cons.axenda.resumo.hoxe', { resto: text }) : text;
	});
	const open = $derived(data.panel?.status === 'confirmed');
	const failed = $derived(form && 'error' in form ? form.error : null);
	const confirming = $derived(
		form && 'confirmCancel' in form && form.confirmCancel === data.panel?.id
	);
	const done = $derived(form && 'done' in form ? form.done : null);
</script>

<svelte:head>
	<title>{t(locale, 'cons.axenda.titulo')} · {heading}</title>
</svelte:head>

<div class="split">
	<section class="lf">
		<header class="mh">
			<nav class="navd" aria-label={t(locale, 'cons.axenda.dias')}>
				{#if semana}
					<a class="nb" href={weekHref(data.prev)}>{t(locale, 'cons.axenda.anterior')}</a>
					<a
						class="nb hoxe"
						class:volver={!thisWeek}
						href={weekHref(data.today)}
						aria-current={thisWeek ? 'date' : undefined}>{t(locale, 'cons.axenda.estaSemana')}</a
					>
					<a class="nb" href={weekHref(data.next)}>{t(locale, 'cons.axenda.seguinte')}</a>
				{:else}
					<a class="nb" href={dayHref(data.prev)}>{t(locale, 'cons.axenda.onte')}</a>
					<a
						class="nb hoxe"
						class:volver={!isToday}
						href={dayHref(data.today)}
						aria-current={isToday ? 'date' : undefined}>{t(locale, 'cons.axenda.hoxe')}</a
					>
					<a class="nb" href={dayHref(data.next)}>{t(locale, 'cons.axenda.mana')}</a>
				{/if}
			</nav>
			<div class="titles">
				<p class="k">{t(locale, 'cons.axenda.titulo')}</p>
				<h1>{heading}</h1>
			</div>
			<form method="GET" class="cal">
				<label for="dia">{t(locale, 'cons.axenda.calendario')}</label>
				<input id="dia" type="date" name="dia" value={data.date} required />
				{#if semana}<input type="hidden" name="vista" value="semana" />{/if}
				{#each data.selected as id (id)}<input type="hidden" name="inst" value={id} />{/each}
				<button type="submit">{t(locale, 'cons.axenda.ir')}</button>
			</form>
			{#if data.desk !== false}<a class="tel" href="{base}/nova"
					>{t(locale, 'cons.axenda.telefono')}</a
				>{/if}
		</header>

		<div class="tools">
			<nav class="sg" data-tour="axenda-vista" aria-label={t(locale, 'cons.axenda.vista')}>
				<a href={dayHref(data.date)} aria-current={semana ? undefined : 'page'}
					>{t(locale, 'cons.axenda.vista.dia')}</a
				>
				<a href={weekHref(data.date)} aria-current={semana ? 'page' : undefined}
					>{t(locale, 'cons.axenda.vista.semana')}</a
				>
			</nav>
			<!-- Ao cambiar de filtro, día ou vista o menú volve pechado (con JS o elemento reutilízase). -->
			{#key `${data.date}|${data.vista}|${inst}`}
				<details class="filtro" class:on={data.selected.length > 0}>
					<summary>{filterLabel}</summary>
					<form method="GET" class="pop">
						<input type="hidden" name="dia" value={data.date} />
						{#if semana}<input type="hidden" name="vista" value="semana" />{/if}
						<fieldset>
							<legend>{t(locale, 'cons.axenda.inst.titulo')}</legend>
							{#each data.facilityOptions as f (f.facilityId)}
								<label>
									<input
										type="checkbox"
										name="inst"
										value={f.facilityId}
										checked={data.selected.length === 0 || data.selected.includes(f.facilityId)}
									/>
									<Mascot kind={f.mascot} size={20} animated={false} color={f.color} />
									<span
										>{f.facilityName}{#if f.closure}
											· {localDate(locale, f.closure)}{/if}</span
									>
								</label>
							{/each}
						</fieldset>
						<div class="qk">
							<button type="submit">{t(locale, 'cons.axenda.ver')}</button>
							<a href={semana ? `?dia=${data.date}&vista=semana` : `?dia=${data.date}`}
								>{t(locale, 'cons.axenda.inst.todasBoton')}</a
							>
						</div>
					</form>
				</details>
			{/key}
			<span class="sp"></span>
			<p class="k">{summaryText}</p>
			{#if !semana}
				{#if data.desk !== false}<a class="folla" href="{base}/folla?dia={data.date}"
						>{t(locale, 'cons.axenda.folla')}</a
					>{/if}
			{/if}
		</div>

		{#if data.week}
			<AgendaWeek days={data.week.days} rows={data.week.rows} query={inst} {locale} />
		{:else if data.facilities.length === 0}
			<p>{t(locale, 'cons.axenda.baleira')}</p>
		{:else}
			<AgendaGrid
				facilities={data.facilities}
				startMinute={data.startMinute}
				endMinute={data.endMinute}
				nowMinute={data.nowMinute}
				now={data.now}
				selectedId={data.panel?.id ?? null}
				{query}
				{locale}
			/>
		{/if}
	</section>

	{#if data.panel}
		{@const p = data.panel}
		<aside class="panel" aria-labelledby="panel-h">
			<a class="x" href={close}>{t(locale, 'cons.panel.pechar')}</a>
			<p class="k">
				{p.facilityName} · {formatTime(p.startsAt)}–{formatTime(p.endsAt)}
			</p>
			<h2 id="panel-h">{p.displayName}</h2>
			<a class="ficha" href={`/${data.municipality.slug}/conserxeria/persoa?persoa=${p.profileId}`}
				>{t(locale, 'cons.panel.ficha')}</a
			>
			<p class="k">
				{t(locale, p.isResident ? 'cons.panel.empadroada' : 'cons.panel.nonempadroada')} · {formatEuros(
					p.priceCents,
					locale
				)}
			</p>
			<p class="k">
				{t(locale, 'cons.panel.codigo')} <b class="code">{formatCode(p.accessCode)}</b>
			</p>

			<div class="char">
				<Mascot
					kind={p.mascot}
					size={40}
					color={p.color}
					mood={p.status === 'no_show' || p.status === 'cancelled' ? 'triste' : 'feliz'}
				/>
				<Bubble>{t(locale, `cons.panel.bub.${p.status}` as MessageKey)}</Bubble>
			</div>

			{#if failed}
				<p class="err" role="alert">{t(locale, `cons.err.${failed}` as MessageKey)}</p>
			{:else if done}
				<p class="okmsg" role="status">{t(locale, `cons.feito.${done}` as MessageKey)}</p>
			{/if}

			{#if open}
				<div class="acts">
					{#if data.desk !== false}
						<form method="POST" action={action('chegou')}>
							<Button type="submit">{t(locale, 'cons.panel.chegou')}</Button>
						</form>
						<form method="POST" action={action('nonVeu')}>
							<Button type="submit" variant="out">{t(locale, 'cons.panel.nonveu')}</Button>
						</form>
					{/if}
					{#if !confirming && data.desk !== false}
						<form method="POST" action={action('cancelar')}>
							<Button type="submit" variant="perigo">{t(locale, 'cons.panel.cancelar')}</Button>
						</form>
					{/if}
				</div>
				{#if confirming && data.desk !== false}
					<form method="POST" action={action('cancelar')} class="seguro" role="alert">
						<b>{t(locale, 'cons.panel.seguro')}</b>
						<label class="motivo">
							<span>{t(locale, 'cons.panel.motivo')}</span>
							<textarea name="motivo" required maxlength="200" rows="2"></textarea>
						</label>
						<input type="hidden" name="confirmar" value="1" />
						<Button type="submit" variant="perigo">{t(locale, 'cons.panel.cancelar')}</Button>
						<Button variant="out" href={`?reserva=${p.id}${query}`}
							>{t(locale, 'cons.panel.non')}</Button
						>
					</form>
				{/if}
			{/if}

			<p class="k faltas">
				{t(locale, 'cons.panel.faltas', { n: p.noShowCount, max: p.noShowThreshold })}
			</p>

			{#if p.siblings.length > 0}
				<h3>{t(locale, 'cons.panel.outras')}</h3>
				<ul>
					{#each p.siblings as s (s.id)}
						<li><a href="?reserva={s.id}{query}">{s.displayName} ({s.seats})</a></li>
					{/each}
				</ul>
			{/if}
		</aside>
	{/if}
</div>

<style>
	.ficha {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
		font-weight: 800;
	}
	.split {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}
	.lf {
		flex: 1;
		min-width: 0;
	}
	.mh {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		margin-bottom: 12px;
	}
	.titles {
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 900;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	/* «martes 24 de novembro» → «Martes 24 de novembro» */
	h1::first-letter {
		text-transform: uppercase;
	}
	.k {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	.navd {
		display: flex;
		gap: 6px;
	}
	.nb,
	.sg a,
	.cal button,
	.qk button,
	.qk a,
	.folla {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-size: 14px;
		font-weight: 900;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}
	.nb.hoxe {
		background: var(--txt);
		color: var(--branco);
	}
	/* Fóra de hoxe, «Hoxe» ponse amarelo para lembrar como volver. */
	.nb.hoxe.volver {
		background: var(--foco);
		color: var(--txt);
	}
	.cal {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 800;
	}
	.cal input {
		min-height: var(--toque);
		padding: 0 8px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		font: inherit;
		font-weight: 800;
	}
	.tel {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		margin-left: auto;
		padding: 6px 14px;
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font-weight: 800;
		text-decoration: none;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 0 0 14px;
	}
	.tools .sp {
		flex: 1;
	}
	.tools .k {
		margin: 0;
	}
	.sg {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--ceo);
	}
	.sg a {
		border-color: transparent;
		background: transparent;
		color: var(--texto-suave);
	}
	.sg a[aria-current='page'] {
		background: var(--branco);
		color: var(--txt);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
	}
	.filtro {
		position: relative;
	}
	.filtro summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		font-size: 14px;
		font-weight: 800;
		cursor: pointer;
		list-style: none;
	}
	.filtro summary::-webkit-details-marker {
		display: none;
	}
	.filtro summary::after {
		content: ' ▾';
	}
	.filtro[open] summary::after {
		content: ' ▴';
	}
	.filtro.on summary {
		background: var(--foco);
	}
	.pop {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 10;
		width: 270px;
		padding: 12px;
		border: 2px solid var(--txt);
		border-radius: 16px;
		background: var(--branco);
		box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
	}
	.pop fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.pop legend {
		margin-bottom: 4px;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pop label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		border-bottom: 1px solid var(--ceo);
		font-size: 14px;
		font-weight: 800;
	}
	.pop input[type='checkbox'] {
		width: 20px;
		height: 20px;
		accent-color: var(--txt);
	}
	.qk {
		display: flex;
		gap: 6px;
		margin-top: 10px;
	}
	.qk button {
		background: var(--txt);
		color: var(--branco);
	}
	/* Tarxeta da reserva: queda á vista mentres se percorre a axenda. */
	.panel {
		position: sticky;
		top: 16px;
		flex: none;
		width: 260px;
		padding: 14px 16px;
		border: 2px solid var(--txt);
		border-radius: 14px;
		background: var(--branco);
		box-shadow: 0 14px 30px rgba(0, 0, 0, 0.12);
	}
	h2 {
		margin: 0 0 4px;
		font-size: 20px;
		font-weight: 900;
	}
	h3 {
		margin: 16px 0 4px;
		font-size: 14px;
	}
	.code {
		color: var(--txt);
		font-size: 16px;
	}
	.char {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		margin: 14px 0;
	}
	.seguro {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		padding: 10px;
		border: 2px solid var(--perigo);
		border-radius: 10px;
	}
	.motivo {
		display: grid;
		gap: 4px;
		flex-basis: 100%;
		font-weight: 600;
	}
	.motivo textarea {
		font: inherit;
		padding: 8px;
		border: 2px solid var(--txt);
		border-radius: 8px;
	}
	.acts {
		display: grid;
		gap: 8px;
	}
	.faltas {
		margin-top: 12px;
	}
	.err {
		margin: 0 0 10px;
		padding: 8px 10px;
		border: 2px solid var(--perigo);
		border-radius: 8px;
		color: var(--perigo);
		font-weight: 700;
	}
	.okmsg {
		margin: 0 0 10px;
		font-weight: 800;
		color: #1f7a3b;
	}
	.x {
		display: inline-block;
		margin-bottom: 8px;
		color: var(--txt);
		font-weight: 800;
	}
	a:focus-visible,
	button:focus-visible,
	input:focus-visible,
	summary:focus-visible,
	textarea:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	@media (max-width: 899px) {
		.split {
			flex-direction: column;
			/* Sin esto la columna toma el ancho de la reixa y la página se desborda. */
			align-items: stretch;
		}
		.panel {
			position: static;
			width: auto;
		}
	}
</style>
