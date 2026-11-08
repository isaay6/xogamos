<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { t, type Locale, type MessageKey } from '#lib/i18n/index.js';
	import { MASCOT_FAMILY, MASCOTS, type Mascot as MascotKey } from '#lib/mascots.js';
	import Bubble from '#lib/ui/Bubble.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { formatEuros } from '#lib/ui/format.js';
	import { durationLabel, howText, parseEuros, pricesLabel, weekSummary } from '../text';
	import { filledRanges, weekFromValues } from './hours';
	import PaintWeek from './PaintWeek.svelte';
	import Preview from './Preview.svelte';

	type Card = {
		key: string;
		mascot: string;
		bookingMode: 'slot' | 'unit' | 'capacity' | 'day';
		slotMinutes: number;
		units: number;
		capacity: number;
	};

	let {
		locale,
		municipalityName,
		listHref,
		paso,
		values,
		errors,
		issues = [],
		buildings,
		templates
	}: {
		locale: Locale;
		municipalityName: string;
		listHref: string;
		paso: number;
		values: Record<string, string>;
		errors: Record<string, string>;
		issues?: { message: string }[];
		buildings: { location: string; address: string }[];
		templates: Card[];
	} = $props();

	const STEPS = [0, 1, 2, 3, 4, 5, 6];
	const MODES = ['slot', 'unit', 'capacity', 'day'] as const;
	/** Campos que viajan siempre (ocultos fuera de su paso). */
	const KNOWN = [
		'modelo',
		'aplicado',
		'mascota',
		'nome',
		'edificio',
		'lugar',
		'enderezo',
		'modo',
		'unidades',
		'aforo',
		'minutos',
		'accesible',
		'prezoRes',
		'prezoNon',
		'prezoSocial'
	];
	const SHOWN: Record<number, string[]> = {
		0: ['modelo'],
		1: ['mascota', 'nome'],
		2: ['edificio', 'lugar', 'enderezo'],
		3: ['modo', 'unidades', 'aforo', 'minutos', 'accesible'],
		5: ['prezoRes', 'prezoNon', 'prezoSocial']
	};

	// El estado se copia una vez: la página vuelve a montar el asistente con cada respuesta.
	// svelte-ignore state_referenced_locally
	let v = $state<Record<string, string>>({ ...values });
	// svelte-ignore state_referenced_locally
	const step = paso;

	let js = $state(false);
	onMount(() => (js = true));

	const isHour = (k: string) => /^h-\d-\d-(opens|closes)$/.test(k);
	const hidden = $derived(
		[...KNOWN, ...Object.keys(v).filter(isHour)].filter(
			(k) => !(SHOWN[step] ?? []).includes(k) && !(step === 4 && isHour(k))
		)
	);

	const err = (name: string) => errors[name] ?? '';
	const errText = (name: string) => t(locale, `adm.asis.erro.${err(name)}` as MessageKey);
	const described = (name: string, help?: string) =>
		[help, err(name) ? `fe-${name}` : ''].filter(Boolean).join(' ') || undefined;
	const hasErrors = $derived(Object.keys(errors).length > 0 || issues.length > 0);

	const sportName = (m: string) =>
		(MASCOTS as readonly string[]).includes(m) ? t(locale, `adm.mascota.${m}` as MessageKey) : '';
	const modelName = (key: string) => (key ? t(locale, `adm.asis.modelo.${key}` as MessageKey) : '');

	// Deportes: primero los de la familia del elegido; el resto, en «Ver os 21».
	// svelte-ignore state_referenced_locally
	const chosen = (MASCOTS as readonly string[]).includes(values.mascota ?? '')
		? (values.mascota as MascotKey)
		: 'padel';
	const ordered = [
		chosen,
		...MASCOTS.filter((m) => m !== chosen && MASCOT_FAMILY[m] === MASCOT_FAMILY[chosen]),
		...MASCOTS.filter((m) => m !== chosen && MASCOT_FAMILY[m] !== MASCOT_FAMILY[chosen])
	];
	const featured = ordered.slice(0, 6);
	const rest = ordered.slice(6);

	// Edificios: el que coincide con lo escrito sale marcado.
	// svelte-ignore state_referenced_locally
	if (step === 2 && !v.edificio) {
		const i = buildings.findIndex(
			(b) => b.location === (v.lugar ?? '').trim() && b.address === (v.enderezo ?? '').trim()
		);
		v.edificio = i >= 0 ? String(i) : v.lugar ? 'novo' : '';
	}

	function pickBuilding(i: number) {
		v.lugar = buildings[i].location;
		v.enderezo = buildings[i].address;
	}

	function bump(name: string, delta: number, min: number, max: number) {
		const n = Number(v[name]) || 0;
		v[name] = String(Math.min(max, Math.max(min, n + delta)));
	}

	const minutes = $derived(Number(v.minutos) || 0);
	const units = $derived(Math.max(0, Math.min(8, Number(v.unidades) || 0)));

	const cardText = (c: Card) =>
		`${howText(locale, c, c.mascot)} · ${durationLabel(locale, c.slotMinutes)}`;

	const summaryRows = $derived.by(() => {
		const mode = MODES.find((m) => m === v.modo) ?? 'slot';
		const pistas = [
			t(locale, `adm.asis.modo.${mode}` as MessageKey),
			mode === 'unit' ? t(locale, 'adm.asis.resumo.unidades', { n: v.unidades ?? '' }) : '',
			mode === 'capacity' ? t(locale, 'adm.asis.resumo.aforo', { n: v.aforo ?? '' }) : '',
			minutes ? durationLabel(locale, minutes) : '',
			v.accesible === 'on' ? t(locale, 'adm.asis.resumo.accesible') : ''
		];
		const res = parseEuros(v.prezoRes ?? '') ?? 0;
		const non = parseEuros(v.prezoNon ?? '') ?? 0;
		const social = v.prezoSocial ? parseEuros(v.prezoSocial) : null;
		return [
			v.modelo === 'cero' ? t(locale, 'adm.asis.resumo.desde_cero') : modelName(v.modelo ?? ''),
			[sportName(v.mascota ?? ''), v.nome].filter(Boolean).join(' · '),
			[v.lugar, v.enderezo].filter(Boolean).join(' · '),
			pistas.filter(Boolean).join(' · '),
			weekSummary(locale, filledRanges(weekFromValues(v))),
			[
				pricesLabel(locale, res, non),
				social === null
					? ''
					: t(locale, 'adm.asis.resumo.social', { prezo: formatEuros(social, locale) })
			]
				.filter(Boolean)
				.join(' · ')
		];
	});

	const examplePrice = $derived(parseEuros(v.prezoRes ?? ''));
	const withPreview = [1, 2, 3, 5].includes(step);
</script>

{#snippet fieldError(name: string)}
	{#if err(name)}<p class="erro" id="fe-{name}">{errText(name)}</p>{/if}
{/snippet}

{#snippet counter(
	name: string,
	label: string,
	help: string,
	unit: string,
	delta: number,
	min: number,
	max: number
)}
	<div class="cnt">
		<div>
			<label for="f-{name}">{label}</label>
			<small id="fh-{name}">{help}</small>
		</div>
		<div class="ctl">
			{#if js}
				<button
					type="button"
					aria-label={t(locale, 'adm.asis.baixar', { campo: label })}
					onclick={() => bump(name, -delta, min, max)}>−</button
				>
			{/if}
			<input
				id="f-{name}"
				{name}
				type="number"
				inputmode="numeric"
				{min}
				{max}
				step={delta}
				value={v[name] ?? ''}
				oninput={(e) => (v[name] = e.currentTarget.value)}
				aria-invalid={err(name) ? 'true' : undefined}
				aria-describedby={described(name, `fh-${name}`)}
			/>
			{#if js}
				<button
					type="button"
					aria-label={t(locale, 'adm.asis.subir', { campo: label })}
					onclick={() => bump(name, delta, min, max)}>+</button
				>
			{/if}
		</div>
		<span class="u">{unit}</span>
		{@render fieldError(name)}
	</div>
{/snippet}

<form
	method="POST"
	action="?/paso"
	class="wz"
	class:ancho={!withPreview}
	use:enhance={() =>
		async ({ update }) => {
			await update({ reset: false });
			await tick();
			window.scrollTo({ top: 0 });
			document.getElementById('asis-h')?.focus();
		}}
>
	<input type="hidden" name="paso" value={step} />
	{#each hidden as name (name)}
		<input type="hidden" {name} value={v[name] ?? ''} />
	{/each}

	<div class="wzc">
		<p class="k">{t(locale, 'adm.asis.k', { n: step })}</p>
		<h1 id="asis-h" tabindex="-1">{t(locale, `adm.asis.pregunta.${step}` as MessageKey)}</h1>

		{#if hasErrors}
			<div class="caixa-erro" role="alert">
				<p>{t(locale, 'adm.asis.erro.resumo')}</p>
				{#if issues.length}
					<ul>
						{#each issues as i, n (n)}<li>{i.message}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}

		{#if step === 0}
			<p class="hint">{t(locale, 'adm.asis.axuda.0')}</p>
			<fieldset>
				<legend class="sr">{t(locale, 'adm.asis.paso.0')}</legend>
				<div class="tg" data-tour="asistente">
					{#each templates as c (c.key)}
						<label class="tc" class:on={v.modelo === c.key}>
							<input type="radio" name="modelo" value={c.key} bind:group={v.modelo} class="sr" />
							<Mascot kind={c.mascot} size={56} animated={false} />
							<b>{modelName(c.key)}</b>
							<small>{cardText(c)}</small>
						</label>
					{/each}
					<label class="tc zero" class:on={v.modelo === 'cero'}>
						<input type="radio" name="modelo" value="cero" bind:group={v.modelo} class="sr" />
						<span class="plus" aria-hidden="true">+</span>
						<b>{t(locale, 'adm.asis.modelo.cero')}</b>
						<small>{t(locale, 'adm.asis.modelo.cero_axuda')}</small>
					</label>
				</div>
			</fieldset>
			{@render fieldError('modelo')}
		{:else if step === 1}
			<fieldset aria-describedby={described('mascota')}>
				<legend class="lbl">{t(locale, 'adm.asis.deporte')}</legend>
				<div class="spk">
					{#each featured as m (m)}
						<label class:on={v.mascota === m}>
							<input type="radio" name="mascota" value={m} bind:group={v.mascota} class="sr" />
							<Mascot kind={m} size={28} animated={false} />{sportName(m)}
						</label>
					{/each}
				</div>
				<details class="mais" open={rest.includes(v.mascota as MascotKey)}>
					<summary>{t(locale, 'adm.asis.deporte.mais')}</summary>
					<div class="spk">
						{#each rest as m (m)}
							<label class:on={v.mascota === m}>
								<input type="radio" name="mascota" value={m} bind:group={v.mascota} class="sr" />
								<Mascot kind={m} size={28} animated={false} />{sportName(m)}
							</label>
						{/each}
					</div>
				</details>
			</fieldset>
			{@render fieldError('mascota')}
			<div class="campo">
				<label class="lbl" for="f-nome">{t(locale, 'adm.asis.nome')}</label>
				<input
					id="f-nome"
					name="nome"
					maxlength="120"
					bind:value={v.nome}
					aria-invalid={err('nome') ? 'true' : undefined}
					aria-describedby={described('nome', 'fh-nome')}
				/>
				<small class="hint" id="fh-nome">{t(locale, 'adm.asis.nome_axuda')}</small>
				{@render fieldError('nome')}
			</div>
		{:else if step === 2}
			<div class="two2">
				<fieldset>
					<legend class="lbl">{t(locale, 'adm.asis.edificio')}</legend>
					<p class="hint">{t(locale, 'adm.asis.edificio_axuda')}</p>
					{#each buildings as b, i (b.location)}
						<label class="opt" class:on={v.edificio === String(i)}>
							<input
								type="radio"
								name="edificio"
								value={String(i)}
								bind:group={v.edificio}
								onchange={() => pickBuilding(i)}
								class="sr"
							/>
							<b>{b.location}</b>
							{#if b.address}<small>{b.address}</small>{/if}
						</label>
					{/each}
					<label class="opt add" class:on={v.edificio === 'novo'}>
						<input type="radio" name="edificio" value="novo" bind:group={v.edificio} class="sr" />
						<b>{t(locale, 'adm.asis.edificio.outro')}</b>
					</label>
				</fieldset>
				<div>
					<div class="campo">
						<label class="lbl" for="f-lugar">{t(locale, 'adm.asis.edificio')}</label>
						<input
							id="f-lugar"
							name="lugar"
							maxlength="200"
							bind:value={v.lugar}
							oninput={() => (v.edificio = 'novo')}
							aria-invalid={err('lugar') ? 'true' : undefined}
							aria-describedby={described('lugar')}
						/>
						{@render fieldError('lugar')}
					</div>
					<div class="campo">
						<label class="lbl" for="f-enderezo">{t(locale, 'adm.asis.enderezo')}</label>
						<input
							id="f-enderezo"
							name="enderezo"
							maxlength="200"
							bind:value={v.enderezo}
							oninput={() => (v.edificio = 'novo')}
							aria-invalid={err('enderezo') ? 'true' : undefined}
							aria-describedby={described('enderezo')}
						/>
						{@render fieldError('enderezo')}
					</div>
				</div>
			</div>
		{:else if step === 3}
			<fieldset>
				<legend class="lbl">{t(locale, 'adm.asis.modo')}</legend>
				<div class="modos">
					{#each MODES as m (m)}
						<label class="opt" class:on={v.modo === m}>
							<input type="radio" name="modo" value={m} bind:group={v.modo} class="sr" />
							<b>{t(locale, `adm.asis.modo.${m}` as MessageKey)}</b>
							<small>{t(locale, `adm.asis.modo.${m}_axuda` as MessageKey)}</small>
						</label>
					{/each}
				</div>
			</fieldset>
			{@render fieldError('modo')}
			{#if v.modo === 'unit'}
				{@render counter(
					'unidades',
					t(locale, 'adm.asis.unidades'),
					t(locale, 'adm.asis.unidades_axuda'),
					'',
					1,
					2,
					999
				)}
			{:else}
				<input type="hidden" name="unidades" value={v.unidades ?? ''} />
			{/if}
			{#if v.modo === 'capacity'}
				{@render counter(
					'aforo',
					t(locale, 'adm.asis.aforo'),
					t(locale, 'adm.asis.aforo_axuda'),
					'',
					1,
					2,
					9999
				)}
			{:else}
				<input type="hidden" name="aforo" value={v.aforo ?? ''} />
			{/if}
			{@render counter(
				'minutos',
				t(locale, 'adm.asis.minutos'),
				t(locale, 'adm.asis.minutos_axuda'),
				t(locale, 'adm.asis.minutos_u'),
				15,
				15,
				1440
			)}
			<p class="lbl como">{t(locale, 'adm.asis.como_e')}</p>
			<label class="chip" class:on={v.accesible === 'on'}>
				<input
					type="checkbox"
					name="accesible"
					value="on"
					checked={v.accesible === 'on'}
					onchange={(e) => (v.accesible = e.currentTarget.checked ? 'on' : '')}
				/>
				{t(locale, 'adm.fac.accesible')}
			</label>
			{#if v.modo === 'unit' && units > 0}
				<div class="pista-row" aria-hidden="true">
					{#each Array.from({ length: units }, (_, i) => i + 1) as n (n)}
						<span class="court">{t(locale, 'adm.asis.pista_n', { n })}</span>
					{/each}
				</div>
			{/if}
		{:else if step === 4}
			<PaintWeek values={v} {errors} {locale} />
			{@render fieldError('horario')}
		{:else if step === 5}
			<div class="two2 prezos">
				<div>
					<p class="lbl">
						{t(locale, 'adm.asis.prezos_por', {
							duracion: minutes ? durationLabel(locale, minutes) : ''
						})}
					</p>
					{#each [['prezoRes', 'adm.asis.prezo_res', 'adm.asis.prezo_res_axuda'], ['prezoNon', 'adm.asis.prezo_non', 'adm.asis.prezo_non_axuda'], ['prezoSocial', 'adm.asis.prezo_social', 'adm.asis.prezo_social_axuda']] as [name, label, help] (name)}
						<div class="pr">
							<div>
								<label for="f-{name}">{t(locale, label as MessageKey)}</label>
								<small id="fh-{name}"
									>{t(locale, help as MessageKey, { concello: municipalityName })}</small
								>
							</div>
							<span class="eur">
								<input
									id="f-{name}"
									{name}
									inputmode="decimal"
									autocomplete="off"
									bind:value={v[name]}
									aria-invalid={err(name) ? 'true' : undefined}
									aria-describedby={described(name, `fh-${name}`)}
								/>
								<span aria-hidden="true">€</span>
							</span>
							{@render fieldError(name)}
						</div>
					{/each}
				</div>
				<div>
					<div class="card">
						<p class="lbl">{t(locale, 'adm.asis.exemplo')}</p>
						<p class="exemplo">
							{t(locale, 'adm.asis.exemplo_texto', {
								duracion: minutes ? durationLabel(locale, minutes) : '',
								prezo: examplePrice === null ? '—' : formatEuros(examplePrice, locale)
							})}
						</p>
					</div>
					<div class="fala">
						<Mascot kind={v.mascota || 'sala'} size={48} />
						<Bubble>{t(locale, 'adm.asis.gratis')}</Bubble>
					</div>
				</div>
			</div>
		{:else}
			<dl class="sum">
				{#each summaryRows as row, k (k)}
					<div class="sumr">
						<dt>{t(locale, `adm.asis.paso.${k}` as MessageKey)}</dt>
						<dd>{row}</dd>
						<dd>
							<button
								type="submit"
								class="link"
								name="ir"
								value={String(k)}
								formnovalidate
								aria-label={t(locale, 'adm.asis.cambiar_a', {
									paso: t(locale, `adm.asis.paso.${k}` as MessageKey)
								})}>{t(locale, 'adm.asis.cambiar')}</button
							>
						</dd>
					</div>
				{/each}
			</dl>
			<div class="fala">
				<Mascot kind={v.mascota || 'sala'} size={56} />
				<Bubble><b>{t(locale, 'adm.asis.bub_crear')}</b></Bubble>
			</div>
		{/if}

		<!-- «Seguinte» va primero en el HTML: es el botón que usa Intro -->
		<div class="wzf">
			{#if step < 6}
				<button type="submit" class="b2" name="ir" value={String(step + 1)}
					>{t(locale, 'adm.asis.seguinte')}</button
				>
			{:else}
				<button type="submit" class="b2 ok" formaction="?/crear"
					>{t(locale, 'adm.asis.crear')}</button
				>
			{/if}
			{#if step > 0}
				<button type="submit" class="b2 out" name="ir" value={String(step - 1)} formnovalidate
					>{t(locale, 'adm.asis.atras')}</button
				>
			{:else}
				<a class="b2 out" href={listHref}>{t(locale, 'adm.asis.cancelar')}</a>
			{/if}
		</div>
	</div>

	{#if withPreview}
		<div class="pvw"><Preview values={v} {locale} /></div>
	{/if}

	<nav class="wzl" aria-label={t(locale, 'adm.asis.pasos')}>
		<ol class="stp">
			{#each STEPS as k (k)}
				<li>
					{#if k < step}
						<button
							type="submit"
							class="si done"
							name="ir"
							value={String(k)}
							formnovalidate
							aria-label={t(locale, 'adm.asis.paso_feito', {
								paso: t(locale, `adm.asis.paso.${k}` as MessageKey)
							})}
						>
							<span aria-hidden="true">✓</span>{t(locale, `adm.asis.paso.${k}` as MessageKey)}
						</button>
					{:else}
						<span class="si" class:on={k === step} aria-current={k === step ? 'step' : undefined}>
							<span aria-hidden="true">{k}</span>{t(locale, `adm.asis.paso.${k}` as MessageKey)}
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
</form>

<style>
	.wz {
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr) 240px;
		grid-template-areas: 'steps main pv';
		gap: 24px;
		align-items: start;
	}

	.wz.ancho {
		grid-template-columns: 190px minmax(0, 1fr);
		grid-template-areas: 'steps main';
	}

	.wzl {
		grid-area: steps;
		padding-right: 14px;
		border-right: 2px solid var(--ceo);
	}

	.wzc {
		grid-area: main;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 520px;
	}

	.pvw {
		grid-area: pv;
	}

	.stp {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.si {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		min-height: var(--toque);
		padding: 7px 6px;
		border: 0;
		border-radius: 9px;
		background: none;
		color: var(--gris);
		font: inherit;
		font-size: 15px;
		font-weight: 800;
		text-align: left;
	}

	.si > span {
		display: grid;
		flex: none;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 7px;
		background: var(--ceo);
		color: var(--gris);
		font-size: 13px;
		font-weight: 900;
	}

	.si.done {
		color: var(--txt);
		cursor: pointer;
	}

	.si.done > span {
		background: var(--herba);
		color: var(--branco);
	}

	.si.on {
		background: var(--foco);
		color: var(--txt);
	}

	.si.on > span {
		background: var(--txt);
		color: var(--branco);
	}

	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--gris);
	}

	h1 {
		margin: 2px 0 12px;
		font-size: 30px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	h1:focus {
		outline: none;
	}

	.hint {
		display: block;
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--texto-suave);
		line-height: 1.4;
	}

	.lbl {
		display: block;
		margin: 0 0 6px;
		padding: 0;
		font-size: 12px;
		font-weight: 800;
		color: var(--gris);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}

	label:has(> .sr:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.caixa-erro {
		margin: 0 0 14px;
		padding: 10px 14px;
		border: 2px solid var(--perigo);
		border-radius: var(--radio);
		color: var(--perigo);
		font-weight: 800;
	}

	.caixa-erro p,
	.caixa-erro ul {
		margin: 0;
	}

	.erro {
		margin: 4px 0 0;
		font-size: 14px;
		font-weight: 800;
		color: var(--perigo);
	}

	/* Paso 0: modelos */
	.tg {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.tc {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 12px 10px;
		border: 3px solid transparent;
		border-radius: 16px;
		background: var(--ceo);
		text-align: center;
		cursor: pointer;
	}

	.tc b {
		font-size: 15px;
		font-weight: 900;
	}

	.tc small {
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.tc.on {
		border-color: var(--txt);
		background: var(--branco);
		box-shadow: 0 0 0 4px var(--foco);
	}

	.tc.zero {
		border: 2px dashed var(--apagado);
		background: var(--branco);
	}

	.tc.zero.on {
		border: 3px solid var(--txt);
	}

	.plus {
		display: grid;
		place-items: center;
		width: 54px;
		height: 54px;
		margin-bottom: 2px;
		border: 3px dashed var(--apagado);
		border-radius: 14px;
		font-size: 30px;
		font-weight: 900;
		color: var(--gris);
	}

	/* Paso 1: deportes */
	.spk {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.spk label {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: var(--toque);
		padding: 6px 12px 6px 8px;
		border-radius: 12px;
		background: var(--ceo);
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
	}

	.spk label.on {
		background: var(--txt);
		color: var(--branco);
	}

	.mais {
		margin: 8px 0 0;
	}

	.mais summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--liña);
		border-radius: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.mais[open] summary {
		margin-bottom: 8px;
	}

	.campo {
		display: flex;
		flex-direction: column;
		margin-top: 16px;
	}

	.campo .hint {
		margin: 6px 0 0;
	}

	input:not([type='hidden']):not([type='radio']):not([type='checkbox']) {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 700;
	}

	input[aria-invalid='true'] {
		border-color: var(--perigo) !important;
	}

	/* Paso 2: edificios */
	.two2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}

	.two2 .campo:first-child {
		margin-top: 0;
	}

	.opt {
		position: relative;
		display: block;
		margin-bottom: 6px;
		padding: 8px 12px;
		min-height: var(--toque);
		border: 2px solid var(--liña);
		border-radius: 12px;
		cursor: pointer;
	}

	.opt b {
		display: block;
		font-size: 15px;
		font-weight: 900;
	}

	.opt small {
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.opt.on {
		border-color: var(--txt);
		box-shadow: 0 0 0 3px var(--foco);
	}

	.opt.add {
		border-style: dashed;
		color: var(--texto-suave);
	}

	/* Paso 3: pistas e aforo */
	.modos {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0 8px;
	}

	.cnt {
		display: grid;
		grid-template-columns: 1fr auto 80px;
		align-items: center;
		gap: 4px 12px;
		padding: 10px 0;
		border-bottom: 2px solid var(--ceo);
	}

	.cnt label {
		display: block;
		font-size: 16px;
		font-weight: 900;
	}

	.cnt small {
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.cnt .erro {
		grid-column: 1 / -1;
	}

	.ctl {
		display: flex;
		align-items: center;
		overflow: hidden;
		border: 2px solid var(--txt);
		border-radius: 12px;
	}

	.ctl button {
		width: 44px;
		height: 44px;
		border: 0;
		background: var(--ceo);
		color: var(--txt);
		font: inherit;
		font-size: 22px;
		font-weight: 900;
		cursor: pointer;
	}

	.ctl input {
		width: 80px;
		border: 0 !important;
		border-radius: 0 !important;
		text-align: center;
		font-size: 20px !important;
		font-weight: 900 !important;
	}

	.u {
		font-size: 14px;
		font-weight: 700;
		color: var(--gris);
	}

	.como {
		margin-top: 14px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--toque);
		padding: 0 14px;
		border-radius: 22px;
		background: var(--ceo);
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
	}

	.chip.on {
		background: var(--txt);
		color: var(--branco);
	}

	.chip input {
		width: 18px;
		height: 18px;
		accent-color: var(--herba);
	}

	.pista-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}

	.court {
		padding: 8px 14px 10px;
		border-radius: 12px 12px 26px 26px;
		background: var(--txt);
		color: var(--branco);
		font-size: 14px;
		font-weight: 900;
	}

	/* Paso 5: prezos */
	.two2.prezos {
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
	}

	.pr {
		display: grid;
		grid-template-columns: 1fr 120px;
		align-items: center;
		gap: 4px 10px;
		padding: 8px 0;
		border-bottom: 2px solid var(--ceo);
	}

	.pr label {
		display: block;
		font-size: 16px;
		font-weight: 900;
	}

	.pr small {
		font-size: 13px;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.pr .erro {
		grid-column: 1 / -1;
	}

	.eur {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 18px;
		font-weight: 900;
	}

	.eur input {
		width: 100%;
		text-align: right;
		font-size: 18px !important;
	}

	.card {
		margin-top: 22px;
		padding: 14px 16px;
		border-radius: 14px;
		background: var(--ceo);
	}

	.exemplo {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.5;
	}

	.fala {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 14px;
	}

	.fala :global(.bub) {
		margin: 0;
	}

	/* Paso 6: resumo */
	.sum {
		margin: 0;
	}

	.sumr {
		display: grid;
		grid-template-columns: 150px 1fr auto;
		align-items: baseline;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 2px solid var(--ceo);
		font-size: 15px;
	}

	.sumr dt {
		font-size: 14px;
		font-weight: 700;
		color: var(--gris);
	}

	.sumr dd {
		margin: 0;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.link {
		min-height: var(--toque);
		padding: 0 6px;
		border: 0;
		background: none;
		color: var(--txt);
		font: inherit;
		font-size: 14px;
		font-weight: 800;
		text-decoration: underline;
		cursor: pointer;
	}

	/* Pie: «Seguinte» siempre abajo a la derecha */
	.wzf {
		display: flex;
		flex-direction: row-reverse;
		justify-content: space-between;
		gap: 10px;
		margin-top: auto;
		padding-top: 14px;
		border-top: 2px solid var(--ceo);
	}

	.wzc > .wzf {
		margin-top: 24px;
	}

	.b2 {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		padding: 0 20px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--txt);
		color: var(--branco);
		font: inherit;
		font-size: 16px;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
	}

	.b2.out {
		background: var(--branco);
		color: var(--txt);
	}

	.b2.ok {
		border-color: #1f7a3a;
		background: #1f7a3a;
	}

	@media (max-width: 1100px) {
		.wz,
		.wz.ancho {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'steps' 'main' 'pv';
		}

		.wzl {
			padding: 0 0 10px;
			border-right: 0;
			border-bottom: 2px solid var(--ceo);
		}

		.stp {
			flex-direction: row;
			flex-wrap: wrap;
		}

		.si {
			width: auto;
		}

		.tg {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.two2.prezos,
		.two2,
		.modos {
			grid-template-columns: 1fr;
		}

		.sumr {
			grid-template-columns: 1fr auto;
		}

		.sumr dt {
			grid-column: 1 / -1;
		}
	}
</style>
