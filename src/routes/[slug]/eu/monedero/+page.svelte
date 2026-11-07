<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { formatAmount, formatEuros } from '#lib/ui/format.js';
	import QrScanner from '#lib/ui/QrScanner.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);
	const labels: Record<string, MessageKey> = {
		recarga_tarxeta: 'vec.monedero.mov.recarga_tarxeta',
		recarga_mobil: 'vec.monedero.mov.recarga_mobil',
		pago_reserva: 'vec.monedero.mov.pago_reserva',
		pago_abono: 'vec.monedero.mov.pago_abono',
		devolucion: 'vec.monedero.mov.devolucion',
		axuste: 'vec.monedero.mov.axuste'
	};
	let code = $state('');
	function scanned(value: string) { code = value; }
</script>

<svelte:head>
	<title>{t(locale, 'vec.monedero.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main>
	<a href="{base}/eu">{t(locale, 'vec.eu.volver')}</a>
	<h1>{t(locale, 'vec.monedero.titulo')}</h1>
	<p class="saldo">
		{t(locale, 'vec.monedero.saldo')}
		<b>{formatAmount(data.wallet.balanceCents)}</b>
	</p>
	{#if form?.error}
		<p role="alert">{t(locale, `vec.monedero.erro.${form.error}` as MessageKey)}</p>
	{/if}
	{#if data.recharged}
		<p role="status">{t(locale, 'vec.monedero.recargado')}</p>
	{/if}
	<section>
		<h2>{t(locale, 'vec.monedero.recargar')}</h2>
		<form method="POST" action="?/recargar">
			<label>
				{t(locale, 'vec.monedero.codigo')}
				<input name="code" bind:value={code} autocomplete="off" maxlength="80" required />
			</label>
			<QrScanner {locale} onDetect={scanned} />
			<button type="submit">{t(locale, 'vec.monedero.usar')}</button>
		</form>
	</section>
	{#if data.mobilePay}
		<section class="simulacion">
			<h2>{t(locale, 'vec.monedero.mobil')}</h2>
			<p>{t(locale, 'vec.monedero.simulacion')}</p>
			<form method="POST" action="?/mobil">
				<input type="hidden" name="idempotencyKey" value={data.mobileTopUpKey} />
				<label>
					{t(locale, 'vec.monedero.importe')}
					<select name="amountCents">
						<option value="1000">{formatEuros(1000, locale)}</option>
						<option value="2000">{formatEuros(2000, locale)}</option>
						<option value="5000">{formatEuros(5000, locale)}</option>
					</select>
				</label>
				<button type="submit">{t(locale, 'vec.monedero.mobil')}</button>
			</form>
		</section>
	{/if}
	<section>
		<h2>{t(locale, 'vec.monedero.historial')}</h2>
		{#if data.wallet.movements.length === 0}
			<p>{t(locale, 'vec.monedero.sen_movimentos')}</p>
		{:else}
			<ul>
				{#each data.wallet.movements as movement (movement.id)}
					<li>
						<span>{t(locale, labels[movement.kind])}</span>
						<b class:negativo={movement.amountCents < 0}>
							{formatAmount(movement.amountCents)}
						</b>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	main { padding: 16px; }
	.saldo { display: grid; gap: 4px; padding: 16px; background: var(--ceo); border-radius: var(--radio); font-size: 18px; }
	.saldo b { font-size: 30px; }
	section { margin-top: 24px; }
	form { display: grid; gap: 10px; max-width: 360px; }
	label { display: grid; gap: 4px; font-weight: 800; }
	input, button { min-height: var(--toque); font: inherit; }
	ul { padding: 0; list-style: none; }
	li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--granito); }
	.negativo { color: var(--perigo); }
</style>
