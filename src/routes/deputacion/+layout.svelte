<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.js';
	import StaffShell from '#lib/ui/StaffShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const menu = $derived([
		{ href: '/deputacion', label: t(data.locale, 'dep.menu.comparativa'), icon: 'resumo' },
		{ href: '/deputacion/novo', label: t(data.locale, 'dep.menu.novo'), icon: 'nova' },
		{ href: '/deputacion/rexistro', label: t(data.locale, 'dep.menu.rexistro'), icon: 'rexistro' },
		{ href: '/deputacion/administradores', label: t(data.locale, 'dep.menu.admins'), icon: 'persoal' }
	]);
</script>

<svelte:head>
	<title>{t(data.locale, 'staff.deputacion')}</title>
</svelte:head>

<StaffShell {menu} current={page.url.pathname} userName={data.staffName} locale={data.locale}>
	{@render children()}
</StaffShell>
