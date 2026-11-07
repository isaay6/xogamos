<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Bocadillo: lo que dice el personaje que va a su lado -->
<p class="bub">{@render children()}</p>

<style>
	.bub {
		background: var(--branco);
		border: 2px solid var(--txt);
		border-radius: 14px 14px 14px 4px;
		padding: 8px 12px;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.3;
		max-width: 28ch;
	}
</style>
