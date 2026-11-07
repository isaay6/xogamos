<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.js';
	import StaffShell from '#lib/ui/StaffShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/${data.municipality.slug}`);
	const menu = $derived([
		{ href: `${base}/conserxeria`, label: t(data.locale, 'cons.menu.axenda'), icon: 'agenda' },
		...(data.isApertura
			? []
			: [
					{
						href: `${base}/conserxeria/nova`,
						label: t(data.locale, 'cons.menu.nova'),
						icon: 'nova'
					}
				]),
		{
			href: `${base}/conserxeria/validar`,
			label: t(data.locale, 'cons.menu.validar'),
			icon: 'validar'
		},
		...(data.isApertura
			? []
			: [
					{
						href: `${base}/conserxeria/persoa`,
						label: t(data.locale, 'cons.menu.buscar'),
						icon: 'persoa'
					}
				]),
		...(data.isApertura
			? []
			: [
					{
						href: `${base}/conserxeria/folla`,
						label: t(data.locale, 'cons.menu.folla'),
						// Unha folla con liñas: a mesma icona que «Normas».
						icon: 'normas'
					},
					{
						href: `${base}/conserxeria/monedero`,
						label: t(data.locale, 'adm.menu.monedero'),
						icon: 'abonos'
					}
				]),
		...(data.isAdmin
			? [{ href: `${base}/admin`, label: t(data.locale, 'cons.menu.admin'), icon: 'admin' }]
			: [])
	]);
</script>

<StaffShell
	{menu}
	current={page.url.pathname}
	userName={data.userName}
	municipality={data.municipality}
	locale={data.locale}
>
	{@render children()}
</StaffShell>
