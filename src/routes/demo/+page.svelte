<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Avatar from '#lib/ui/Avatar.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const home = $derived(data.home);
	// O selector de idioma é o de sempre (o do concello), que volve aquí.
	const idioma = $derived(`/${home?.slug ?? 'viana-do-bolo'}/idioma`);

	/** Cor da tira de cada perfil: a da súa zona na aplicación. */
	const ACCENT: Record<string, string> = {
		vecina: 'var(--pista)',
		conserxe: 'var(--auga)',
		concello: 'var(--herba)',
		deputacion: 'var(--parquet)'
	};

	const k = (key: string, part = '') => `demo.perfil.${key}${part}` as MessageKey;
</script>

<svelte:head>
	<title>{t(locale, 'demo.titulo')}</title>
</svelte:head>

<main class="demo" id="contido">
	<header>
		<p class="k">{t(locale, 'demo.k')}</p>
		<h1>{t(locale, 'demo.pregunta')}</h1>
		<p class="intro">{t(locale, 'demo.intro')}</p>
	</header>

	<ul class="perfis" aria-label={t(locale, 'demo.perfis')}>
		{#each data.profiles as p (p.key)}
			<li style:--acento={ACCENT[p.key]}>
				<form method="POST" action="?/{p.key}">
					<button type="submit">
						<span class="figura" aria-hidden="true">
							{#if p.key === 'vecina'}
								<Avatar
									avatar={{ key: p.avatarKey, hasPhoto: false }}
									userId=""
									name={p.name}
									{locale}
									size={64}
									decorative
								/>
							{:else if p.key === 'conserxe'}
								<Mascot kind="sala" color="var(--auga)" size={64} animated={false} />
							{:else if p.key === 'concello' && home}
								<Escudo municipality={home} width={46} />
							{:else}
								<svg width="46" height="56" viewBox="0 0 40 48"><use href="#escudo" /></svg>
							{/if}
						</span>
						<span class="tx">
							<b class="rol">{t(locale, k(p.key))}</b>
							<span class="quen"
								>{t(locale, k(p.key, '.de'), { nome: p.name, concello: p.municipality ?? '' })}</span
							>
							<span class="ve">{t(locale, k(p.key, '.ve'))}</span>
						</span>
						<span class="frecha" aria-hidden="true">→</span>
					</button>
				</form>
			</li>
		{/each}
	</ul>

	<section class="outras-persoas" aria-labelledby="outras-persoas-titulo">
		<h2 id="outras-persoas-titulo">{t(locale, 'demo.persoas.titulo')}</h2>
		<p>{t(locale, 'demo.persoas.axuda')}</p>
		<ul>
			{#each data.quickPeople as person (person.subject)}
				<li>
					<form method="POST" action="?/{person.key}">
						<button type="submit">{person.name}</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>

	<footer>
		<a class="outra" href="/{home?.slug ?? 'viana-do-bolo'}/entrar?redirectTo=%2F{home?.slug ??
				'viana-do-bolo'}">{t(locale, 'demo.outra')}</a
		>
		<form method="POST" action={idioma} class="lingua">
			<input type="hidden" name="redirectTo" value="/demo" />
			<span>{t(locale, 'staff.idioma')}</span>
			<button type="submit" name="lingua" value="gl" lang="gl" aria-pressed={locale === 'gl'}
				>{t(locale, 'staff.idioma.gl')}</button
			>
			<button type="submit" name="lingua" value="es" lang="es" aria-pressed={locale === 'es'}
				>{t(locale, 'staff.idioma.es')}</button
			>
		</form>
	</footer>
</main>

<style>
	.demo {
		max-width: 880px;
		margin: 0 auto;
		padding: 40px 16px 56px;
	}

	header {
		max-width: 620px;
		margin-bottom: 28px;
	}

	.k {
		margin-bottom: 8px;
		color: var(--texto-suave);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	h1 {
		font-size: clamp(32px, 7vw, 48px);
	}

	.intro {
		margin-top: 12px;
		color: var(--texto-suave);
		font-size: 17px;
	}

	.perfis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	form {
		height: 100%;
	}

	.perfis button {
		position: relative;
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		height: 100%;
		min-height: 132px;
		padding: 20px 18px 20px 24px;
		overflow: hidden;
		border: 2px solid var(--liña);
		border-radius: 18px;
		background: var(--branco);
		text-align: left;
		cursor: pointer;
	}

	/* A tira da cor da zona, á esquerda */
	.perfis button::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 8px;
		background: var(--acento);
	}

	.perfis button:hover {
		border-color: var(--txt);
	}

	.perfis button:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 3px;
	}

	.figura {
		display: grid;
		flex: none;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--ceo);
	}

	.tx {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.rol {
		font-size: 22px;
		font-weight: 900;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.quen {
		color: var(--texto-suave);
		font-size: 15px;
		font-weight: 800;
	}

	.ve {
		font-size: 15px;
	}

	.frecha {
		flex: none;
		font-size: 22px;
		font-weight: 900;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 24px;
		margin-top: 24px;
	}

	.outras-persoas {
		margin-top: 26px;
		padding-top: 20px;
		border-top: 2px solid var(--liña);
	}

	.outras-persoas h2,
	.outras-persoas p {
		margin: 0;
	}

	.outras-persoas p {
		margin-top: 4px;
		color: var(--texto-suave);
	}

	.outras-persoas ul {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}

	.outras-persoas form,
	.outras-persoas button {
		height: auto;
	}

	.outras-persoas button {
		min-height: var(--toque);
		padding: 9px 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
		background: var(--ceo);
		color: var(--txt);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.outra {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		font-weight: 800;
		color: var(--txt);
	}

	.lingua {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		color: var(--texto-suave);
		font-size: 14px;
		font-weight: 600;
	}

	.lingua button {
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--liña);
		border-radius: 10px;
		background: var(--branco);
		font-weight: 800;
		cursor: pointer;
	}

	.lingua button[aria-pressed='true'] {
		border-color: var(--txt);
		background: var(--txt);
		color: var(--branco);
	}

	@media (max-width: 640px) {
		.demo {
			padding-top: 24px;
		}

		.perfis {
			grid-template-columns: 1fr;
		}

		.perfis button {
			min-height: 112px;
			padding: 16px 14px 16px 20px;
			gap: 12px;
		}

		.figura {
			width: 60px;
			height: 60px;
		}

		.rol {
			font-size: 20px;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.perfis button {
			transition:
				transform 0.15s ease,
				border-color 0.15s ease;
		}

		.perfis button:hover {
			transform: translateY(-2px);
		}

		.perfis button:hover .frecha {
			transform: translateX(3px);
		}

		.frecha {
			transition: transform 0.15s ease;
		}
	}
</style>
