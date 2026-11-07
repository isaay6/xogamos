<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '../i18n';
	import { formatCode, textOn } from './format';
	import Mascot from './Mascot.svelte';
	import Qr from './Qr.svelte';

	let {
		code,
		color,
		title = '',
		subtitle = '',
		size = 'lg',
		drop = false,
		locale = 'gl',
		mascot,
		qr = null,
		qrLabel = ''
	}: {
		/** PIN de 4 cifras; se muestra tal cual (un código antiguo de 6 se agrupa en dos). */
		code: string;
		/** Color del deporte ('#RRGGBB'). */
		color: string;
		title?: string;
		subtitle?: string;
		/**
		 * `sm`: mini-llavero de las listas (PIN y mascota); `lg`: tarjeta de la reserva;
		 * `xl`: el llavero grande del detalle, con el QR y el PIN (mockup B3 opción 1);
		 * `row`: el llavero tumbado de la portada (portada opción 1b), con el PIN, una línea y el
		 * QR pequeño, que es decorativo: el grande está en el detalle.
		 */
		size?: 'sm' | 'lg' | 'xl' | 'row';
		/** Cae con una animación corta al reservar (solo con no-preference). */
		drop?: boolean;
		locale?: Locale;
		/** Personaje del deporte al pie del mini-llavero (`sm`). */
		mascot?: string;
		/** Lo que codifica el QR (`xl` y `row`); sin él (Ruling 2) solo se ve el PIN. */
		qr?: string | null;
		qrLabel?: string;
	} = $props();
</script>

<div class="chaveiro {size}" class:drop style:--fob={color} style:--fob-txt={textOn(color)}>
	{#if size !== 'sm' && size !== 'row'}<span class="aro" aria-hidden="true"></span>{/if}
	{#if size === 'row'}
		<div class="fob">
			<div class="txt">
				<small aria-hidden="true">{t(locale, 'chaveiro.pin')}</small>
				<span class="sr">{t(locale, 'chaveiro.codigo')}</span>
				<b>{formatCode(code)}</b>
				{#if subtitle}<small>{subtitle}</small>{/if}
			</div>
			{#if qr}
				<span class="qrb"><Qr value={qr} size={62} framed={false} decorative /></span>
			{/if}
		</div>
	{:else}
		<div class="fob">
			{#if size === 'xl' && qr}
				<div class="qrw"><Qr value={qr} label={qrLabel} size={208} framed={false} quiet={4} /></div>
			{/if}
			<span class="sr">{t(locale, 'chaveiro.codigo')}</span>
			<b>{formatCode(code)}</b>
			{#if size === 'xl'}
				<small class="pin" aria-hidden="true">{t(locale, 'chaveiro.pin')}</small>
			{:else if size === 'lg'}
				<small>{title}<br />{subtitle}</small>
			{:else if mascot}
				<span class="selo"><Mascot kind={mascot} size={26} animated={false} /></span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.chaveiro {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		flex: none;
	}

	.aro {
		position: relative;
		z-index: 1;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: 7px solid var(--apagado);
		margin-bottom: -20px;
	}

	.fob {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--fob);
		color: var(--fob-txt);
		box-shadow: inset -8px -10px 0 rgba(0, 0, 0, 0.12);
		text-align: center;
	}

	.fob::before {
		content: '';
		position: absolute;
		left: 50%;
		border-radius: 50%;
		background: var(--branco);
		transform: translateX(-50%);
	}

	.lg .fob {
		width: 140px;
		min-height: 200px;
		padding: 54px 10px 24px;
		border-radius: 24px 24px 56px 56px;
	}

	.lg .fob::before {
		top: 13px;
		width: 22px;
		height: 22px;
	}

	.lg b {
		font-size: 34px;
		font-weight: 900;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.lg small {
		margin-top: 10px;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.25;
	}

	/* Llavero grande: el QR blanco dentro, el PIN debajo y la anilla arriba */
	.xl .aro {
		width: 58px;
		height: 58px;
		border-width: 8px;
		margin-bottom: -26px;
	}

	.xl .fob {
		width: min(272px, 100%);
		padding: 42px 20px 44px;
		border-radius: 30px 30px 90px 90px;
		box-shadow: inset -12px -14px 0 rgba(0, 0, 0, 0.12);
	}

	.xl .fob::before {
		top: 14px;
		width: 20px;
		height: 20px;
	}

	.qrw {
		padding: 8px;
		border-radius: 16px;
		background: var(--branco);
	}

	.xl b {
		margin-top: 8px;
		font-size: 46px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: 0.12em;
		/* El espaciado sobra al final: se compensa para que quede centrado */
		margin-right: -0.12em;
		white-space: nowrap;
	}

	.pin {
		margin-top: 4px;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.sm .fob {
		width: 58px;
		height: 88px;
		padding-top: 24px;
		border-radius: 12px 12px 28px 28px;
		box-shadow: inset -5px -6px 0 rgba(0, 0, 0, 0.12);
	}

	.sm .fob::before {
		top: 7px;
		width: 10px;
		height: 10px;
	}

	.sm b {
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	.selo {
		position: absolute;
		bottom: 8px;
		left: 50%;
		display: flex;
		transform: translateX(-50%);
	}

	/* Llavero tumbado: la anilla a la izquierda, el PIN y el QR pequeño a la derecha */
	.row {
		display: flex;
	}

	.row .fob {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		padding: 14px 14px 18px 60px;
		border-radius: 18px 18px 40px 40px;
		text-align: left;
	}

	.row .fob::before {
		top: 50%;
		left: 18px;
		width: 24px;
		height: 24px;
		transform: translateY(-50%);
	}

	.row .txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.row small {
		font-size: 13px;
		font-weight: 700;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.row b {
		font-size: 34px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	.qrb {
		flex: none;
		padding: 4px;
		border-radius: 10px;
		background: var(--branco);
	}

	@media (prefers-reduced-motion: no-preference) {
		.drop {
			animation: fob-drop 0.7s cubic-bezier(0.3, 0.7, 0.4, 1) both;
		}
	}
</style>
