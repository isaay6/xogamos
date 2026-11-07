<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import type { Locale } from '#lib/i18n/index.js';

	let {
		locale,
		cancellationMinutes,
		noShowThreshold,
		penaltyDays,
		maxDaysAhead,
		rulesHref,
		showAccept = false
	}: {
		locale: Locale;
		cancellationMinutes: number;
		noShowThreshold: number;
		penaltyDays: number;
		maxDaysAhead: number;
		rulesHref: string;
		showAccept?: boolean;
	} = $props();

	const hours = $derived(cancellationMinutes / 60);
</script>

<section class="normas" aria-labelledby="normas-t">
	<h2 id="normas-t">{t(locale, 'vec.normas.titulo')}</h2>
	<ul>
		<li>
			<span aria-hidden="true">◷</span>
			{t(locale, 'vec.normas.cancelar', { n: hours })}
		</li>
		<li>
			<span aria-hidden="true">!</span>
			{t(locale, 'vec.normas.faltas', { n: noShowThreshold, dias: penaltyDays })}
		</li>
		<li>
			<span aria-hidden="true">▣</span>
			{t(locale, 'vec.normas.antelacion', { n: maxDaysAhead })}
		</li>
	</ul>
	<a href={rulesHref}>{t(locale, 'vec.normas.ver_todas')}</a>
	{#if showAccept}
		<label class="accept">
			<input type="checkbox" name="rulesAccepted" value="yes" required />
			{t(locale, 'vec.normas.lin')}
		</label>
	{/if}
</section>

<style>
	.normas {
		margin-top: 18px;
		padding: 14px;
		border: 2px solid var(--ceo);
		border-radius: var(--radio);
	}

	h2 {
		margin: 0 0 8px;
		font-size: 18px;
	}

	ul {
		display: grid;
		gap: 8px;
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		gap: 10px;
		align-items: start;
		font-weight: 700;
	}

	li span {
		display: inline-grid;
		place-items: center;
		min-width: 24px;
		min-height: 24px;
		border-radius: 50%;
		background: var(--ceo);
		font-weight: 900;
	}

	a {
		color: inherit;
		font-weight: 800;
	}

	.accept {
		display: flex;
		gap: 8px;
		align-items: center;
		min-height: var(--toque);
		margin-top: 12px;
		font-weight: 800;
	}
</style>
