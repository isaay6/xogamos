<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import { longDate } from '#lib/ui/format.js';

	let {
		facility,
		locale
	}: {
		facility: {
			stepFreeAccess: 'yes' | 'no' | 'partial' | null;
			adaptedToilet: boolean | null;
			adaptedChangingRoom: boolean | null;
			accessibleParkingNearby: boolean | null;
			hearingLoop: boolean | null;
			supportContact: string | null;
			accessibilityNotes: string | null;
			accessibilityCheckedAt: string | null;
		};
		locale: Locale;
	} = $props();

	const boolText = (value: boolean | null) =>
		t(locale, `vec.acc.${value === null ? 'unknown' : value ? 'yes' : 'no'}` as MessageKey);
	const stepText = (value: 'yes' | 'no' | 'partial' | null) =>
		t(locale, `vec.acc.${value ?? 'unknown'}` as MessageKey);
	const dateText = (value: string) => longDate(locale, value);
</script>

<section class="ficha" aria-labelledby="accesibilidade-t" data-tour="accesibilidade">
	<h2 id="accesibilidade-t">{t(locale, 'vec.acc.titulo')}</h2>
	<ul>
		<li>
			<span aria-hidden="true">♿</span><b>{t(locale, 'vec.acc.step')}</b>
			{stepText(facility.stepFreeAccess)}
		</li>
		<li>
			<span aria-hidden="true">🚻</span><b>{t(locale, 'vec.acc.toilet')}</b>
			{boolText(facility.adaptedToilet)}
		</li>
		<li>
			<span aria-hidden="true">🚪</span><b>{t(locale, 'vec.acc.changing')}</b>
			{boolText(facility.adaptedChangingRoom)}
		</li>
		<li>
			<span aria-hidden="true">🅿</span><b>{t(locale, 'vec.acc.parking')}</b>
			{boolText(facility.accessibleParkingNearby)}
		</li>
		<li>
			<span aria-hidden="true">◉</span><b>{t(locale, 'vec.acc.loop')}</b>
			{boolText(facility.hearingLoop)}
		</li>
	</ul>
	{#if facility.accessibilityCheckedAt}
		<p class="checked">
			{t(locale, 'vec.acc.checked', { data: dateText(facility.accessibilityCheckedAt) })}
		</p>
	{/if}
	{#if facility.supportContact}
		<p>
			<b>{t(locale, 'vec.acc.contact')}</b>
			<a href={`tel:${facility.supportContact}`}>{facility.supportContact}</a>
		</p>
	{/if}
	{#if facility.accessibilityNotes}<p>{facility.accessibilityNotes}</p>{/if}
</section>

<style>
	.ficha {
		margin-top: 18px;
		padding: 14px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
	}

	h2 {
		margin: 0 0 8px;
		font-size: 20px;
	}

	ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li span {
		display: inline-block;
		width: 1.5em;
	}

	.checked {
		margin-bottom: 0;
		font-size: 14px;
		color: var(--texto-suave);
	}
</style>
