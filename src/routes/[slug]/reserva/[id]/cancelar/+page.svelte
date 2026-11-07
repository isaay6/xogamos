<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { dayLabel, localDateOfInstant } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatTime } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const slug = $derived(data.municipality.slug);
	const f = $derived(data.facility);
	const sport = $derived(locale === 'es' ? f.nameEs : f.nameGl);
	const cando = $derived(
		t(locale, 'vec.ao', {
			dia: dayLabel(locale, localDateOfInstant(data.startsAt), data.today),
			hora: formatTime(data.startsAt)
		})
	);
	const title = $derived(
		t(locale, 'vec.cancelar.titulo', {
			deporte: sport.toLocaleLowerCase(locale),
			cando: cando.toLocaleLowerCase(locale)
		})
	);
	const errorText = $derived(
		form?.error
			? t(
					locale,
					(form.error === 'TOO_LATE_TO_CANCEL'
						? 'vec.cancelar.erro.TOO_LATE_TO_CANCEL'
						: 'vec.cancelar.erro.OTRO') satisfies MessageKey
				)
			: null
	);
	let sending = $state(false);
</script>

<svelte:head>
	<title>{title} · {data.municipality.name}</title>
</svelte:head>

<main class="cancelar">
	<div class="fala">
		<Mascot kind={f.mascot} color={f.color} mood="triste" size={64} />
		<Bubble>{t(locale, 'vec.cancelar.fala')}</Bubble>
	</div>
	<h1>{title}</h1>
	<p class="nota">
		{t(locale, data.inTime ? 'vec.cancelar.a_tempo' : 'vec.cancelar.tarde')}
	</p>
	{#if data.inTime}<p class="nota">{t(locale, 'vec.cancelar.racha')}</p>{/if}
	{#if errorText}<p class="erro" role="alert">{errorText}</p>{/if}

	<form
		method="POST"
		class="botons"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update();
				sending = false;
			};
		}}
	>
		{#if data.inTime}
			<Button type="submit" variant="perigo" disabled={sending} aria-busy={sending}
				>{t(locale, 'vec.cancelar.si')}</Button
			>
			<Button variant="out" href="/{slug}/reserva/{data.id}">{t(locale, 'vec.cancelar.non')}</Button
			>
		{:else}
			<Button variant="out" href="/{slug}/reserva/{data.id}"
				>{t(locale, 'vec.cancelar.volver')}</Button
			>
		{/if}
	</form>
</main>

<style>
	.cancelar {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 40px 16px 24px;
	}

	.fala {
		display: flex;
		align-items: flex-end;
		gap: 10px;
	}

	h1 {
		margin-top: 8px;
		font-size: 26px;
	}

	.nota {
		font-size: 16px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.erro {
		font-weight: 800;
		color: var(--perigo);
	}

	.botons {
		display: grid;
		gap: 10px;
		max-width: 420px;
		margin-top: 12px;
	}
</style>
