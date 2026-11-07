<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!-- Faixa «Datos de demostración»: fina, no fluxo da páxina (non tapa nada), só en modo demo. -->
<script lang="ts">
	import { t, type Locale } from '../i18n';

	let {
		locale,
		onDemo,
		onTour
	}: {
		locale: Locale;
		/** Na propia portada /demo sobran as ligazóns. */
		onDemo: boolean;
		/** Volve empezar o percorrido guiado. */
		onTour: () => void;
	} = $props();
</script>

<aside class="faixa" aria-label={t(locale, 'demo.faixa.etiqueta')}>
	<p><span class="cinta" aria-hidden="true"></span>{t(locale, 'demo.faixa')}</p>
	{#if !onDemo}
		<div class="accions">
			<button type="button" onclick={onTour}>{t(locale, 'demo.faixa.percorrido')}</button>
			<a href="/demo">{t(locale, 'demo.faixa.volver')}</a>
		</div>
	{/if}
</aside>

<style>
	.faixa {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 12px;
		padding: 0 12px;
		border-bottom: 1px solid var(--liña);
		background: var(--ceo);
		color: var(--txt);
		font-size: 13px;
		font-weight: 800;
	}

	p {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}

	/* Cinta amarela e negra, como a das obras: «isto é de proba» sen máis texto. */
	.cinta {
		width: 18px;
		height: 10px;
		border-radius: 2px;
		background: repeating-linear-gradient(-45deg, var(--txt) 0 3px, var(--foco) 3px 6px);
	}

	.accions {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}

	button,
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 8px;
		border: 0;
		background: none;
		color: var(--txt);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	button:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: -3px;
	}

	@media print {
		.faixa {
			display: none;
		}
	}
</style>
