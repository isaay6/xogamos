<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { isAvatarKey } from '../avatars';

	// Insignia lixeira da cabeceira: foto, debuxo servido como imaxe ou inicial. Non importa o
	// catálogo de debuxos (avatar-art.ts, ~47 KB), que só cargan as páxinas que escollen avatar.
	// Decorativa: o enlace que a leva xa ten nome («Eu: {nome}»).
	let {
		user,
		size = 32
	}: {
		user: { id: string; initial: string; avatar?: { key: string | null; hasPhoto: boolean } };
		size?: number;
	} = $props();

	const key = $derived(isAvatarKey(user.avatar?.key) ? user.avatar?.key : null);
	const src = $derived(
		user.avatar?.hasPhoto
			? `/api/v1/users/${user.id}/avatar`
			: key
				? `/api/v1/avatars/${key}`
				: null
	);
</script>

{#if src}
	<img class="badge" {src} alt="" width={size} height={size} />
{:else}
	<span
		class="badge inicial"
		aria-hidden="true"
		style:width="{size}px"
		style:height="{size}px"
		style:font-size="{Math.round(size * 0.5)}px">{user.initial}</span
	>
{/if}

<style>
	.badge {
		display: grid;
		flex: none;
		place-items: center;
		border-radius: 50%;
		object-fit: cover;
		background: var(--ceo);
	}

	.inicial {
		background: var(--txt);
		color: var(--branco);
		font-weight: 900;
		line-height: 1;
	}
</style>
