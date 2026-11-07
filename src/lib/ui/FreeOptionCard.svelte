<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script module lang="ts">
	/** Lo que pinta la tarjeta: coincide con `FreeOption` de `search.ts`, sin código de servidor. */
	export type FreeOptionView = {
		facilityName: string;
		location: string;
		unitIndex: number | null;
		remainingSeats: number | null;
		startsAt: Date;
		priceResidentCents: number;
		priceNonResidentCents: number;
		/** Precio de la persona con sesión (`priceFor` en el servidor), con su tarifa social. */
		priceCents?: number | null;
	};
</script>

<script lang="ts">
	import { t, type Locale } from '../i18n';
	import { facilityLabel, priceText, type Noun } from './booking-text';
	import { formatTime } from './format';

	let {
		option,
		href,
		resident = null,
		noun = 'pistas',
		locale = 'gl'
	}: {
		option: FreeOptionView;
		/** Destino de «Esta» (confirmar). Sin `href`, la tarjeta es solo de muestra. */
		href?: string;
		/** Empadronada o no; `null` si no se sabe (se muestran los dos precios). */
		resident?: boolean | null;
		/** Cómo se llama la unidad («Pista 2», «Rúa 2»…): `nounFor(modo, personaxe)`. */
		noun?: Noun;
		locale?: Locale;
	} = $props();

	const name = $derived(facilityLabel(locale, option.facilityName, option.unitIndex, noun));
	const price = $derived(
		priceText(
			locale,
			resident,
			option.priceResidentCents,
			option.priceNonResidentCents,
			option.priceCents ?? null
		)
	);
	const seatsKey = $derived(
		option.remainingSeats === 1 ? 'vec.opcion.prazas.un' : 'vec.opcion.prazas.varios'
	);
	const seats = $derived(
		option.remainingSeats === null ? null : t(locale, seatsKey, { n: option.remainingSeats })
	);
	const detail = $derived([option.location, price, seats].filter(Boolean).join(' · '));
</script>

<div class="opcion">
	<div class="texto">
		<b>{name}</b>
		<small>{detail}</small>
		{#if (option.priceCents ?? Math.max(option.priceResidentCents, option.priceNonResidentCents)) > 0}<small
				>{t(locale, 'vec.prezo.pago')}</small
			>{/if}
	</div>
	{#if href}
		<a
			class="esta"
			{href}
			aria-label={t(locale, 'vec.opcion.esta_etiqueta', {
				nome: name,
				hora: formatTime(option.startsAt)
			})}>{t(locale, 'vec.opcion.esta')}</a
		>
	{/if}
</div>

<style>
	.opcion {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 12px 12px 14px;
		border: 2px solid var(--ceo);
		border-radius: 14px;
		background: var(--branco);
	}

	.texto {
		min-width: 0;
	}

	b {
		display: block;
		font-size: 17px;
		font-weight: 800;
		line-height: 1.2;
	}

	small {
		display: block;
		margin-top: 2px;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.esta {
		flex: none;
		display: grid;
		place-items: center;
		min-width: 72px;
		min-height: var(--toque);
		padding: 0 16px;
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font-weight: 800;
		text-decoration: none;
	}
</style>
