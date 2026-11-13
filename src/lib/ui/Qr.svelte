<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { encode } from 'uqr';

	let {
		value,
		label,
		size = 168,
		framed = true,
		decorative = false,
		quiet = 2
	}: {
		/** Contenido del QR: `qrPayload` (ruta de validar con el token firmado de la reserva). */
		value: string;
		/** Texto para lectores de pantalla (no se usa si es decorativo). */
		label?: string;
		/** Lado en píxeles. */
		size?: number;
		/** Con borde propio; sin él cuando ya va dentro de un marco (el llavero grande). */
		framed?: boolean;
		/** Copia pequeña junto a otra con nombre (la lista): oculta a los lectores de pantalla. */
		decorative?: boolean;
		/** Margen blanco en módulos: 4 (el de la norma) en el QR grande que se escanea. */
		quiet?: number;
	} = $props();

	const qr = $derived(encode(value, { border: 0, ecc: 'M' }));
	// Un único trazo con un cuadrado por módulo oscuro.
	const path = $derived(
		qr.data
			.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : '')))
			.join('')
	);
	const side = $derived(qr.size + quiet * 2);
</script>

<svg
	viewBox="0 0 {side} {side}"
	width={size}
	height={size}
	role={decorative ? undefined : 'img'}
	aria-label={decorative ? undefined : label}
	aria-hidden={decorative ? 'true' : undefined}
	class:framed
	shape-rendering="crispEdges"
>
	<rect width={side} height={side} fill="#fff" />
	<path d={path} fill="#17202a" />
</svg>

<style>
	svg {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.framed {
		border: 2px solid var(--txt);
		border-radius: 10px;
	}
</style>
