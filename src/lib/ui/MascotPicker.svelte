<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import { MASCOTS, type Mascot as MascotKey } from '#lib/mascots.js';
	import Mascot from './Mascot.svelte';

	let {
		value = $bindable('sala'),
		name = 'mascot',
		locale = 'gl',
		color
	}: {
		/** Personaje elegido (clave del catálogo). */
		value?: string;
		name?: string;
		locale?: Locale;
		/** Color de la puerta (`sala`), el del tipo. */
		color?: string;
	} = $props();

	const label = (m: MascotKey) => t(locale, `adm.mascota.${m}` as MessageKey);
</script>

<!-- Una rejilla de radios accesibles: cada personaje con su nombre (el dibujo es decorativo) -->
<fieldset class="picker">
	<legend>{t(locale, 'adm.mascota.grupo')}</legend>
	<div class="grid">
		{#each MASCOTS as m (m)}
			<label class="opt" class:on={value === m}>
				<input type="radio" {name} value={m} bind:group={value} />
				<Mascot kind={m} size={44} animated={false} {color} />
				<span>{label(m)}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.picker {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: 6px;
		font-weight: 800;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 8px;
	}

	.opt {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-height: var(--toque);
		padding: 8px 4px;
		border: 2px solid var(--ceo);
		border-radius: 14px;
		background: var(--branco);
		font-size: 14px;
		font-weight: 700;
		text-align: center;
		cursor: pointer;
	}

	.opt.on {
		border-color: var(--txt);
		background: var(--ceo);
	}

	/* El radio queda en el documento (teclado y lectores) pero no se ve */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.opt:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
