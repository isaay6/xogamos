<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Escudo from '#lib/ui/Escudo.svelte';

	type Values = { id: string; title: string; body: string; from: string; to: string };

	let {
		initial,
		locale,
		municipality,
		titleMax,
		bodyMax,
		error = false,
		base
	}: {
		initial: Values;
		locale: Locale;
		municipality: {
			slug: string;
			name: string;
			primaryColor: string;
			hasLogo: boolean;
			logoVersion: number;
		};
		titleMax: number;
		bodyMax: number;
		error?: boolean;
		/** Ruta de la página (para «Deixar de editar»). */
		base: string;
	} = $props();

	// El formulario arranca con `initial`; la página lo recrea (`{#key}`) si cambian los datos.
	// svelte-ignore state_referenced_locally
	let v = $state<Values>({ ...initial });

	const dateOf = (d: string) => {
		const [y, m, day] = d.split('-');
		return y && m && day ? `${day}/${m}/${y}` : '';
	};
</script>

<div class="compor">
	<form method="POST" action="?/gardar" class="campos">
		<h2>{t(locale, v.id ? 'adm.av.editar' : 'adm.av.novo')}</h2>
		{#if error}
			<p class="erro" role="alert">{t(locale, 'adm.av.erro')}</p>
		{/if}
		{#if v.id}<input type="hidden" name="id" value={v.id} />{/if}
		<div class="campo">
			<label for="av-title">{t(locale, 'adm.av.campo_titulo')}</label>
			<input id="av-title" name="title" required maxlength={titleMax} bind:value={v.title} />
		</div>
		<div class="campo">
			<label for="av-body">{t(locale, 'adm.av.corpo')}</label>
			<textarea
				id="av-body"
				name="body"
				rows="5"
				maxlength={bodyMax}
				aria-describedby="av-body-axuda"
				bind:value={v.body}
			></textarea>
			<p id="av-body-axuda" class="axuda">{t(locale, 'adm.av.corpo_axuda')}</p>
		</div>
		<div class="datas">
			<div class="campo">
				<label for="av-from">{t(locale, 'adm.av.desde')}</label>
				<input id="av-from" name="from" type="date" required bind:value={v.from} />
			</div>
			<div class="campo">
				<label for="av-to">{t(locale, 'adm.av.ata')}</label>
				<input
					id="av-to"
					name="to"
					type="date"
					min={v.from || undefined}
					aria-describedby="av-to-axuda"
					bind:value={v.to}
				/>
			</div>
		</div>
		<p id="av-to-axuda" class="axuda">{t(locale, 'adm.av.ata_axuda')}</p>
		<div class="botons">
			<Button type="submit">{t(locale, v.id ? 'adm.av.gardar' : 'adm.av.publicar')}</Button>
			{#if v.id}<Button href={base} variant="out">{t(locale, 'adm.av.volver')}</Button>{/if}
		</div>
	</form>

	<section class="previa" aria-labelledby="av-previa-t">
		<h2 id="av-previa-t" class="k">{t(locale, 'adm.av.previa')}</h2>
		<!-- Mini-teléfono: el mismo bando que la pestaña «Avisos» de la vecindad -->
		<div class="mini">
			<div class="bando">
				<div class="bh">
					<Escudo {municipality} width={16} />
					{t(locale, 'vec.avisos.bando_de', { concello: municipality.name })}
				</div>
				<div class="it">
					<b>{v.title.trim() || t(locale, 'adm.av.previa_titulo')}</b>
					{v.body}
					{#if v.from}<small>{dateOf(v.from)}</small>{/if}
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.compor {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	@media (max-width: 900px) {
		.compor {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.campos {
		display: grid;
		gap: 14px;
	}

	h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 900;
	}

	.campo {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 6px;
	}

	.datas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
		gap: 12px;
	}

	label {
		font-weight: 800;
	}

	input:not([type='hidden']),
	textarea {
		min-height: var(--toque);
		padding: 8px 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	.axuda {
		margin: 0;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.erro {
		margin: 0;
		color: var(--perigo);
		font-weight: 800;
	}

	.botons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.k {
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--texto-suave);
	}

	.mini {
		max-width: min(320px, 100%);
		padding: 18px 14px 16px;
		border: 4px solid var(--txt);
		border-radius: 28px;
		background: var(--branco);
	}

	.bando {
		border: 2px solid var(--txt);
		border-radius: 14px;
		overflow: hidden;
	}

	.bh {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--ceo);
		font-weight: 800;
	}

	.it {
		padding: 10px 12px;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.it b {
		display: block;
	}

	.it small {
		display: block;
		margin-top: 4px;
		color: var(--texto-suave);
		font-weight: 600;
	}
</style>
