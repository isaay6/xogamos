<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import MascotPicker from '#lib/ui/MascotPicker.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Los tokens de color del sistema (spec §3): un clic los pone en el campo hexadecimal.
	const TOKENS = ['#F2762E', '#1AA6C8', '#2E9E4F', '#9AA1A0', '#E3B26A', '#FFD84D', '#C2372A', '#17202A'];
	const MODES = ['slot', 'unit', 'capacity', 'day'] as const;

	const base = $derived(`/${data.municipality.slug}/admin/instalacions`);
	const v = $derived(form && 'values' in form ? (form.values ?? {}) : {});
	// svelte-ignore state_referenced_locally
	let nameGl = $state(v.nameGl ?? data.type?.nameGl ?? '');
	// svelte-ignore state_referenced_locally
	let nameEs = $state(v.nameEs ?? data.type?.nameEs ?? '');
	// svelte-ignore state_referenced_locally
	let color = $state(v.color ?? data.type?.color ?? '#1AA6C8');
	// svelte-ignore state_referenced_locally
	let mode = $state<string>(v.bookingMode ?? data.type?.bookingMode ?? 'slot');
	// svelte-ignore state_referenced_locally
	let mascot = $state(v.mascot ?? data.type?.mascot ?? 'sala');
	const err = $derived(form && 'error' in form ? form.error : null);
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.tipos.titulo')} · {data.municipality.name}</title>
</svelte:head>

<form method="POST">
	<header class="mh">
		<div>
			<p class="k"><a href={base}>{t(data.locale, 'adm.tipo.k')}</a></p>
			<h1>
				{data.type
					? data.locale === 'es'
						? data.type.nameEs
						: data.type.nameGl
					: t(data.locale, 'adm.tipo.titulo_novo')}
			</h1>
		</div>
		<Button type="submit">{t(data.locale, 'adm.gardar')}</Button>
	</header>

	{#if form && 'saved' in form && form.saved}
		<p class="ok" role="status">{t(data.locale, 'adm.tipo.gardado')}</p>
	{:else if err === 'INVALID_CONFIG'}
		<div class="erro" role="alert">
			<p>{t(data.locale, 'adm.erro.INVALID_CONFIG')}</p>
			<ul>
				{#each form && 'issues' in form ? form.issues : [] as i, n (n)}<li>{i.message}</li>{/each}
			</ul>
		</div>
	{:else if err === 'INVALID' || err === 'NOT_FOUND'}
		<p class="erro" role="alert">
			{t(data.locale, err === 'INVALID' ? 'adm.erro.INVALID' : 'adm.erro.NOT_FOUND')}
		</p>
	{/if}

	<div class="campos">
		<div class="duas">
			<div class="campo">
				<label for="t-gl">{t(data.locale, 'adm.tipo.nome_gl')}</label>
				<input id="t-gl" name="nameGl" required maxlength="80" bind:value={nameGl} />
			</div>
			<div class="campo">
				<label for="t-es">{t(data.locale, 'adm.tipo.nome_es')}</label>
				<input id="t-es" name="nameEs" required maxlength="80" bind:value={nameEs} />
			</div>
		</div>

		<div class="campo">
			<span class="rotulo" id="cor-t">{t(data.locale, 'adm.tipo.cor')}</span>
			<div class="cores" role="group" aria-labelledby="cor-t">
				{#each TOKENS as c (c)}
					<button
						type="button"
						class="cor"
						class:on={color.toUpperCase() === c}
						style:background={c}
						aria-pressed={color.toUpperCase() === c}
						aria-label={t(data.locale, 'adm.tipo.cor_elixir', { cor: c })}
						onclick={() => (color = c)}
					></button>
				{/each}
				<input
					name="color"
					aria-label={t(data.locale, 'adm.tipo.cor_hex')}
					pattern="#[0-9A-Fa-f]{'{6}'}"
					required
					maxlength="7"
					bind:value={color}
				/>
			</div>
		</div>

		<fieldset class="campo">
			<legend>{t(data.locale, 'adm.tipo.modo')}</legend>
			<div class="modos">
				{#each MODES as m (m)}
					<label class="modo" class:on={mode === m}>
						<input type="radio" name="bookingMode" value={m} bind:group={mode} />
						{t(data.locale, `adm.modo.${m}`)}
					</label>
				{/each}
			</div>
		</fieldset>

		<div>
			<MascotPicker bind:value={mascot} locale={data.locale} {color} />
			<p class="axuda">{t(data.locale, 'adm.tipo.personaxe_axuda')}</p>
		</div>
	</div>
</form>

<style>
	.mh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 800;
	}

	.k a {
		color: var(--txt);
	}

	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}

	.campos {
		display: grid;
		gap: 20px;
		max-width: 760px;
	}

	.duas {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	@media (max-width: 640px) {
		.duas {
			grid-template-columns: 1fr;
		}
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	label,
	legend,
	.rotulo {
		padding: 0;
		font-weight: 800;
	}

	input:not([type='radio']) {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	.cores {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.cores input {
		width: 120px;
	}

	.cor {
		width: var(--toque);
		height: var(--toque);
		border: 2px solid var(--branco);
		border-radius: 10px;
		box-shadow: 0 0 0 2px var(--liña);
		cursor: pointer;
	}

	.cor.on {
		box-shadow: 0 0 0 4px var(--txt);
	}

	.modos {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.modo {
		position: relative;
		display: flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 14px;
		border: 2px solid var(--ceo);
		border-radius: 999px;
		background: var(--branco);
		font-weight: 700;
		cursor: pointer;
	}

	.modo.on {
		border-color: var(--txt);
		background: var(--ceo);
	}

	.modo input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.modo:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.axuda {
		margin: 6px 0 0;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.ok,
	.erro {
		margin: 0 0 14px;
		font-weight: 800;
	}

	.erro {
		color: var(--perigo);
	}

	.erro p {
		margin: 0 0 4px;
	}
</style>
