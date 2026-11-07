<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		href,
		type = 'button',
		disabled = false,
		form,
		name,
		value,
		children,
		...rest
	}: {
		/** `primary`: relleno oscuro; `out`: contorno; `perigo`: acción destructiva. */
		variant?: 'primary' | 'out' | 'perigo';
		/** Con `href` se pinta un enlace con aspecto de botón. */
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		form?: string;
		name?: string;
		value?: string;
		children: Snippet;
	} & HTMLAttributes<HTMLElement> = $props();
</script>

{#if href}
	<a class="btn {variant}" {href} {...rest}>{@render children()}</a>
{:else}
	<button class="btn {variant}" {type} {disabled} {form} {name} {value} {...rest}
		>{@render children()}</button
	>
{/if}

<style>
	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: var(--toque);
		padding: 12px 16px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--txt);
		color: var(--branco);
		font-size: 16px;
		font-weight: 800;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
	}

	.out {
		background: var(--branco);
		color: var(--txt);
	}

	.perigo {
		background: var(--perigo);
		border-color: var(--perigo);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
