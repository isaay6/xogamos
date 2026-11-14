<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { nounFor } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import DayStrip from '#lib/ui/DayStrip.svelte';
	import HourGrid from '#lib/ui/HourGrid.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { textOn } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Texto do resultado de apuntarse á lista de espera. */
	function esperaErro(code: unknown): MessageKey {
		if (code === 'ALREADY_WAITING') return 'vec.espera.erro.xa';
		if (code === 'WAITLIST_LIMIT') return 'vec.espera.erro.limite';
		if (code === 'LOGIN_REQUIRED') return 'vec.espera.erro.entrar';
		if (code === 'SLOT_AVAILABLE') return 'vec.espera.erro.libre';
		return 'vec.espera.erro.xeral';
	}

	const locale = $derived(data.locale);
	const sport = $derived(data.sport);
	const name = $derived(locale === 'es' ? sport.nameEs : sport.nameGl);
	const noun = $derived(nounFor(sport.bookingMode, sport.mascot));
	const libre = $derived(`/${data.municipality.slug}/reservar/${sport.typeId}/libre`);

	// Valores iniciales para el HTML del servidor (también sin JavaScript).
	// svelte-ignore state_referenced_locally
	let selectedDate = $state(data.date);
	// «Calquera hora» es el valor vacío.
	let selectedTime = $state<string | null>('');
	/** Peche do día escollido: «Pechada: Pechada ata o verán» en vez de «completo». */
	const closedDay = $derived(data.days.find((d) => d.date === selectedDate)?.closed ?? null);
	// Día pechado (ou todas as horas pechadas): nada que buscar, así que «Calquera hora» e o botón
	// quedan desactivados. Sae do servidor, tamén sen JavaScript.
	const shut = $derived(
		closedDay !== null || (data.hours.length > 0 && data.hours.every((h) => h.closed))
	);

	// Al cambiar de día (nueva carga), se parte de «calquera hora».
	$effect.pre(() => {
		selectedDate = data.date;
		selectedTime = '';
	});

	/** Con JavaScript, elegir otro día recarga sus horas sin salir de la página. */
	function onchange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.name !== 'date' || input.value === data.date) return;
		goto(`${page.url.pathname}?date=${input.value}`, {
			reset: false,
			replace: true
		});
	}
</script>

<svelte:head>
	<title>{name} · {data.municipality.name}</title>
</svelte:head>

<main class="dia" style:--deporte={sport.color} style:--deporte-txt={textOn(sport.color)}>
	<div class="pregunta">
		<Mascot kind={sport.mascot} color={sport.color} size={64} />
		<!-- El bocadillo es un <p>: el título va aparte, solo para lectores de pantalla -->
		<h1 class="sr">{t(locale, 'vec.dia.pregunta', { deporte: name })}</h1>
		<div class="fala" aria-hidden="true">
			<Bubble>{t(locale, 'vec.dia.pregunta', { deporte: name })}</Bubble>
		</div>
	</div>
	<div aria-live="polite">
		{#if form?.joined}
			<p class="espera-ok">{t(locale, 'vec.espera.unida')}</p>
		{:else if form?.error}
			<p class="espera-erro">{t(locale, esperaErro(form.error))}</p>
		{/if}
	</div>

	<form method="GET" action={libre} {onchange} data-tour="dia-hora">
		<p class="k" aria-hidden="true">{t(locale, 'dia.lenda')}</p>
		<DayStrip days={data.days} bind:selected={selectedDate} {locale} name="date" />
		{#if closedDay}
			<p class="pechada" role="status">
				{closedDay.holiday
					? t(locale, 'dia.festivo', { nome: closedDay.reason })
					: closedDay.reason
						? t(locale, 'dia.pechada.motivo', { motivo: closedDay.reason })
						: t(locale, 'hora.pechada.curto')}
			</p>
		{/if}
		<noscript>
			<button class="ver-horas" type="submit" formaction={page.url.pathname}
				>{t(locale, 'vec.dia.ver_horas')}</button
			>
		</noscript>

		{#if sport.bookingMode === 'day'}
			<p class="enteiro">{t(locale, 'vec.dia.enteiro')}</p>
		{:else}
			{#if data.hours.length === 0 && !closedDay}
				<p class="pechada" role="status">{t(locale, 'dia.non_abre')}</p>
			{/if}
			<p class="k" aria-hidden="true">{t(locale, 'hora.lenda')}</p>
			<HourGrid
				hours={data.hours}
				bind:selected={selectedTime}
				name="time"
				waitlistSlots={data.waitlistSlots}
				waitingTimes={data.waitingTimes}
				{locale}
			/>
			<label class="calquera" class:on={selectedTime === '' && !shut} class:off={shut}>
				<input type="radio" name="time" value="" bind:group={selectedTime} disabled={shut} />
				<span>{t(locale, 'vec.dia.calquera')}</span>
			</label>
		{/if}

		<div class="enviar">
			<Button type="submit" disabled={shut}>{t(locale, `vec.dia.ver.${noun}` as MessageKey)}</Button
			>
			<a class="pedir" href={`/${data.municipality.slug}/solicitudes/nova`}
				>{t(locale, 'vec.sol.pedir')}</a
			>
		</div>
	</form>
	{#if data.suggestions.length > 0}
		<section class="suxestions" aria-labelledby="suxestions-titulo">
			<h2 id="suxestions-titulo">{t(locale, 'vec.espera.proximas')}</h2>
			<ul>
				{#each data.suggestions as suggestion (suggestion.facilityId + suggestion.startsAt.toISOString())}
					<li>
						<a href={`${libre}?date=${suggestion.date}&time=${suggestion.time}`}
							>{suggestion.time}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.dia {
		padding: 12px 16px 0;
	}

	.pregunta {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-bottom: 14px;
	}

	.fala :global(.bub) {
		font-size: 17px;
	}

	.k {
		margin: 10px 0 4px;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: normal;
		color: var(--texto-suave);
	}

	.pechada {
		margin: 4px 0 8px;
		padding: 10px 12px;
		border-radius: var(--radio);
		background: var(--ceo);
		font-weight: 800;
	}

	.enteiro {
		margin: 12px 0;
		font-weight: 600;
	}

	.calquera {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--toque);
		margin-top: 8px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font-weight: 800;
		cursor: pointer;
	}

	.calquera input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.calquera:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.calquera.on {
		background: var(--deporte);
		border-color: var(--deporte);
		color: var(--deporte-txt);
	}

	.calquera.off {
		border-color: var(--liña);
		color: var(--gris);
		cursor: not-allowed;
	}

	.ver-horas {
		min-height: var(--toque);
		margin-top: 4px;
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		font-weight: 800;
	}

	.pedir {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		margin-left: 12px;
		font-weight: 800;
	}

	/* El botón queda a mano encima de la barra inferior */
	.enviar {
		position: sticky;
		bottom: var(--nav-alto, calc(72px + env(safe-area-inset-bottom)));
		margin-top: 16px;
		padding: 10px 0 12px;
		background: linear-gradient(to bottom, transparent, var(--branco) 30%);
	}

	.suxestions {
		margin: 20px 0;
	}
	.suxestions ul {
		padding-left: 20px;
	}
	.suxestions a {
		color: var(--txt);
		font-weight: 800;
	}

	.espera-ok,
	.espera-erro {
		margin: 0 0 12px;
		padding: 10px 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font-weight: 800;
	}

	.espera-ok {
		background: var(--ceo);
	}

	.espera-erro {
		border-color: var(--perigo);
		color: var(--perigo);
	}
</style>
