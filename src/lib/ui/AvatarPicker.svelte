<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { AVATARS, avatarLabel, type AvatarKey } from '../avatars';
	import { t, type Locale, type MessageKey } from '../i18n';
	import Avatar from './Avatar.svelte';
	import Button from './Button.svelte';
	import { downscalePhoto } from './photo-resize';

	// Selector de avatar (mockups-v1/avatares.html, opción 1 «Grella con pestanas»): Persoas
	// (con nenos), Deportes e Foto. Sen JS: as pestanas son ligazóns e cada grella é un formulario
	// de radios; a foto vai nun formulario multipart normal.
	type Tab = 'persoas' | 'deportes' | 'foto';

	let {
		locale,
		name,
		userId,
		avatar,
		tab,
		tabHref,
		hidden = {},
		query = '',
		submitLabel,
		avatarErro = false,
		fotoErro = null,
		actions: extra
	}: {
		locale: Locale;
		name: string;
		userId: string;
		avatar: { key: string | null; hasPhoto: boolean };
		tab: Tab;
		tabHref: (tab: Tab) => string;
		/** Campos ocultos de todos os formularios (p. ex. `redirectTo` na benvida). */
		hidden?: Record<string, string>;
		/** Consulta extra tras a acción (`&redirectTo=…`): sen JS, a páxina de erro consérvaa. */
		query?: string;
		/** Texto do botón da grella; por defecto «Gardar avatar». */
		submitLabel?: string;
		avatarErro?: boolean;
		fotoErro?: 'PHOTO_TOO_LARGE' | 'UNSUPPORTED_IMAGE' | null;
		/** Accións extra baixo o botón (p. ex. «Saltar»). */
		actions?: Snippet;
	} = $props();

	const tabs: Tab[] = ['persoas', 'deportes', 'foto'];
	const keys = $derived(AVATARS.filter((k) => k.startsWith('deporte-') === (tab === 'deportes')));
	const initial = $derived(Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?');

	// Con JS a foto redúcese no navegador (512 px, WebP ou JPEG) antes de enviala; tras gardar
	// recárgase a páxina enteira, para que a foto nova se vexa tamén na cabeceira.
	const reducePhoto: SubmitFunction = async ({ formData }) => {
		const file = formData.get('foto');
		if (file instanceof File && file.size > 0) {
			const small = await downscalePhoto(file);
			if (small) formData.set('foto', small);
		}
		return async ({ result, update }) => {
			if (result.type === 'redirect') location.assign(result.location);
			else await update();
		};
	};
</script>

{#snippet campos()}
	{#each Object.entries(hidden) as [k, v] (k)}
		<input type="hidden" name={k} value={v} />
	{/each}
{/snippet}

<div class="picker">
	<div class="prev">
		<Avatar {avatar} {userId} {name} {locale} size={96} />
		<p class="bub">{t(locale, 'vec.picker.actual')}</p>
	</div>

	<nav class="tabs" aria-label={t(locale, 'vec.picker.tipos')}>
		{#each tabs as one (one)}
			<a
				href={tabHref(one)}
				aria-current={one === tab ? 'page' : undefined}
				data-sveltekit-noscroll
				data-sveltekit-replacestate>{t(locale, `vec.picker.${one}` as MessageKey)}</a
			>
		{/each}
	</nav>

	{#if tab !== 'foto'}
		<form method="POST" action="?/avatar{query}" use:enhance>
			{@render campos()}
			<fieldset>
				<legend class="sr">{t(locale, 'vec.picker.legend')}</legend>
				<div class="grella">
					{#each keys as key (key)}
						<label class="pc">
							<input
								class="sr"
								type="radio"
								name="avatar"
								value={key}
								checked={avatar.key === key}
							/>
							<Avatar
								avatar={{ key, hasPhoto: false }}
								{userId}
								{name}
								{locale}
								size={64}
								decorative
							/>
							<span class="sr">{avatarLabel(key as AvatarKey, locale)}</span>
							<span class="tick" aria-hidden="true">✓</span>
						</label>
					{/each}
				</div>
				{#if tab === 'persoas'}
					<label class="inicial">
						<input type="radio" name="avatar" value="" checked={avatar.key === null} />
						<span class="letra" aria-hidden="true">{initial}</span>
						<span>
							{t(locale, 'vec.picker.inicial')}
							<small>{t(locale, 'vec.picker.inicial.nota')}</small>
						</span>
					</label>
				{/if}
			</fieldset>
			{#if avatarErro}
				<p class="erro" role="alert">{t(locale, 'vec.picker.erro')}</p>
			{/if}
			<div class="botons">
				<Button type="submit">{submitLabel ?? t(locale, 'vec.picker.gardar')}</Button>
				{@render extra?.()}
			</div>
		</form>
	{:else}
		<form
			method="POST"
			action="?/foto{query}"
			enctype="multipart/form-data"
			class="foto"
			use:enhance={reducePhoto}
		>
			{@render campos()}
			<label for="foto-campo">{t(locale, 'vec.picker.foto.campo')}</label>
			<input
				id="foto-campo"
				type="file"
				name="foto"
				accept="image/png,image/jpeg,image/webp"
				required
				aria-invalid={fotoErro ? 'true' : undefined}
				aria-describedby={fotoErro ? 'foto-erro foto-axuda' : 'foto-axuda'}
			/>
			<p class="axuda" id="foto-axuda">{t(locale, 'vec.picker.foto.axuda')}</p>
			{#if fotoErro}
				<p class="erro" id="foto-erro" role="alert">
					{t(locale, `vec.picker.foto.erro.${fotoErro}` as MessageKey)}
				</p>
			{/if}
			<Button type="submit">{t(locale, 'vec.picker.foto.gardar')}</Button>
		</form>
		{#if avatar.hasPhoto}
			<form method="POST" action="?/quitarFoto{query}" class="quitar">
				{@render campos()}
				<button type="submit">{t(locale, 'vec.picker.foto.quitar')}</button>
				<small>{t(locale, 'vec.picker.foto.quitar_nota')}</small>
			</form>
		{/if}
		<p class="fina">{t(locale, 'vec.picker.foto.privada')}</p>
		{#if extra}
			<div class="botons">{@render extra()}</div>
		{/if}
	{/if}
</div>

<style>
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 14px;
	}

	.prev {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.bub {
		position: relative;
		padding: 10px 14px;
		border: 2px solid var(--txt);
		border-radius: 16px;
		font-weight: 800;
		line-height: 1.2;
	}

	.tabs {
		display: flex;
		border-bottom: 2px solid var(--ceo);
	}

	.tabs a {
		flex: 1;
		display: grid;
		place-items: center;
		min-height: var(--toque);
		margin-bottom: -2px;
		border-bottom: 4px solid transparent;
		font-weight: 800;
		color: var(--texto-suave);
		text-decoration: none;
	}

	.tabs a[aria-current='page'] {
		border-color: var(--txt);
		color: var(--txt);
	}

	.grella {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 10px;
		justify-items: center;
	}

	.pc {
		position: relative;
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border: 3px solid transparent;
		border-radius: 50%;
		cursor: pointer;
	}

	.pc:has(input:checked) {
		border-color: var(--txt);
	}

	.pc:has(input:focus-visible),
	.inicial:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.tick {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: none;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 2px solid var(--branco);
		border-radius: 50%;
		background: var(--herba);
		color: var(--branco);
		font-size: 13px;
		font-weight: 900;
	}

	.pc:has(input:checked) .tick {
		display: grid;
	}

	.inicial {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		margin-top: 12px;
		padding: 8px 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
		font-weight: 800;
		cursor: pointer;
	}

	.inicial:has(input:checked) {
		border-color: var(--txt);
	}

	.inicial input {
		width: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--txt);
	}

	.inicial small {
		display: block;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.letra {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--txt);
		color: var(--branco);
		font-size: 19px;
		font-weight: 900;
	}

	.botons {
		display: grid;
		gap: 8px;
		margin-top: 14px;
	}

	.foto {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8px;
	}

	.foto label {
		font-weight: 800;
	}

	/* O control de ficheiro ten un ancho mínimo propio: sen isto desborda a 375 px. */
	.foto input[type='file'] {
		width: 100%;
		min-width: 0;
		min-height: var(--toque);
		padding: 8px;
		border: 2px dashed var(--txt);
		border-radius: var(--radio);
		font-weight: 600;
	}

	.foto input[aria-invalid='true'] {
		border-color: var(--perigo);
	}

	.axuda,
	.fina {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.erro {
		font-weight: 800;
		color: var(--perigo);
	}

	.quitar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
	}

	.quitar button {
		min-height: var(--toque);
		padding: 0;
		border: 0;
		background: none;
		font-weight: 800;
		color: var(--perigo);
		text-decoration: underline;
		cursor: pointer;
	}

	.quitar small {
		font-weight: 600;
		color: var(--texto-suave);
	}
</style>
