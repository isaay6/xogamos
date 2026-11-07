<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import { formatCode, formatEuros, formatTime } from '#lib/ui/format.js';
	import { dayLabel } from '../../../dates';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const r = $derived(data.receipt);
	const back = $derived(`/${data.municipality.slug}/conserxeria/nova`);
	const place = $derived(
		[
			facilityLabel(locale, r.facilityName, r.unitIndex, nounFor('unit', r.mascot)),
			r.location,
			r.address
		]
			.filter((x) => x !== '')
			.join(' · ')
	);
</script>

<svelte:head>
	<title>{t(locale, 'cons.xus.titulo')}</title>
</svelte:head>

<article class="xus">
	<h1>{data.municipality.name}</h1>
	<p class="sub">{t(locale, 'cons.xus.titulo')}</p>
	<dl>
		<dt>{t(locale, 'cons.xus.nome')}</dt>
		<dd>{r.displayName}</dd>
		<dt>{t(locale, 'cons.xus.instalacion')}</dt>
		<dd>{place}</dd>
		<dt>{t(locale, 'cons.xus.cando')}</dt>
		<dd>
			{dayLabel(locale, r.startsAt.toISOString())} · {formatTime(r.startsAt)}–{formatTime(r.endsAt)}
		</dd>
		<dt>{t(locale, 'cons.xus.prezo')}</dt>
		<dd>{formatEuros(r.priceCents, locale)}{#if r.priceCents > 0} · {t(locale, 'cons.nova.pago')}{/if}</dd>
	</dl>
	<p class="codigo-l">{t(locale, 'cons.xus.codigo')}</p>
	<p class="codigo">{formatCode(r.accessCode)}</p>
</article>

<p class="acts">
	<button type="button" onclick={() => window.print()}>{t(locale, 'cons.xus.imprimir')}</button>
	<a href={back}>{t(locale, 'cons.xus.volver')}</a>
</p>

<style>
	.xus {
		max-width: 420px;
		padding: 24px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
	}
	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 900;
	}
	.sub {
		margin: 0 0 12px;
		font-weight: 700;
		color: var(--gris);
	}
	dt {
		font-size: 13px;
		font-weight: 600;
		color: var(--gris);
	}
	dd {
		margin: 0 0 8px;
		font-size: 17px;
		font-weight: 800;
	}
	.codigo-l {
		margin: 12px 0 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--gris);
	}
	.codigo {
		margin: 0;
		font-size: 48px;
		font-weight: 900;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}
	.acts {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-top: 16px;
	}
	.acts button {
		min-height: var(--toque);
		padding: 0 18px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	.acts a {
		color: var(--txt);
		font-weight: 800;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	/* Impresión: solo el justificante, sin el menú lateral ni los botones. */
	@media print {
		:global(.side),
		:global(header),
		.acts {
			display: none !important;
		}
		:global(.shell) {
			display: block !important;
		}
		.xus {
			border-color: #000;
			max-width: none;
		}
	}
</style>
