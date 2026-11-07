<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!-- Buscador único do mostrador (busca-dni.html, opción 2): nome, teléfono ou DNI enteiro. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import Avatar from '#lib/ui/Avatar.svelte';
	import Button from '#lib/ui/Button.svelte';
	import { dniHint } from '#lib/ui/dni-hint.js';
	import type { Busca } from './busca';

	let {
		locale,
		busca,
		selectedId = null,
		resetHref,
		registerHref,
		confirmAction,
		personHref = (profileId: string) => `?persoa=${profileId}`
	}: {
		locale: Locale;
		busca: Busca | null | undefined;
		/** Persoa xa escollida (resaltada na lista). */
		selectedId?: string | null;
		/** «Non, buscar outra vez»: a mesma páxina sen nada. */
		resetHref: string;
		/** «Rexistrar persoa nova». */
		registerHref: string;
		/** Acción que crea o perfil de quen só o ten noutro concello (`nova?/confirmarDni`). */
		confirmAction: string;
		/** URL para escoller unha persoa atopada. */
		personHref?: (profileId: string) => string;
	} = $props();

	// O que hai na caixa: tras atopar a alguén polo DNI o servidor devolve '' e a caixa queda baleira.
	let q = $derived(busca?.q ?? '');
	const hint = $derived(dniHint(q));

	const tarifa = (c: { isResident: boolean; socialTariff: string | null }) =>
		[
			t(locale, c.isResident ? 'cons.panel.empadroada' : 'cons.panel.nonempadroada'),
			...(c.socialTariff ? [t(locale, `cons.tarifa.${c.socialTariff}` as MessageKey)] : [])
		].join(' · ');
</script>

<form
	method="POST"
	action="?/buscar"
	class="busca"
	role="search"
	use:enhance={() =>
		async ({ update }) => {
			await update({ reset: false });
		}}
>
	<label for="q" class="k">{t(locale, 'cons.nova.busca')}</label>
	<div class="fila">
		<div class="caixa" class:dni={hint}>
			{#if hint}<span class="modo" aria-hidden="true">{t(locale, 'cons.busca.modoDni')}</span>{/if}
			<input
				id="q"
				name="q"
				type="search"
				bind:value={q}
				autocomplete="off"
				spellcheck="false"
				aria-describedby="q-hint"
			/>
		</div>
		<button type="submit" class="btn-s">{t(locale, 'cons.nova.buscar')}</button>
	</div>
	<p id="q-hint" class="hint" class:mal={hint && !hint.ok} aria-live="polite">
		{#if hint}{t(locale, hint.ok ? 'cons.busca.letraOk' : 'cons.busca.letraMal')}{/if}
	</p>
</form>

{#if busca?.mode === 'dni'}
	{@const c = busca.card}
	<div class="carne" role="status" aria-labelledby="carne-h">
		<p class="ok">✓ {t(locale, 'cons.busca.atopado')}</p>
		<div class="cab">
			<Avatar avatar={c.avatar} userId={c.userId} name={c.displayName} size={56} {locale} decorative />
			<h3 id="carne-h">{c.displayName}</h3>
		</div>
		<dl>
			<div>
				<dt>{t(locale, 'cons.busca.tarifa')}</dt>
				<dd>{tarifa(c)}</dd>
			</div>
			{#if c.noShowCount !== null}
				<div>
					<dt>{t(locale, 'cons.busca.faltas')}</dt>
					<dd>{c.noShowCount}</dd>
				</div>
			{/if}
			<div>
				<dt>{t(locale, 'cons.busca.dni')}</dt>
				<dd class="mono">{c.dniMasked}</dd>
			</div>
		</dl>
		<p class="check">
			{c.phoneEnd
				? t(locale, 'cons.busca.telefono', { fin: c.phoneEnd })
				: t(locale, 'cons.busca.nome')}
		</p>
		{#if c.profileId === null}
			<p class="k">{t(locale, 'cons.busca.fora')}</p>
		{/if}
		<div class="acts">
			{#if c.profileId}
				<Button href={personHref(c.profileId)}>{t(locale, 'cons.busca.si')}</Button>
			{:else if c.sinal}
				<form method="POST" action={confirmAction}>
					<input type="hidden" name="usuario" value={c.userId} />
					<input type="hidden" name="sinal" value={c.sinal} />
					<Button type="submit">{t(locale, 'cons.busca.si')}</Button>
				</form>
			{/if}
			<Button href={resetHref} variant="out">{t(locale, 'cons.busca.non')}</Button>
		</div>
	</div>
{:else if busca?.mode === 'sen-dni'}
	<div class="sen">
		{#if busca.letra}
			<div class="aviso" role="alert">
				<p>{t(locale, 'cons.busca.letra', { letra: busca.letra, escrita: busca.escrita })}</p>
				{#if busca.suggestions.length > 0}
					<p>{t(locale, 'cons.busca.troco')}</p>
					<form method="POST" action="?/buscar" class="sug" use:enhance>
						{#each busca.suggestions as s (s)}
							<button type="submit" name="q" value={s} class="btn-s mono">{s}</button>
						{/each}
					</form>
				{/if}
			</div>
		{/if}
		<h3>{t(locale, 'cons.busca.ninguen')}</h3>
		<ul class="saidas">
			<li>
				<a href="#q"
					><b>{t(locale, 'cons.busca.repasar')}</b>
					<span>{t(locale, 'cons.busca.repasar.texto')}</span></a
				>
			</li>
			<li>
				<a href={registerHref} class:main={!busca.letra}
					><b>{t(locale, 'cons.busca.rexistrar')}</b>
					<span>{t(locale, 'cons.busca.rexistrar.texto')}</span></a
				>
			</li>
			<li>
				<a href="#q"
					><b>{t(locale, 'cons.busca.outra')}</b>
					<span>{t(locale, 'cons.busca.outra.texto')}</span></a
				>
			</li>
		</ul>
	</div>
{:else if busca?.mode === 'texto' && busca.q}
	{#if busca.people.length === 0}
		<p class="k">{t(locale, 'cons.nova.ninguen')}</p>
	{:else}
		<ul class="people">
			{#each busca.people as p (p.profileId)}
				<li class:on={selectedId === p.profileId}>
					<a href={personHref(p.profileId)}>
						<span
							><b>{p.displayName}</b>{#if p.phone}<span class="k"> · {p.phone}</span>{/if}</span
						>
						<span class="esc">{t(locale, 'cons.nova.escoller')}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	.busca {
		display: grid;
		gap: 6px;
	}
	.k {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	.fila {
		display: flex;
		gap: 8px;
	}
	.caixa {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding-left: 6px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
	}
	.caixa:focus-within {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	.modo {
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--foco);
		color: var(--txt);
		font-size: 13px;
		font-weight: 900;
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: var(--toque);
		padding: 0 8px;
		border: 0;
		background: transparent;
		font: inherit;
		outline: none;
	}
	.dni input {
		font-weight: 800;
		letter-spacing: 0.06em;
	}
	.hint {
		min-height: 1.2em;
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: #1f7a3b;
	}
	.hint.mal {
		color: var(--perigo);
	}
	.btn-s {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--toque);
		padding: 0 14px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
	}
	.mono {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.06em;
	}
	.carne {
		display: grid;
		gap: 10px;
		padding: 14px;
		border: 2px solid var(--herba);
		border-radius: var(--radio);
		background: #eaf6ee;
	}
	.carne p {
		margin: 0;
	}
	.ok {
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #1f7a3b;
	}
	.cab {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h3 {
		margin: 0;
		font-size: 22px;
		font-weight: 900;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 8px;
		margin: 0;
		padding: 10px;
		border-radius: 10px;
		background: var(--branco);
	}
	dt {
		font-size: 12px;
		font-weight: 700;
		color: var(--gris);
	}
	dd {
		margin: 0;
		font-weight: 800;
	}
	.check {
		font-weight: 700;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sen {
		display: grid;
		gap: 10px;
	}
	.aviso {
		display: grid;
		gap: 6px;
		padding: 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: #fff6cc;
	}
	.aviso p {
		margin: 0;
		font-weight: 700;
	}
	.sug {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.saidas {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.saidas a {
		display: grid;
		gap: 2px;
		min-height: var(--toque);
		padding: 8px 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		color: var(--txt);
		text-decoration: none;
	}
	.saidas a span {
		font-size: 13px;
		color: var(--gris);
	}
	.saidas a.main {
		background: var(--txt);
		color: var(--branco);
	}
	.saidas a.main span {
		color: var(--branco);
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.people a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		padding: 0 10px;
		border-radius: 10px;
		color: var(--txt);
		text-decoration: none;
	}
	.people li.on a,
	.people a:hover {
		background: var(--ceo);
	}
	.esc {
		font-weight: 800;
		text-decoration: underline;
	}
	a:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
