<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { dayLabel } from '#lib/ui/booking-text.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/reservar/facil`);
	const step = $derived(!data.sport ? 1 : !data.selectedDate ? 2 : 3);
	const href = (p: Record<string, string>) => `${base}?${new URLSearchParams(p)}`;
	const keep = $derived<Record<string, string>>(data.sport ? { tipo: data.sport.typeId } : {});
</script>

<main class="facil">
	<p class="paso">{t(locale, 'vec.facil.paso', { n: step })}</p>
	<div class="progreso" style:--paso={`${step * 25}%`}></div>
	{#if step > 1}
		<a
			class="atras"
			href={step === 2
				? base
				: step === 3
					? href(keep)
					: href({ ...keep, date: data.selectedDate! })}
		>
			{t(locale, 'vec.facil.atras')}
		</a>
	{/if}
	{#if step === 1}
		<h1>{t(locale, 'vec.facil.deporte')}</h1>
		<div class="choices">
			{#each data.sports as sport (sport.typeId)}
				<a href={href({ tipo: sport.typeId })}>
					<Mascot kind={sport.mascot} color={sport.color} size={72} />
					<span>{locale === 'es' ? sport.nameEs : sport.nameGl}</span>
				</a>
			{/each}
		</div>
	{:else if step === 2}
		<h1>{t(locale, 'vec.facil.dia')}</h1>
		<div class="choices">
			{#each data.days as day (day.date)}
				<a class:off={day.full} href={day.full ? undefined : href({ ...keep, date: day.date })}>
					{dayLabel(locale, day.date, data.today)}
				</a>
			{/each}
		</div>
	{:else if step === 3}
		<h1>{t(locale, 'vec.facil.hora')}</h1>
		<div class="choices">
			{#each data.hours.filter((hour) => hour.free && !hour.closed) as hour (hour.time)}
				<a
					href={data.confirm && hour.time === data.time
						? data.confirm
						: href({ ...keep, date: data.selectedDate!, time: hour.time })}
				>
					{hour.time}
				</a>
			{/each}
		</div>
	{/if}
</main>

<style>
	.facil {
		max-width: 560px;
		margin: auto;
		padding: 20px 16px 32px;
	}

	.paso {
		font-size: 20px;
		font-weight: 800;
	}

	.progreso {
		height: 10px;
		margin-bottom: 18px;
		background: var(--ceo);
		border-radius: 99px;
	}

	.progreso::before {
		content: '';
		display: block;
		width: var(--paso);
		height: 100%;
		background: var(--concello);
		border-radius: inherit;
	}

	h1 {
		font-size: 36px;
		line-height: 1.1;
	}

	.atras {
		display: inline-flex;
		min-height: var(--toque);
		align-items: center;
		color: inherit;
		font-weight: 800;
	}

	.choices {
		display: grid;
		gap: 12px;
	}

	.choices a {
		display: flex;
		min-height: 76px;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 14px;
		border: 3px solid var(--txt);
		border-radius: var(--radio);
		color: inherit;
		font-size: 26px;
		font-weight: 900;
		text-decoration: none;
	}

	.choices a.off {
		opacity: 0.45;
		pointer-events: none;
	}
</style>
