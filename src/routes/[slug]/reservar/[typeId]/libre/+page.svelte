<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { countText, dayLabel, nounFor } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import AccessibilitySheet from '#lib/ui/AccessibilitySheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import FreeOptionCard from '#lib/ui/FreeOptionCard.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatTime } from '#lib/ui/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Option = (typeof data.options)[number];
	type Alt = (typeof data.alternatives)[number];

	const locale = $derived(data.locale);
	const slug = $derived(data.municipality.slug);
	const sport = $derived(data.sport);
	const sportName = (s: { nameGl: string; nameEs: string }) =>
		locale === 'es' ? s.nameEs : s.nameGl;
	const noun = $derived(nounFor(sport.bookingMode, sport.mascot));
	const day = $derived(dayLabel(locale, data.date, data.today));

	const context = $derived(
		sport.bookingMode === 'day'
			? t(locale, 'vec.libre.contexto_dia', { deporte: sportName(sport), dia: day })
			: t(locale, 'vec.libre.contexto', {
					deporte: sportName(sport),
					dia: day,
					hora: data.time ?? t(locale, 'vec.libre.calquera')
				})
	);

	// En aforo cuentan las plazas; en el resto, las opciones (pistas, salas o rúas).
	const free = $derived(
		sport.bookingMode === 'capacity'
			? data.options.reduce((n, o) => n + (o.remainingSeats ?? 0), 0)
			: data.options.length
	);

	/** Con «calquera hora», la lista se agrupa por hora. */
	const groups = $derived.by(() => {
		if (data.time !== null || sport.bookingMode === 'day') {
			return [{ time: null as string | null, options: data.options }];
		}
		const byTime = new Map<string, Option[]>();
		for (const o of data.options) {
			const key = formatTime(o.startsAt);
			byTime.set(key, [...(byTime.get(key) ?? []), o]);
		}
		return [...byTime].map(([time, options]) => ({ time: time as string | null, options }));
	});

	const confirmHref = (o: Option) => {
		const q = new URLSearchParams({ facility: o.facilityId, startsAt: o.startsAt.toISOString() });
		if (o.unitIndex !== null) q.set('unit', String(o.unitIndex));
		return `/${slug}/confirmar?${q}`;
	};

	const altHref = (a: Alt) => {
		const q = new URLSearchParams({ date: a.date });
		if (a.time) q.set('time', a.time);
		return `/${slug}/reservar/${a.typeId}/libre?${q}`;
	};

	const altSport = (a: Alt) => data.sports.find((s) => s.typeId === a.typeId) ?? sport;

	const altTitle = (a: Alt) => {
		const d = dayLabel(locale, a.date, data.today);
		const when = a.time ? t(locale, 'vec.ao', { dia: d, hora: a.time }) : d;
		return a.kind === 'similar_sport'
			? t(locale, 'vec.alt.deporte', { deporte: sportName(altSport(a)), cando: when })
			: when;
	};

	const altDetail = (a: Alt) => {
		const s = altSport(a);
		const conta = countText(locale, nounFor(s.bookingMode, s.mascot), a.count);
		const anyHour = a.kind === 'other_day' && a.time === null;
		const key: MessageKey = anyHour ? 'vec.alt.other_day_calquera' : `vec.alt.${a.kind}`;
		return t(locale, key, { conta });
	};

	const vaia = $derived(
		data.time
			? t(locale, 'vec.libre.ocupado', { hora: data.time })
			: t(locale, 'vec.libre.dia_ocupado')
	);

	const back = $derived(`/${slug}/reservar/${sport.typeId}?date=${data.date}`);
	const accessInfo = (o: Option) =>
		locale === 'es' ? o.accessInfoEs || o.accessInfo : o.accessInfo;
	const accessOptions = $derived(
		data.options.filter(
			(option, index, options) =>
				Boolean(accessInfo(option)) &&
				options.findIndex((other) => other.facilityId === option.facilityId) === index
		)
	);
	const isFirstFacility = (option: Option) =>
		data.options.findIndex((other) => other.facilityId === option.facilityId) ===
		data.options.indexOf(option);
</script>

<svelte:head>
	<title>{context} · {data.municipality.name}</title>
</svelte:head>

<main class="libre">
	{#if data.cheo}
		<p class="cheo" role="status">{t(locale, 'vec.libre.cheo')}</p>
	{/if}

	<p class="k">{context}</p>
	{#if accessOptions.length}
		<section class="acceso" aria-labelledby="acceso-t">
			<h2 id="acceso-t">{t(locale, 'vec.acceso.titulo')}</h2>
			{#each accessOptions as option (option.facilityId)}
				<p>{accessInfo(option)}</p>
			{/each}
		</section>
	{/if}

	{#if data.options.length > 0}
		<h1>
			{t(locale, free === 1 ? 'vec.libre.titulo.un' : 'vec.libre.titulo.varios', {
				conta: countText(locale, noun, free)
			})}
		</h1>
		{#each groups as g (g.time)}
			<section aria-labelledby={g.time ? `h-${g.time}` : undefined}>
				{#if g.time}<h2 id="h-{g.time}">{g.time}</h2>{/if}
				<ul class="opcions">
					{#each g.options as o (o.facilityId + o.startsAt.toISOString() + (o.unitIndex ?? ''))}
						<li>
							<FreeOptionCard
								option={o}
								href={confirmHref(o)}
								resident={data.resident}
								{noun}
								{locale}
							/>
							{#if isFirstFacility(o)}<AccessibilitySheet facility={o} {locale} />{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{:else}
		<div class="vaia">
			<Mascot kind={sport.mascot} color={sport.color} mood="triste" size={64} />
			<!-- El bocadillo es un <p>: el título va aparte, solo para lectores de pantalla -->
			<h1 class="sr">{vaia}</h1>
			<div class="fala" aria-hidden="true"><Bubble>{vaia}</Bubble></div>
		</div>
		{#if data.alternatives.length > 0}
			<h2 class="mira">{t(locale, 'vec.libre.mira')}</h2>
			<ul class="alts">
				{#each data.alternatives as a (a.kind)}
					<li>
						<a href={altHref(a)}>
							{altTitle(a)}
							<small>{altDetail(a)}</small>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="buscar">
			<Button variant="out" href={back}>{t(locale, 'vec.libre.buscar')}</Button>
		</div>
	{/if}
</main>

<style>
	.libre {
		padding: 12px 16px 24px;
	}

	.cheo {
		margin-bottom: 12px;
		padding: 10px 12px;
		border-left: 6px solid var(--perigo);
		border-radius: 10px;
		background: var(--ceo);
		font-weight: 800;
	}

	.k {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	h1 {
		margin: 2px 0 12px;
		font-size: 26px;
	}

	h2 {
		margin: 16px 0 8px;
		font-size: 19px;
	}

	.opcions,
	.alts {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.acceso {
		margin: 12px 0;
		padding: 12px;
		border-radius: var(--radio);
		background: var(--ceo);
	}
	.acceso h2,
	.acceso p {
		margin: 0;
	}
	.acceso p + p {
		margin-top: 6px;
	}

	.vaia {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 8px;
	}

	.fala :global(.bub) {
		font-size: 17px;
	}

	.alts a {
		display: block;
		min-height: var(--toque);
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--ceo);
		font-size: 16px;
		font-weight: 800;
		text-decoration: none;
	}

	.alts a:hover {
		background: var(--liña);
	}

	.alts small {
		display: block;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.buscar {
		margin-top: 20px;
	}
</style>
