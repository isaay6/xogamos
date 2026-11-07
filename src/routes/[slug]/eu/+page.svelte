<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { installPrompt, isIos } from '#lib/pwa/install.js';
	import { longDate } from '#lib/ui/booking-text.js';
	import Avatar from '#lib/ui/Avatar.svelte';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Lamps from '#lib/ui/Lamps.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);

	const TARIFA: Record<'xove' | 'maior' | 'familia', MessageKey> = {
		xove: 'vec.eu.tarifa.xove',
		maior: 'vec.eu.tarifa.maior',
		familia: 'vec.eu.tarifa.familia'
	};
	const base = $derived(`/${data.municipality.slug}`);
	const summary = $derived(data.summary);
	const lit = $derived(Math.min(summary?.streak ?? 0, 4));
	const streakText = $derived(
		!summary || summary.streak === 0
			? t(locale, 'vec.eu.racha.zero')
			: summary.streak < 4
				? summary.streak === 3
					? t(locale, 'vec.eu.racha.case', { n: summary.streak })
					: t(locale, 'vec.eu.racha.pouca', { n: summary.streak, plural: summary.streak === 1 ? '' : 's', faltan: 4 - summary.streak })
				: t(locale, 'vec.eu.racha.torre', { n: summary.streak })
	);

	const roles = $derived(data.roles ?? []);
	const docs = ['aviso-legal', 'privacidade', 'normas'] as const;
	const ios = isIos();

	async function install() {
		const prompt = $installPrompt;
		if (!prompt) return;
		await prompt.prompt();
		installPrompt.set(null);
	}

	function clearPersonalPages() {
		navigator.serviceWorker?.controller?.postMessage({ type: 'clear-personal-pages' });
		sessionStorage.removeItem('reservas-pwa-user');
	}
</script>

<svelte:head>
	<title>{t(locale, 'vec.eu.titulo')} · {data.municipality.name}</title>
</svelte:head>

{#snippet idioma()}
	<li class="idioma">
		<span>{t(locale, 'vec.eu.idioma')}</span>
		<form method="POST" action="{base}/idioma">
			<input type="hidden" name="redirectTo" value="{base}/eu" />
			<button
				type="submit"
				name="lingua"
				value="gl"
				lang="gl"
				aria-pressed={locale === 'gl'}>{t(locale, 'vec.eu.idioma.gl')}</button
			>
			<button
				type="submit"
				name="lingua"
				value="es"
				lang="es"
				aria-pressed={locale === 'es'}>{t(locale, 'vec.eu.idioma.es')}</button
			>
		</form>
	</li>
{/snippet}

{#snippet legais()}
	<li class="legais">
		<span>{t(locale, 'vec.eu.legais')}</span>
		<span class="docs">
			{#each docs as doc (doc)}
				<a href="{base}/legal/{doc}">{t(locale, `vec.legal.${doc}`)}</a>
			{/each}
		</span>
	</li>
{/snippet}

<main class="eu">
	<h1 class="visually-hidden">{t(locale, 'vec.eu.titulo')}</h1>

	{#if !summary}
		<div class="fala">
			<Mascot kind="sala" color="var(--granito)" size={72} />
			<Bubble>{t(locale, 'vec.eu.entra')}</Bubble>
		</div>
		<div class="botons">
			<Button href="{base}/entrar?redirectTo={encodeURIComponent(`${base}/eu`)}"
				>{t(locale, 'vec.eu.entrar')}</Button
			>
		</div>
		<ul class="menu">
			{@render idioma()}
			{@render legais()}
		</ul>
	{:else}
		<section class="perfil" data-tour="eu-perfil">
			<Avatar
				avatar={{ key: summary.avatarKey, hasPhoto: summary.hasAvatarPhoto }}
				userId={data.userId ?? ''}
				name={summary.displayName}
				{locale}
				size={64}
			/>
			<div>
				<h2>{summary.displayName}</h2>
				<!-- A declaración non é verificación: queda pendente e non cambia o prezo. -->
				<p class="padron">
					{summary.isResident
						? t(locale, 'vec.eu.empadroado')
						: summary.residencyDeclaredAt
							? t(locale, 'vec.eu.pendente')
							: t(locale, 'vec.eu.non_empadroado')}
				</p>
				{#if !summary.isResident}
					<p class="nota">
						{t(
							locale,
							summary.residencyDeclaredAt ? 'vec.eu.prezo_pendente' : 'vec.eu.prezo_non_empadroado'
						)}
					</p>
				{/if}
				{#if summary.socialTariff}
					<p class="nota">
						{t(locale, 'vec.eu.tarifa', {
							tarifa: t(locale, TARIFA[summary.socialTariff])
						})}
					</p>
				{/if}
				<a class="cambiar" href="{base}/eu/perfil">{t(locale, 'vec.eu.cambiar_avatar')}</a>
			</div>
		</section>

		{#if summary.penaltyUntil}
			<p class="aviso" role="status">
				{t(locale, 'vec.eu.penalizacion', { data: longDate(locale, summary.penaltyUntil) })}
			</p>
		{/if}

		<section class="racha" data-tour="eu-racha">
			<div class="focos">
				<Lamps {lit} label={t(locale, 'vec.eu.racha.etiqueta', { lit })} />
				<p>{streakText}</p>
			</div>
			<!-- Que conta e que non: funciona sen JavaScript -->
			<details>
				<summary>{t(locale, 'vec.eu.racha.que')}</summary>
				<p>{t(locale, 'vec.eu.racha.explica')}</p>
				<p>{t(locale, 'vec.eu.racha.torre_explica')}</p>
			</details>
		</section>

		<section class="cifras">
			<div class="cifra">
				<b>{summary.bookingsThisYear}</b>
				<span>{t(
						locale,
						summary.bookingsThisYear === 1 ? 'vec.eu.reservas_ano.un' : 'vec.eu.reservas_ano'
					)}</span>
			</div>
			{#if data.favourite}
				<div class="cifra">
					<Mascot kind={data.favourite.mascot} color={data.favourite.color} size={44} />
					<b>{locale === 'es' ? data.favourite.nameEs : data.favourite.nameGl}</b>
					<span>{t(locale, 'vec.eu.favorito')}</span>
				</div>
			{/if}
		</section>

		<ul class="menu">
			<li><a href="{base}/eu/historial" data-tour="eu-historial">{t(locale, 'vec.eu.historial')}</a></li>
			<li><a href="{base}/eu/monedero">{t(locale, 'vec.monedero.titulo')}</a></li>
			<li><a href="{base}/eu/concellos">{t(locale, 'vec.eu.concellos')}</a></li>
			<li><a href="{base}/solicitudes">{t(locale, 'vec.sol.titulo')}</a></li>
			{#each data.clubs as club (club.id)}
				<li><a href="{base}/club/{club.id}">{t(locale, 'vec.club.titulo')}: {club.name}</a></li>
			{/each}
			<li><a href="{base}/eu/perfil">{t(locale, 'vec.eu.perfil')}</a></li>
			<li><a href="{base}/eu/perfil#accesibilidade">{t(locale, 'vec.eu.accesibilidade')}</a></li>
			<li><a href="{base}/eu/avisos">{t(locale, 'vec.eu.avisos')}</a></li>
			<li><a href="{base}/eu/datos">{t(locale, 'vec.eu.datos')}</a></li>
			{#if $installPrompt}
				<li data-tour="instalar-app">
					<button type="button" class="instalar" onclick={install}>{t(locale, 'vec.eu.instalar')}</button>
				</li>
			{:else if ios || data.demo}
				<li data-tour="instalar-app" class="instalar-axuda">{t(locale, 'vec.eu.instalar.ios')}</li>
			{/if}
			{#if roles.includes('conserxe') || roles.includes('admin')}
				<li><a href="{base}/conserxeria">{t(locale, 'vec.eu.conserxeria')}</a></li>
			{/if}
			{#if roles.includes('admin')}
				<li><a href="{base}/admin">{t(locale, 'vec.eu.admin')}</a></li>
			{/if}
			{#if data.isDeputacion}
				<li><a href="/deputacion">{t(locale, 'vec.eu.deputacion')}</a></li>
			{/if}
			{@render idioma()}
			{@render legais()}
			<li>
				<form method="POST" action="/auth/logout" onsubmit={clearPersonalPages}>
					<input type="hidden" name="to" value={base} />
					<button type="submit" class="sair">{t(locale, 'vec.eu.sair')}</button>
				</form>
			</li>
		</ul>
	{/if}
</main>

<style>
	.eu {
		padding: 12px 16px 24px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.perfil {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 8px;
	}

	.perfil > div {
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: 24px;
		overflow-wrap: anywhere;
	}

	.padron {
		margin: 2px 0 0;
		font-weight: 600;
		color: var(--texto-suave);
		overflow-wrap: anywhere;
	}

	.nota {
		margin: 2px 0 0;
		font-size: 14px;
		color: var(--texto-suave);
	}

	.cambiar {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-size: 15px;
		font-weight: 800;
	}

	.instalar, .instalar-axuda {
		min-height: var(--toque);
		font: inherit;
		font-weight: 800;
	}

	.instalar { color: var(--txt); cursor: pointer; }
	.instalar-axuda { display: flex; align-items: center; color: var(--texto-suave); }

	.aviso {
		margin: 14px 0 0;
		padding: 10px 12px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		font-weight: 800;
		color: var(--perigo);
	}

	.racha {
		margin-top: 16px;
		padding: 12px;
		border-radius: var(--radio);
		background: var(--ceo);
	}

	.focos {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}

	.focos p {
		margin: 0;
		font-weight: 800;
	}

	details {
		margin-top: 8px;
	}

	summary {
		display: flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	details p {
		margin: 0 0 6px;
		font-weight: 600;
		line-height: 1.35;
	}

	.cifras {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 10px;
		margin-top: 12px;
	}

	.cifra {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
	}

	.cifra b {
		font-size: 24px;
		font-weight: 900;
	}

	.cifra span {
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.menu {
		margin: 18px 0 0;
		padding: 0;
		list-style: none;
		border-top: 2px solid var(--ceo);
	}

	.menu > li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 56px;
		border-bottom: 2px solid var(--ceo);
		font-weight: 800;
	}

	.menu a {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: inherit;
	}

	.menu > li > a {
		flex: 1;
	}

	.idioma form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.idioma button {
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 14px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		font: inherit;
		font-weight: 800;
		color: var(--txt);
		cursor: pointer;
	}

	.idioma button[aria-pressed='true'] {
		background: var(--txt);
		color: #fff;
	}

	.docs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-size: 14px;
	}

	.sair {
		min-height: var(--toque);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 800;
		color: var(--perigo);
		text-decoration: underline;
		cursor: pointer;
	}

	.fala {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 40px;
	}

	.botons {
		display: grid;
		max-width: 420px;
		margin-top: 20px;
	}
</style>
