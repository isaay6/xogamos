<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import FacilityForm from '../FacilityForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const base = $derived(`/${data.municipality.slug}/admin/instalacions`);
	const v = $derived(form?.values ?? {});
	const initial = $derived({
		typeId: v.typeId ?? data.types[0]?.id ?? '',
		name: v.name ?? '',
		location: v.location ?? '',
		address: v.address ?? '',
		latitude: v.latitude ?? '',
		longitude: v.longitude ?? '',
		units: v.units ?? '2',
		capacity: v.capacity ?? '10',
		slotMinutes: v.slotMinutes ?? '60',
		priceResident: v.priceResident ?? '0',
		priceNonResident: v.priceNonResident ?? '0',
		priceSocial: v.priceSocial ?? '',
		accessible: v.accessible === 'on',
		needsOpening: v.needsOpening === 'on',
		accessInfo: v.accessInfo ?? '',
		accessInfoEs: v.accessInfoEs ?? '',
		rules: v.rules ?? ''
	});
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.nova.titulo')} · {data.municipality.name}</title>
</svelte:head>

<header class="mh">
	<div>
		<p class="k"><a href={base}>{t(data.locale, 'adm.fac.k')}</a></p>
		<h1>{t(data.locale, 'adm.nova.titulo')}</h1>
	</div>
	<Button type="submit" form="fac-form" disabled={data.types.length === 0}
		>{t(data.locale, 'adm.nova.crear')}</Button
	>
</header>

{#if data.types.length === 0}
	<p class="vacio">
		{t(data.locale, 'adm.nova.sen_tipos')}
		<a href="{base}/tipos/novo">{t(data.locale, 'adm.tipos.novo')}</a>
	</p>
{:else}
	{#key form}
		<FacilityForm
			types={data.types}
			{initial}
			locale={data.locale}
			error={form?.error ?? null}
			issues={form && 'issues' in form ? form.issues : []}
		/>
	{/key}
{/if}

<style>
	.mh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 800;
	}

	.k a,
	.vacio a {
		color: var(--txt);
	}

	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}

	.vacio {
		font-weight: 700;
	}
</style>
