<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	let {
		lit,
		label
	}: {
		/** Focos encendidos; se limita a 0–4. */
		lit: number;
		/** Texto para lectores de pantalla; sin él, los focos son decorativos. */
		label?: string;
	} = $props();

	const on = $derived(Math.max(0, Math.min(4, Math.trunc(lit) || 0)));
</script>

<span
	class="lamps"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#each [0, 1, 2, 3] as i (i)}<i class={i < on ? 'on' : undefined}></i>{/each}
</span>

<style>
	.lamps {
		display: inline-grid;
		grid-template-columns: repeat(4, 16px);
		gap: 4px;
		padding: 5px;
		background: #3b4148;
		border-radius: 6px;
	}

	i {
		height: 16px;
		border-radius: 3px;
		background: #5b636b;
	}

	i.on {
		background: var(--foco);
		box-shadow: 0 0 8px rgba(255, 216, 77, 0.6);
	}
</style>
