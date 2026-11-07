<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/index.js';
	import { localDateOfInstant } from '#lib/ui/booking-text.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';
	import { formatTime } from '#lib/ui/format.js';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { noticeText, postedDay } from '#lib/ui/notice-text.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}`);

	/** «Hoxe · 16:30» / «Xov 22 · 09:10» / «9 de outubro · 09:10»: cando se publicou o aviso. */
	function posted(at: Date): string {
		return `${postedDay(locale, localDateOfInstant(at), data.today)} · ${formatTime(at)}`;
	}

	// Un bando por concello, na orde que trae o servidor (o actual primeiro).
	const bandos = $derived.by(() => {
		const out: {
			municipality: (typeof data.notices)[number]['municipality'];
			notices: typeof data.notices;
		}[] = [];
		for (const n of data.notices) {
			const group = out.find((g) => g.municipality.slug === n.municipality.slug);
			if (group) group.notices.push(n);
			else out.push({ municipality: n.municipality, notices: [n] });
		}
		return out;
	});
</script>

<svelte:head>
	<title>{t(locale, 'vec.avisos.titulo')} · {data.municipality.name}</title>
</svelte:head>

<main class="avisos">
	<h1>{t(locale, 'vec.avisos.titulo')}</h1>

	<h2 class="k">{t(locale, 'vec.avisos.concello')}</h2>
	{#if data.notices.length === 0}
		<p class="baleiro">{t(locale, 'vec.avisos.baleiro_concello')}</p>
	{:else}
		{#each bandos as g (g.municipality.slug)}
			<div class="bando">
				<div class="bh">
					<Escudo municipality={g.municipality} width={16} />
					{t(locale, 'vec.avisos.bando_de', { concello: g.municipality.name })}
				</div>
				<ul>
					{#each g.notices as n (n.id)}
						<li class="it">
							<div>
								<b>{n.title}</b>
								{n.body}
								<small>{posted(n.startsAt)}</small>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}

	{#if data.needsLogin}
		<div class="fala">
			<Mascot kind="sala" color="#9AA1A0" size={72} />
			<Bubble>{t(locale, 'vec.avisos.entra')}</Bubble>
		</div>
		<div class="botons">
			<Button href="{base}/entrar?redirectTo={encodeURIComponent(`${base}/avisos`)}"
				>{t(locale, 'vec.avisos.entrar')}</Button
			>
		</div>
	{:else}
		<div class="cab">
			<h2 class="k">{t(locale, 'vec.avisos.para_ti')}</h2>
			{#if data.unread > 0}
				<form method="POST" action="?/lertodo" use:enhance>
					<button class="todo" type="submit">{t(locale, 'vec.avisos.lertodo')}</button>
				</form>
			{/if}
		</div>
		{#if data.personal.length === 0}
			<div class="fala" data-tour="avisos">
				<Mascot kind="sala" color="#9AA1A0" size={72} />
				<Bubble>{t(locale, 'vec.avisos.baleiro_persoal')}</Bubble>
			</div>
		{:else}
			<ul class="persoais" data-tour="avisos" aria-label={t(locale, 'vec.avisos.persoal_etiqueta')}>
				{#each data.personal as p (p.id)}
					{@const text = noticeText(locale, p.kind, p.params)}
					<li class="aviso" class:novo={p.unread}>
						<div class="corpo">
							{#if p.unread}<span class="marca">{t(locale, 'vec.avisos.sen_ler')}</span>{/if}
							{#if p.href}
								<a href={p.href}>{text}</a>
							{:else}
								<span>{text}</span>
							{/if}
							<small>{posted(p.createdAt)}</small>
						</div>
						{#if p.unread}
							<form method="POST" action="?/ler" use:enhance>
								<input type="hidden" name="id" value={p.id} />
								<button
									class="ler"
									type="submit"
									aria-label={t(locale, 'vec.avisos.ler_etiqueta', { aviso: text })}
									>{t(locale, 'vec.avisos.ler')}</button
								>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</main>

<style>
	.avisos {
		padding: 12px 16px 24px;
	}

	h1 {
		margin-bottom: 8px;
		font-size: 28px;
	}

	.k {
		margin: 20px 0 8px;
		font-size: 19px;
		font-weight: 900;
		letter-spacing: -0.01em;
	}

	.baleiro {
		margin: 0;
		font-weight: 600;
		color: var(--texto-suave);
	}

	/* El bando: un panel con cabecera oscura, como el tablón del concello. */
	.bando {
		border: 2px solid var(--txt);
		border-radius: 14px;
		overflow: hidden;
	}

	.bando + .bando {
		margin-top: 12px;
	}

	.bh {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--txt);
		color: #fff;
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.bando ul,
	.persoais {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.it {
		display: flex;
		gap: 10px;
		padding: 11px 12px;
		border-top: 2px solid var(--ceo);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
	}

	.it:first-child {
		border-top: 0;
	}

	.it b {
		display: block;
		font-weight: 900;
	}

	small {
		display: block;
		margin-top: 2px;
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.cab {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
	}

	.todo {
		min-height: var(--toque);
		padding: 0 4px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 14px;
		font-weight: 800;
		color: var(--txt);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.persoais {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8px;
	}

	/* Un aviso sin leer lleva la barra amarilla y su etiqueta en texto; leído, queda en gris. */
	.aviso {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		padding: 10px 12px;
		border-left: 6px solid var(--liña);
		border-radius: 4px 12px 12px 4px;
		background: var(--ceo);
		font-size: 15px;
		font-weight: 600;
		line-height: 1.3;
	}

	.aviso.novo {
		border-left-color: var(--foco);
		background: #fff8d6;
		font-weight: 800;
	}

	.corpo {
		display: flex;
		flex: 1 1 200px;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}

	.corpo a {
		display: inline-block;
		min-height: 24px;
		color: var(--txt);
		text-underline-offset: 3px;
	}

	.marca {
		margin-bottom: 3px;
		padding: 2px 6px;
		border-radius: 6px;
		background: var(--txt);
		color: #fff;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.ler {
		min-width: var(--toque);
		min-height: var(--toque);
		padding: 0 6px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 14px;
		font-weight: 800;
		color: var(--txt);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.fala {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 12px;
	}

	.botons {
		display: grid;
		max-width: 420px;
		margin-top: 20px;
	}
</style>
