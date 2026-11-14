<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);
	const values = $derived(form?.values);

	const slugify = (s: string) =>
		s
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

	// Tras un error el formulario vuelve con lo escrito (también sin JavaScript); la dirección
	// ya cuenta como editada y no se vuelve a derivar del nombre.
	let name = $state(untrack(() => form?.values?.name ?? ''));
	let slug = $state(untrack(() => form?.values?.slug ?? ''));
	let touched = $state(untrack(() => Boolean(form?.values?.slug)));

	const slugError = $derived(
		errors.slug === 'SLUG_TAKEN' ? 'dep.erro.SLUG_TAKEN' : errors.slug ? 'dep.erro.slug' : null
	);
	const reserved = $derived((data.reserved ?? []).includes(slug));

	const ERROR_KEY = {
		name: 'dep.erro.name',
		province: 'dep.erro.province',
		primaryColor: 'dep.erro.primaryColor',
		adminName: 'dep.erro.adminName',
		provider: 'dep.erro.provider',
		subject: 'dep.erro.subject'
	} as const satisfies Record<string, MessageKey>;

	const fieldError = (f: keyof typeof ERROR_KEY | 'slug'): MessageKey | null =>
		f === 'slug' ? slugError : errors[f] ? ERROR_KEY[f] : null;
</script>

<svelte:head>
	<title>{t(locale, 'dep.novo.titulo')} · {t(locale, 'staff.deputacion')}</title>
</svelte:head>

<p class="k">{t(locale, 'dep.novo.k')}</p>
<h1>{t(locale, 'dep.novo.titulo')}</h1>
<p class="axuda">{t(locale, 'dep.novo.intro')}</p>
<p class="axuda">
	<a href="/deputacion/importar">Importar configuración / Importar configuración</a>
</p>

<form method="POST" class="datos">
	{#if Object.keys(errors).length > 0}
		<p class="erro" role="alert">{t(locale, 'dep.erro.resumo')}</p>
	{/if}

	<div class="campo" data-tour="novo-concello">
		<label for="name">{t(locale, 'dep.novo.nome')}</label>
		<input
			id="name"
			name="name"
			required
			maxlength="200"
			autocomplete="off"
			aria-invalid={errors.name ? 'true' : undefined}
			aria-describedby={errors.name ? 'name-erro' : undefined}
			bind:value={name}
			oninput={() => {
				if (!touched) slug = slugify(name);
			}}
		/>
		{#if fieldError('name')}<p class="erro" id="name-erro">{t(locale, fieldError('name')!)}</p>{/if}
	</div>

	<div class="campo">
		<label for="slug">{t(locale, 'dep.novo.slug')}</label>
		<input
			id="slug"
			name="slug"
			required
			maxlength="80"
			pattern="[a-z0-9\-]+"
			autocomplete="off"
			spellcheck="false"
			aria-invalid={slugError || reserved ? 'true' : undefined}
			aria-describedby={slugError ? 'slug-erro slug-axuda' : 'slug-axuda'}
			bind:value={slug}
			oninput={() => (touched = true)}
		/>
		<p class="axuda" id="slug-axuda">{t(locale, 'dep.novo.slug_axuda', { slug: slug || '…' })}</p>
		{#if slugError}<p class="erro" id="slug-erro">{t(locale, slugError)}</p>
		{:else if reserved}<p class="erro" id="slug-erro">{t(locale, 'dep.erro.SLUG_TAKEN')}</p>{/if}
	</div>

	<div class="campo">
		<label for="province">{t(locale, 'dep.novo.provincia')}</label>
		<select
			id="province"
			name="province"
			required
			aria-invalid={errors.province ? 'true' : undefined}
			aria-describedby={errors.province ? 'province-erro' : undefined}
		>
			{#each data.provinces as p (p)}
				<option value={p} selected={values?.province === p}>{p}</option>
			{/each}
		</select>
		{#if fieldError('province')}<p class="erro" id="province-erro">
				{t(locale, fieldError('province')!)}
			</p>{/if}
	</div>

	<div class="campo">
		<label for="primaryColor">{t(locale, 'dep.novo.cor')}</label>
		<input
			id="primaryColor"
			name="primaryColor"
			type="color"
			value={values?.primaryColor || '#17202A'}
			aria-invalid={errors.primaryColor ? 'true' : undefined}
			aria-describedby={errors.primaryColor ? 'primaryColor-erro' : undefined}
		/>
		{#if fieldError('primaryColor')}<p class="erro" id="primaryColor-erro">
				{t(locale, fieldError('primaryColor')!)}
			</p>{/if}
	</div>

	<fieldset data-tour="novo-admin">
		<legend>{t(locale, 'dep.novo.admin')}</legend>

		<div class="campo">
			<label for="adminName">{t(locale, 'dep.novo.admin_nome')}</label>
			<input
				id="adminName"
				name="adminName"
				required
				maxlength="200"
				autocomplete="off"
				value={values?.adminName ?? ''}
				aria-invalid={errors.adminName ? 'true' : undefined}
				aria-describedby={errors.adminName ? 'adminName-erro' : undefined}
			/>
			{#if fieldError('adminName')}<p class="erro" id="adminName-erro">
					{t(locale, fieldError('adminName')!)}
				</p>{/if}
		</div>

		<div class="campo">
			<label for="provider">{t(locale, 'dep.novo.proveedor')}</label>
			<select
				id="provider"
				name="provider"
				required
				aria-invalid={errors.provider ? 'true' : undefined}
				aria-describedby={errors.provider ? 'provider-erro' : undefined}
			>
				<option value="clave" selected={values?.provider !== 'chave365'}
					>{t(locale, 'dep.novo.proveedor.clave')}</option
				>
				<option value="chave365" selected={values?.provider === 'chave365'}
					>{t(locale, 'dep.novo.proveedor.chave365')}</option
				>
			</select>
			{#if fieldError('provider')}<p class="erro" id="provider-erro">
					{t(locale, fieldError('provider')!)}
				</p>{/if}
		</div>

		<div class="campo">
			<label for="subject">{t(locale, 'dep.novo.id')}</label>
			<input
				id="subject"
				name="subject"
				required
				maxlength="64"
				autocomplete="off"
				value={values?.subject ?? ''}
				aria-invalid={errors.subject ? 'true' : undefined}
				aria-describedby={errors.subject ? 'subject-erro subject-axuda' : 'subject-axuda'}
			/>
			<p class="axuda" id="subject-axuda">
				{t(locale, data.demo ? 'dep.novo.id_axuda' : 'dep.novo.id_axuda_real')}
			</p>
			{#if fieldError('subject')}<p class="erro" id="subject-erro">
					{t(locale, fieldError('subject')!)}
				</p>{/if}
		</div>
	</fieldset>

	<Button type="submit">{t(locale, 'dep.novo.crear')}</Button>
</form>

<style>
	h1 {
		margin: 0 0 6px;
		font-size: 28px;
		font-weight: 900;
	}

	.k {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--gris);
	}

	.datos {
		display: grid;
		gap: 16px;
		max-width: 520px;
		margin-top: 16px;
	}

	.campo {
		display: grid;
		gap: 6px;
	}

	label,
	legend {
		font-weight: 800;
	}

	fieldset {
		display: grid;
		gap: 16px;
		margin: 0;
		padding: 14px;
		border: 2px solid var(--ceo);
		border-radius: var(--radio);
	}

	legend {
		padding: 0 6px;
	}

	input,
	select {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
	}

	input[type='color'] {
		width: 88px;
		padding: 4px;
		cursor: pointer;
	}

	input[aria-invalid='true'],
	select[aria-invalid='true'] {
		border-color: var(--perigo);
	}

	.axuda {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.erro {
		margin: 0;
		font-weight: 800;
		color: var(--perigo);
	}

	input:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
