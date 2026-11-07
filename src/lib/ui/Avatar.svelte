<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { avatarLabel, isAvatarKey } from '../avatars';
	import { t, type Locale } from '../i18n';
	import { AVATAR_ART } from './avatar-art';

	let {
		avatar,
		userId,
		name,
		size = 40,
		locale,
		decorative = false
	}: {
		avatar: { key: string | null; hasPhoto: boolean };
		userId: string;
		name: string;
		size?: number;
		locale: Locale;
		/** Sen nome propio (p. ex. dentro dunha etiqueta que xa o di): oculto aos lectores. */
		decorative?: boolean;
	} = $props();

	// Id único por instancia: o recorte do corpo non pode repetirse se hai varios avatares.
	const uid = $props.id();
	const clipId = `av-${uid}`;

	const key = $derived(isAvatarKey(avatar.key) ? avatar.key : null);
	const art = $derived(key ? AVATAR_ART[key] : null);
	// Os personaxes de deporte son máis anchos: recórtanse menos ca as caras.
	const viewBox = $derived(key?.startsWith('deporte-') ? '11 13 78 78' : '7 12 86 86');
	const initial = $derived(Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?');
</script>

<!-- Preferencia: foto propia, debuxo do catálogo e, se non hai ningún, a inicial. -->
{#if avatar.hasPhoto}
	<img
		class="avatar"
		src="/api/v1/users/{userId}/avatar"
		alt={decorative ? '' : t(locale, 'vec.avatar.foto', { nome: name })}
		width={size}
		height={size}
		loading="lazy"
	/>
{:else if key && art}
	<span class="avatar" style:width="{size}px" style:height="{size}px" style:background={art.bg}>
		<svg
			width={size}
			height={size}
			{viewBox}
			role={decorative ? undefined : 'img'}
			aria-hidden={decorative ? 'true' : undefined}
			aria-label={decorative
				? undefined
				: t(locale, 'vec.avatar.con_nome', { nome: name, avatar: avatarLabel(key, locale) })}
			focusable="false"
		>
			{#if art.svg.includes('__clip__')}
				<defs>
					<clipPath id={clipId} clipPathUnits="userSpaceOnUse">
						<circle cx="50" cy="60" r="38" />
					</clipPath>
				</defs>
			{/if}
			<!-- Debuxo estático do catálogo (avatar-art.ts): nunca leva texto de usuario. -->
			{@html art.svg.replace('__clip__', clipId)}
		</svg>
	</span>
{:else}
	<span
		class="avatar inicial"
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : name}
		aria-hidden={decorative ? 'true' : undefined}
		style:width="{size}px"
		style:height="{size}px"
		style:font-size="{Math.round(size * 0.48)}px"
	>
		<span aria-hidden="true">{initial}</span>
	</span>
{/if}

<style>
	.avatar {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 50%;
		object-fit: cover;
		background: var(--ceo);
	}

	.avatar svg {
		display: block;
	}

	.inicial {
		background: var(--txt);
		color: #fff;
		font-weight: 900;
		line-height: 1;
	}
</style>
