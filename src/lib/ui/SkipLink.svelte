<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';

	let { locale, target = 'contido' }: { locale: Locale; target?: string } = $props();

	// El router de SvelteKit devuelve el foco al principio tras un salto a `#ancla`, y el siguiente
	// Tab volvería a la cabecera. Se lleva el foco al destino a mano; sin JavaScript vale el href.
	function jump(event: MouseEvent) {
		const el = document.getElementById(target);
		if (!el) return;
		event.preventDefault();
		if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
		el.focus();
		el.scrollIntoView();
	}
</script>

<a class="salto" href="#{target}" onclick={jump}>{t(locale, 'salto.contido')}</a>

<style>
	/* Fuera de pantalla hasta que recibe el foco con el teclado. */
	.salto {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 100;
		padding: 12px 18px;
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font-weight: 800;
		text-decoration: none;
		transform: translateY(-200%);
	}

	.salto:focus-visible {
		transform: none;
		outline: 3px solid var(--foco);
		outline-offset: 2px;
	}
</style>
