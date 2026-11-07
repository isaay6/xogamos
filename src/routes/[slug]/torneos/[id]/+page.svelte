<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatEuros, longDate } from '#lib/ui/format.js';
	import { localDateOfInstant } from '#lib/ui/booking-text.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
	const tournament = $derived(data.row.tournament);
	const left = $derived(tournament.maxEntries - Number(data.row.entries));
	const dates = $derived(
		tournament.startsOn === tournament.endsOn
			? longDate(locale, tournament.startsOn)
			: t(locale, 'vec.torneo.datas', {
					desde: longDate(locale, tournament.startsOn),
					ata: longDate(locale, tournament.endsOn)
				})
	);
	const loginHref = $derived(
		`/${data.municipality.slug}/entrar?redirectTo=${encodeURIComponent(page.url.pathname)}`
	);
	const canSignUp = $derived(
		tournament.status === 'publicado' && !data.closed && left > 0 && !data.myEntryId
	);
</script>

<svelte:head>
	<title>{tournament.title} · {data.municipality.name}</title>
</svelte:head>

<main class="torneo" style="--deporte: {data.row.color}">
	<a class="volver" href={`/${data.municipality.slug}/torneos`}>{t(locale, 'vec.torneo.titulo')}</a>

	<header>
		<Mascot kind={data.row.mascot} color={data.row.color} size={72} animated />
		<div>
			<h1>{tournament.title}</h1>
			<p>{data.row.facilityName}</p>
		</div>
	</header>

	<ul class="datos">
		<li>{dates}</li>
		<li>{t(locale, `vec.torneo.formato.${tournament.format}` as MessageKey)}</li>
		<li>
			{tournament.feeCents > 0
				? t(locale, 'vec.torneo.prezo', { prezo: formatEuros(tournament.feeCents, locale) })
				: t(locale, 'vec.torneo.de_balde')}
		</li>
		<li class:esgotado={left <= 0}>
			{left > 0 ? t(locale, 'vec.torneo.prazas', { n: left }) : t(locale, 'vec.torneo.cheo')}
		</li>
		<li>
			{t(locale, 'vec.torneo.limite_data', {
				data: longDate(locale, localDateOfInstant(tournament.signupDeadline))
			})}
		</li>
	</ul>

	{#if tournament.description}
		<section>
			<h2>{t(locale, 'vec.torneo.descricion')}</h2>
			<p>{tournament.description}</p>
		</section>
	{/if}
	{#if tournament.rules}
		<section>
			<h2>{t(locale, 'vec.torneo.normas')}</h2>
			<p>{tournament.rules}</p>
		</section>
	{/if}

	{#if form && 'signedUp' in form}
		<p class="ok" role="status">{t(locale, 'vec.torneo.inscrito_ok')}</p>
	{:else if form && 'cancelled' in form}
		<p class="ok" role="status">{t(locale, 'vec.torneo.cancelado_ok')}</p>
	{:else if form && 'error' in form}
		<p class="erro" role="alert">{t(locale, 'vec.torneo.erro')}</p>
	{/if}

	<section class="inscricion">
		{#if data.myEntryId}
			<p class="inscrito">{t(locale, 'vec.torneo.inscrito')}</p>
			{#if !data.closed}
				<form method="POST" action="?/cancelar" use:enhance>
					<input type="hidden" name="entryId" value={data.myEntryId} />
					<Button type="submit" variant="out">{t(locale, 'vec.torneo.cancelar')}</Button>
				</form>
			{/if}
		{:else if tournament.status !== 'publicado' || data.closed}
			<p>{t(locale, 'vec.torneo.pechado')}</p>
		{:else if left <= 0}
			<p>{t(locale, 'vec.torneo.cheo')}</p>
		{:else if !data.signedIn}
			<p>{t(locale, 'vec.torneo.entra')}</p>
			<Button href={loginHref}>{t(locale, 'vec.torneo.entrar')}</Button>
		{:else if canSignUp}
			<form method="POST" action="?/inscribirme" use:enhance>
				{#if tournament.format === 'parellas'}
					<label>
						{t(locale, 'vec.torneo.compañeira')}
						<input name="members" required autocomplete="off" />
					</label>
					<label>
						{t(locale, 'vec.torneo.parella')}
						<input name="teamName" autocomplete="off" />
					</label>
				{:else if tournament.format === 'equipos'}
					<label>
						{t(locale, 'vec.torneo.equipo')}
						<input name="teamName" required autocomplete="off" />
					</label>
					<label>
						{t(locale, 'vec.torneo.membros_equipo')}
						<textarea name="members" rows="3"></textarea>
					</label>
				{/if}
				{#if tournament.feeCents > 0}
					<fieldset>
						<legend
							>{t(locale, 'vec.torneo.prezo', {
								prezo: formatEuros(tournament.feeCents, locale)
							})}</legend
						>
						<label class="radio">
							<input type="radio" name="paidWith" value="monedero" checked />
							{t(locale, 'vec.torneo.pago.monedero')}
						</label>
						<label class="radio">
							<input type="radio" name="paidWith" value="instalacion" />
							{t(locale, 'vec.torneo.pago.instalacion')}
						</label>
					</fieldset>
				{/if}
				<Button type="submit">{t(locale, 'vec.torneo.inscribirme')}</Button>
			</form>
		{/if}
	</section>
</main>

<style>
	.torneo {
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
	header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 8px 0 16px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
		overflow-wrap: anywhere;
	}
	header p {
		margin: 2px 0 0;
		color: var(--texto-suave);
		font-weight: 700;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 18px;
		font-weight: 900;
	}
	.datos {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.datos li {
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--ceo);
		font-weight: 800;
	}
	.datos li.esgotado {
		background: #f5dedb;
		color: #8a2f23;
	}
	section {
		margin-top: 20px;
	}
	section p {
		margin: 0;
	}
	.inscricion {
		padding: 16px;
		border-radius: var(--radio);
		background: var(--ceo);
		border-left: 6px solid var(--deporte, var(--txt));
	}
	.inscrito {
		font-weight: 900;
	}
	form {
		display: grid;
		gap: 12px;
		margin-top: 8px;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 700;
	}
	input:not([type='radio']),
	textarea {
		min-height: var(--toque);
		padding: 8px 10px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
	}
	fieldset {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 4px;
		font-weight: 900;
	}
	.radio {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
	}
	.ok {
		color: #1f7a3b;
		font-weight: 800;
	}
	.erro {
		color: var(--perigo);
		font-weight: 800;
	}
</style>
