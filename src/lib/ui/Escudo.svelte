<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { logoUrl } from '#lib/logo-url.js';

	let {
		municipality,
		width = 26
	}: {
		/** `logoVersion` va en el URL del escudo (caché inmutable mientras no cambie). */
		municipality: { slug: string; primaryColor: string; hasLogo: boolean; logoVersion: number };
		/** Ancho en px; el alto es 1,23 veces el ancho. */
		width?: number;
	} = $props();

	const height = $derived(Math.round(width * 1.23));
</script>

{#if municipality.hasLogo}
	<img src={logoUrl(municipality.slug, municipality.logoVersion)} alt="" {width} {height} />
{:else}
	<!-- Escudo genérico con el color del concello -->
	<svg {width} {height} viewBox="0 0 40 48" aria-hidden="true">
		<path
			d="M3 3 h34 v20 c0 13 -8 20 -17 23 c-9 -3 -17 -10 -17 -23z"
			fill="#fff"
			stroke="#17202a"
			stroke-width="3"
		/>
		<path d="M3 24 h34 c0 3 -1 7 -2 9 h-30 c-1 -2 -2 -6 -2 -9z" fill={municipality.primaryColor} />
		<rect x="13" y="9" width="14" height="12" fill={municipality.primaryColor} />
	</svg>
{/if}

<style>
	img {
		object-fit: contain;
	}
</style>
