<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import { formatEuros } from '#lib/ui/format.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
</script>
<h1>{t(locale, 'adm.monedero.titulo')}</h1>
<form method="POST" action="?/emitir">
	<label>
		{t(locale, 'adm.monedero.importe')}
		<select name="amountCents">
			<option value="1000">{formatEuros(1000, locale)}</option>
			<option value="2000">{formatEuros(2000, locale)}</option>
			<option value="5000">{formatEuros(5000, locale)}</option>
		</select>
	</label>
	<button type="submit">{t(locale, 'adm.monedero.emitir')}</button>
</form>
{#if form?.issued}
	<div class="card">
		<b>{formatEuros(form.issued.amountCents, locale)}</b>
		<code>{form.issued.code}</code>
	</div>
{/if}
<style>form, label { display: grid; gap: 8px; max-width: 260px; } select, button { min-height: var(--toque); font: inherit; } .card { display: grid; gap: 8px; max-width: 320px; margin-top: 16px; padding: 18px; border: 3px dashed var(--txt); border-radius: var(--radio); } code { font-size: 24px; }</style>
