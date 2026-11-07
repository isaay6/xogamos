<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/index.js';
	import AvatarPicker from '#lib/ui/AvatarPicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import NoticePrefsFields from '#lib/ui/NoticePrefsFields.svelte';
	import type { PageProps } from './$types';

	// Benvida en tres pasos (mockups-v1/rexistro.html, opción 2): un paso por pantalla.
	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const redirectTo = $derived(data.redirectTo);
	const hidden = $derived(redirectTo ? { redirectTo } : ({} as Record<string, string>));
	// A resposta dun erro píntase na URL da acción: o paso, a pestana e `redirectTo` van tamén
	// na súa consulta para que a páxina siga no mesmo sitio (con e sen JS).
	const query = $derived(
		`&paso=${data.paso}${data.tab ? `&tab=${data.tab}` : ''}` +
			(redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : '')
	);
	const firstName = $derived(data.name.trim().split(/\s+/)[0] ?? data.name);

	/** Ligazón a un paso conservando `redirectTo`. */
	function step(paso: number, extra = '') {
		const q = redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : '';
		return `/benvida?paso=${paso}${extra}${q}`;
	}

	const f = $derived(
		(form ?? {}) as {
			erro?: 'NINGUN';
			avatarErro?: boolean;
			foto?: 'PHOTO_TOO_LARGE' | 'UNSUPPORTED_IMAGE';
			issues?: { email?: boolean; consentimento?: boolean };
			values?: { avisos?: 'app' | 'correo'; email?: string; consentimento?: boolean };
			empadroadoErro?: boolean;
			empadroado?: string;
		}
	);
	// Tras un erro, o empadroamento enviado (se é dun concello da lista); se non, «non».
	const padron = $derived(
		(data.followed ?? []).some((m) => m.id === f.empadroado) ? f.empadroado : ''
	);
</script>

<svelte:head>
	<title>{t(locale, 'vec.benvida.titulo')}</title>
</svelte:head>

{#snippet campos()}
	{#if redirectTo}
		<input type="hidden" name="redirectTo" value={redirectTo} />
	{/if}
{/snippet}

<main id="contido" class="benvida">
	<div class="prog" aria-hidden="true">
		{#each [1, 2, 3] as n (n)}
			<i class:on={n <= data.paso}></i>
		{/each}
	</div>
	<p class="paso">{t(locale, 'vec.benvida.paso', { n: data.paso })}</p>

	{#if data.municipalities}
		<p class="ola">{t(locale, 'vec.benvida.ola', { nome: firstName })}</p>
		<h1>{t(locale, 'vec.benvida.concellos.titulo')}</h1>
		<p class="texto">{t(locale, 'vec.benvida.concellos.texto')}</p>
		<form method="POST" action="?/concellos{query}" use:enhance>
			{@render campos()}
			<fieldset aria-describedby={f.erro ? 'erro-concellos' : undefined}>
				<legend class="sr">{t(locale, 'vec.benvida.concellos.legend')}</legend>
				{#each data.municipalities as m (m.id)}
					<label class="conc">
						<Escudo municipality={m} width={28} />
						<span class="nome">
							<b>{m.name}</b>
							<small>{m.province}</small>
						</span>
						<input type="checkbox" name="concello" value={m.id} checked={m.checked} />
					</label>
				{/each}
			</fieldset>
			{#if f.erro}
				<p class="erro" id="erro-concellos" role="alert">
					{t(locale, 'vec.benvida.concellos.erro')}
				</p>
			{/if}
			<div class="botons">
				<Button type="submit">{t(locale, 'vec.benvida.seguinte')}</Button>
			</div>
		</form>
	{:else if data.tab && data.avatar}
		<h1>{t(locale, 'vec.benvida.avatar.titulo')}</h1>
		<p class="texto">{t(locale, 'vec.benvida.avatar.texto')}</p>
		<AvatarPicker
			{locale}
			name={data.name}
			userId={data.userId}
			avatar={data.avatar}
			tab={data.tab}
			tabHref={(tab) => step(2, `&tab=${tab}`)}
			{hidden}
			{query}
			submitLabel={t(locale, 'vec.benvida.seguinte')}
			avatarErro={f.avatarErro ?? false}
			fotoErro={f.foto ?? null}
		>
			{#snippet actions()}
				<Button variant="out" href={step(3)}>
					{t(locale, data.tab === 'foto' ? 'vec.benvida.seguinte' : 'vec.benvida.saltar')}
				</Button>
				<a class="atras" href={step(1)}>{t(locale, 'vec.benvida.atras')}</a>
			{/snippet}
		</AvatarPicker>
	{:else}
		<h1>{t(locale, 'vec.benvida.avisos.titulo')}</h1>
		<p class="texto">{t(locale, 'vec.benvida.avisos.texto')}</p>
		<form method="POST" action="?/rematar{query}" use:enhance>
			{@render campos()}
			<NoticePrefsFields
				{locale}
				avisos={f.values?.avisos ?? (data.notifyEmail ? 'correo' : 'app')}
				email={f.values?.email ?? data.email ?? ''}
				consent={f.values ? (f.values.consentimento ?? false) : (data.notifyEmail ?? false)}
				issues={f.issues}
			/>

			<fieldset class="padron" aria-describedby="nota-padron">
				<legend>
					{t(locale, 'vec.benvida.empadroado.legend')}
					<span class="tag">{t(locale, 'vec.pendente')}</span>
				</legend>
				{#each data.followed ?? [] as m (m.id)}
					<label class="opcion">
						<input type="radio" name="empadroado" value={m.id} checked={padron === m.id} />
						<span>{t(locale, 'vec.benvida.empadroado.en', { concello: m.name })}</span>
					</label>
				{/each}
				<label class="opcion">
					<input type="radio" name="empadroado" value="" checked={padron === ''} />
					<span>{t(locale, 'vec.benvida.empadroado.non')}</span>
				</label>
				<p class="nota" id="nota-padron">{t(locale, 'vec.benvida.empadroado.nota')}</p>
				{#if f.empadroadoErro}
					<p class="erro" role="alert">{t(locale, 'vec.benvida.empadroado.erro')}</p>
				{/if}
			</fieldset>

			<div class="botons">
				<Button type="submit">{t(locale, 'vec.benvida.rematar')}</Button>
				<a class="atras" href={step(2)}>{t(locale, 'vec.benvida.atras')}</a>
			</div>
		</form>
	{/if}
</main>

<style>
	.benvida {
		max-width: 480px;
		margin: 0 auto;
		padding: 20px 16px 32px;
	}

	.prog {
		display: flex;
		gap: 6px;
	}

	.prog i {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: var(--ceo);
	}

	.prog i.on {
		background: var(--txt);
	}

	.paso {
		margin-top: 8px;
		font-size: 14px;
		font-weight: 800;
		color: var(--texto-suave);
	}

	.ola {
		margin-top: 14px;
		font-weight: 800;
		color: var(--texto-suave);
	}

	h1 {
		margin-top: 6px;
		font-size: 30px;
	}

	.texto {
		margin: 8px 0 14px;
		font-weight: 600;
		line-height: 1.35;
	}

	form {
		display: grid;
		gap: 14px;
	}

	fieldset {
		display: grid;
		gap: 8px;
	}

	.conc,
	.opcion {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 8px 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
		cursor: pointer;
	}

	.conc:has(input:checked),
	.opcion:has(input:checked) {
		border-color: var(--txt);
	}

	.nome {
		flex: 1;
		min-width: 0;
	}

	.nome b {
		display: block;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.nome small {
		font-weight: 600;
		color: var(--texto-suave);
	}

	.opcion {
		font-weight: 800;
	}

	input[type='checkbox'],
	input[type='radio'] {
		flex: none;
		width: 24px;
		height: 24px;
		margin: 0;
		accent-color: var(--txt);
	}

	.padron legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		margin-bottom: 6px;
		font-weight: 900;
	}

	.tag {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--foco);
		font-size: 13px;
		font-weight: 800;
	}

	.nota {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.erro {
		font-weight: 800;
		color: var(--perigo);
	}

	.botons {
		display: grid;
		gap: 8px;
		margin-top: 6px;
	}

	.atras {
		display: grid;
		place-items: center;
		min-height: var(--toque);
		font-weight: 800;
	}
</style>
