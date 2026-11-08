<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import QrScanner from '#lib/ui/QrScanner.svelte';
	import { facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import { formatEuros, formatTime } from '#lib/ui/format.js';
	import { dayLabel } from '../dates';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	// Con ?qr=<token> la carga trae la búsqueda hecha; una acción posterior la sustituye.
	const lookup = $derived(form ? null : (data.lookup ?? null));
	const matches = $derived(
		form && 'matches' in form && form.matches ? form.matches : (lookup?.matches ?? [])
	);
	const error = $derived(form && 'error' in form ? form.error : (lookup?.error ?? null));
	const errorDate = $derived(
		form && 'date' in form && form.date ? form.date : (lookup?.date ?? null)
	);
	const chegadaError = $derived(form && 'chegadaError' in form ? form.chegadaError : null);
	const attended = $derived(form && 'attended' in form ? form.attended : false);
	const pass = $derived(
		form && 'pass' in form ? form.pass : ((lookup as any)?.pass ?? (data as any).pass ?? null)
	);

	// Lo enviado tal cual (PIN o token QR): la tarjeta lo reenvía para repetir la búsqueda.
	const raw = $derived(form && 'codigo' in form ? String(form.codigo) : (lookup?.codigo ?? ''));
	// Una URL o un token QR no caben en las casillas: solo se devuelven los PIN (el campo queda
	// vacío para el siguiente escaneo).
	const isLink = (v: string) => /[/.]/.test(v);
	let code = $derived(isLink(raw) ? '' : raw.replace(/\D/g, ''));
	// Lo que teclea un lector de QR (la URL entera) se deja tal cual y se ve en un campo normal.
	const long = $derived(isLink(code));
	let focused = $state(false);
	// Sin JavaScript queda solo el campo de texto; con él, las cuatro casillas.
	let js = $state(false);
	onMount(() => (js = true));
	const cells = $derived([0, 1, 2, 3].map((i) => code[i] ?? ''));

	// O lector da cámara mete o texto do QR (a URL enteira) no mesmo campo e envía: mesma busca.
	let entrada = $state<HTMLFormElement>();
	async function scanned(value: string) {
		code = value.trim();
		await tick();
		entrada?.requestSubmit();
	}

	function clean(e: Event & { currentTarget: HTMLInputElement }) {
		const value = e.currentTarget.value;
		code = isLink(value) ? value : value.replace(/\D/g, '').slice(0, 4);
		e.currentTarget.value = code;
	}
</script>

<svelte:head>
	<title
		>{t(locale, 'cons.val.titulo')}{data.municipality ? ` · ${data.municipality.name}` : ''}</title
	>
</svelte:head>

<header class="mh">
	<p class="k">{t(locale, 'cons.val.sub')}</p>
	<h1>{t(locale, 'cons.val.titulo')}</h1>
</header>

<div class="cols">
	<form method="POST" action="?/buscar" class="entrada" data-tour="validar" bind:this={entrada}>
		<label for="codigo" class="k">{t(locale, 'cons.val.etiqueta')}</label>
		<div class="pin" class:js={js && !long} class:long class:focused>
			{#if js && !long}
				<div class="cells" aria-hidden="true">
					{#each cells as c, i (i)}
						<span class:cur={focused && i === Math.min(code.length, 3)}>{c}</span>
					{/each}
				</div>
			{/if}
			<input
				id="codigo"
				name="codigo"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				aria-label={t(locale, 'cons.val.lenda')}
				value={code}
				oninput={clean}
				onfocus={() => (focused = true)}
				onblur={() => (focused = false)}
				required
			/>
		</div>
		<Button type="submit">{t(locale, 'cons.val.buscar')}</Button>
		<QrScanner {locale} onDetect={scanned} />
	</form>

	<div class="resultado" aria-live="polite">
		{#if attended}
			<p class="okmsg" role="status">{t(locale, 'cons.val.feito')}</p>
		{/if}
		{#if chegadaError}
			<p class="err" role="alert">{t(locale, `cons.err.${chegadaError}` as MessageKey)}</p>
		{/if}
		{#if error}
			<p class="err" role="alert">
				{t(locale, `cons.val.${error}` as MessageKey, {
					dia: errorDate ? dayLabel(locale, errorDate) : ''
				})}
			</p>
		{/if}
		{#if matches.length > 0}
			<form method="POST" action="?/chegada" class="card ok">
				<input type="hidden" name="codigo" value={raw} />
				<p class="v">{t(locale, 'cons.val.valido')}</p>
				{#if matches.length > 1}<p class="k">{t(locale, 'cons.val.escolle')}</p>{/if}
				{#each matches as m, i (m.bookingId)}
					<label class="match">
						{#if matches.length > 1}
							<input type="radio" name="bookingId" value={m.bookingId} checked={i === 0} />
						{:else}
							<input type="hidden" name="bookingId" value={m.bookingId} />
						{/if}
						<span>
							<b class="h">
								{facilityLabel(locale, m.facilityName, m.unitIndex, nounFor('unit', m.mascot))} · {formatTime(
									new Date(m.startsAt)
								)}–{formatTime(new Date(m.endsAt))}
							</b>
							<span class="k">
								{t(locale, 'cons.val.liña', { nome: m.displayName })} · {formatEuros(
									m.priceCents,
									locale
								)}
							</span>
							{#if m.opensAt}
								<span class="cedo">
									{t(locale, 'cons.val.cedo', { hora: formatTime(new Date(m.opensAt)) })}
								</span>
							{/if}
						</span>
					</label>
				{/each}
				<Button type="submit">{t(locale, 'cons.val.chegada')}</Button>
			</form>
		{/if}
		{#if pass}
			<div class="card ok">
				<p class="v">{t(locale, 'cons.val.abono')}</p>
				<b>{pass.name}</b><span class="k"
					>{t(locale, 'cons.val.abono_liña', { nome: pass.displayName, ata: pass.endsOn })}</span
				>
			</div>
		{/if}
	</div>
</div>

<style>
	.cedo {
		display: block;
		margin-top: 4px;
		font-weight: 700;
	}

	.mh {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}
	.k {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	.cols {
		display: flex;
		gap: 24px;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.entrada {
		width: 300px;
		max-width: 100%;
		display: grid;
		gap: 10px;
	}
	.pin {
		position: relative;
	}
	.cells {
		display: flex;
		gap: 6px;
	}
	.cells span {
		flex: 1;
		display: grid;
		place-items: center;
		height: 60px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		font-size: 30px;
		font-weight: 900;
	}
	.cells span.cur {
		border-color: var(--pista);
		box-shadow: 0 0 0 2px var(--pista);
	}
	input[type='text'] {
		width: 100%;
		min-height: 60px;
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
		font-size: 30px;
		font-weight: 900;
		letter-spacing: 0.3em;
		text-align: center;
	}
	/* La URL de un QR: texto pequeño, sin espaciado, legible entera. */
	.long input[type='text'] {
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0;
		text-align: left;
	}
	/* Con JavaScript el campo real queda encima, transparente: las casillas lo dibujan. */
	.js input[type='text'] {
		position: absolute;
		inset: 0;
		height: 100%;
		border: 0;
		opacity: 0;
	}
	.pin.js.focused {
		outline: 3px solid var(--txt);
		outline-offset: 3px;
		border-radius: 12px;
	}
	.resultado {
		flex: 1;
		min-width: 260px;
		display: grid;
		gap: 12px;
	}
	.card {
		display: grid;
		gap: 10px;
		padding: 16px;
		border: 2px solid var(--herba);
		border-radius: var(--radio);
		background: #eaf6ee;
	}
	.v {
		margin: 0;
		font-size: 14px;
		font-weight: 800;
		color: #1f7a3b;
	}
	.match {
		display: flex;
		gap: 10px;
		align-items: center;
		min-height: var(--toque);
	}
	.match > span {
		display: grid;
	}
	.h {
		font-size: 18px;
		font-weight: 900;
	}
	.match input[type='radio'] {
		width: 22px;
		height: 22px;
	}
	.err {
		margin: 0;
		padding: 10px 12px;
		border: 2px solid var(--perigo);
		border-radius: 8px;
		color: var(--perigo);
		font-weight: 800;
	}
	.okmsg {
		margin: 0;
		font-weight: 800;
		color: #1f7a3b;
	}
	input:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
