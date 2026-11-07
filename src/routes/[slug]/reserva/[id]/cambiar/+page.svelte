<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { dayLabel, facilityLabel, localDateOfInstant, nounFor } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import DayStrip from '#lib/ui/DayStrip.svelte';
	import HourGrid from '#lib/ui/HourGrid.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatTime, textOn } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const KNOWN = ['SEN_HORA', 'MESMA', 'OCUPADO', 'ALREADY_FINAL', 'TOO_LATE_TO_CANCEL'];

	const locale = $derived(data.locale);
	const f = $derived(data.facility);
	const sport = $derived(locale === 'es' ? f.nameEs : f.nameGl);
	const noun = $derived(nounFor(f.bookingMode, f.mascot));
	const context = $derived(
		t(locale, 'vec.cambiar.contexto', {
			deporte: sport,
			instalacion: facilityLabel(locale, f.name, data.unitIndex, noun),
			cando: t(locale, 'vec.ao', {
				dia: dayLabel(locale, localDateOfInstant(data.startsAt), data.today),
				hora: formatTime(data.startsAt)
			}).toLocaleLowerCase(locale)
		})
	);
	const errorText = $derived(
		form?.error
			? t(
					locale,
					`vec.cambiar.erro.${KNOWN.includes(form.error) ? form.error : 'OTRO'}` as MessageKey
				)
			: null
	);

	// Valores iniciales para el HTML del servidor (también sin JavaScript).
	// svelte-ignore state_referenced_locally
	let selectedDate = $state(data.date);
	let selectedTime = $state<string | null>(null);
	let sending = $state(false);

	// Al cambiar de día (nueva carga), se parte sin hora elegida.
	$effect.pre(() => {
		selectedDate = data.date;
		selectedTime = null;
	});

	/** Con JavaScript, elegir otro día recarga sus horas sin salir de la página. */
	function onchange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.name !== 'date' || input.value === data.date) return;
		goto(`${page.url.pathname}?date=${input.value}`, { reset: false, replace: true });
	}
</script>

<svelte:head>
	<title>{t(locale, 'vec.cambiar.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="cambiar" style:--deporte={f.color} style:--deporte-txt={textOn(f.color)}>
	<div class="pregunta">
		<Mascot kind={f.mascot} color={f.color} size={64} />
		<!-- El bocadillo es un <p>: el título va aparte, solo para lectores de pantalla -->
		<h1 class="sr">{t(locale, 'vec.cambiar.titulo')}</h1>
		<div class="fala" aria-hidden="true"><Bubble>{t(locale, 'vec.cambiar.fala')}</Bubble></div>
	</div>
	<p class="contexto">{context}</p>
	{#if errorText}<p class="erro" role="alert">{errorText}</p>{/if}

	<form
		method="POST"
		{onchange}
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update({ reset: false });
				sending = false;
			};
		}}
	>
		<p class="k" aria-hidden="true">{t(locale, 'dia.lenda')}</p>
		<DayStrip days={data.days} bind:selected={selectedDate} {locale} name="date" />
		<noscript>
			<button class="ver-horas" type="submit" formmethod="get" formaction={page.url.pathname}
				>{t(locale, 'vec.dia.ver_horas')}</button
			>
		</noscript>

		{#if f.bookingMode === 'day'}
			<p class="enteiro">{t(locale, 'vec.dia.enteiro')}</p>
		{:else}
			<p class="k" aria-hidden="true">{t(locale, 'hora.lenda')}</p>
			<HourGrid hours={data.hours} bind:selected={selectedTime} name="time" {locale} />
		{/if}

		<div class="enviar">
			<Button type="submit" disabled={sending} aria-busy={sending}>
				{t(locale, sending ? 'vec.cambiar.enviando' : 'vec.cambiar.confirmar')}
			</Button>
		</div>
	</form>
</main>

<style>
	.cambiar {
		padding: 12px 16px 0;
	}

	.pregunta {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-bottom: 10px;
	}

	.fala :global(.bub) {
		font-size: 17px;
	}

	.contexto {
		margin-bottom: 4px;
		font-size: 15px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.erro {
		margin: 8px 0;
		font-weight: 800;
		color: var(--perigo);
	}

	.k {
		margin: 10px 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.enteiro {
		margin: 12px 0;
		font-weight: 600;
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

	/* El botón queda a mano encima de la barra inferior */
	.enviar {
		position: sticky;
		bottom: var(--nav-alto, calc(72px + env(safe-area-inset-bottom)));
		margin-top: 16px;
		padding: 10px 0 12px;
		background: linear-gradient(to bottom, transparent, var(--branco) 30%);
	}
</style>
