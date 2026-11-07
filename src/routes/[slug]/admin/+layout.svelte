<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.js';
	import StaffShell from '#lib/ui/StaffShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/${data.municipality.slug}`);
	const menu = $derived([
		{ href: `${base}/admin`, label: t(data.locale, 'adm.menu.resumo'), icon: 'resumo' },
		{
			href: `${base}/admin/instalacions`,
			label: t(data.locale, 'adm.menu.instalacions'),
			icon: 'instalacions'
		},
		{
			href: `${base}/admin/horarios`,
			label: t(data.locale, 'adm.menu.horarios'),
			icon: 'horarios'
		},
		{
			href: `${base}/admin/temporadas`,
			label: t(data.locale, 'adm.menu.temporadas'),
			icon: 'temporadas'
		},
		{
			href: `${base}/admin/solicitudes`,
			label: t(data.locale, 'adm.menu.solicitudes'),
			icon: 'avisos',
			badge: data.pendingRequests
		},
		{ href: `${base}/admin/torneos`, label: t(data.locale, 'adm.menu.torneos'), icon: 'avisos' },
		{
			href: `${base}/admin/entidades`,
			label: t(data.locale, 'adm.menu.entidades'),
			icon: 'persoal'
		},
		{ href: `${base}/admin/abonos`, label: t(data.locale, 'adm.menu.abonos'), icon: 'abonos' },
		{ href: `${base}/admin/monedero`, label: t(data.locale, 'adm.menu.monedero'), icon: 'abonos' },
		{ href: `${base}/admin/avisos`, label: t(data.locale, 'adm.menu.avisos'), icon: 'avisos' },
		{
			href: `${base}/admin/rexistro`,
			label: t(data.locale, 'adm.menu.rexistro'),
			icon: 'rexistro'
		},
		{ href: `${base}/admin/normas`, label: t(data.locale, 'adm.menu.normas'), icon: 'normas' },
		{ href: `${base}/admin/persoal`, label: t(data.locale, 'adm.menu.persoal'), icon: 'persoal' },
		{
			href: `${base}/admin/concello`,
			label: t(data.locale, 'adm.menu.concello'),
			icon: 'concello'
		},
		{
			href: `${base}/admin/exportar`,
			label: t(data.locale, 'adm.menu.exportar'),
			icon: 'exportar'
		},
		{
			href: `${base}/conserxeria`,
			label: t(data.locale, 'adm.menu.conserxeria'),
			icon: 'conserxeria'
		}
	]);
</script>

<svelte:head>
	<title>{data.municipality.name}</title>
</svelte:head>

<StaffShell
	{menu}
	current={page.url.pathname}
	userName={data.staffName}
	municipality={data.municipality}
	locale={data.locale}
>
	{@render children()}
</StaffShell>
