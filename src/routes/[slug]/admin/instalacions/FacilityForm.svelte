<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script module lang="ts">
	export type FormValues = {
		typeId: string;
		name: string;
		location: string;
		address: string;
		units: string;
		capacity: string;
		slotMinutes: string;
		priceResident: string;
		priceNonResident: string;
		/** Tarifa social en euros; '' = sin tarifa social. */
		priceSocial: string;
		accessible: boolean;
		stepFreeAccess?: 'yes' | 'no' | 'partial' | null;
		adaptedToilet?: boolean | null;
		adaptedChangingRoom?: boolean | null;
		accessibleParkingNearby?: boolean | null;
		hearingLoop?: boolean | null;
		supportContact?: string | null;
		accessibilityNotes?: string | null;
		needsOpening: boolean;
		accessInfo: string;
		accessInfoEs: string;
		rules: string;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t, type Locale } from '#lib/i18n/index.js';
	import { nounFor } from '#lib/ui/booking-text.js';
	import Button from '#lib/ui/Button.svelte';
	import FreeOptionCard from '#lib/ui/FreeOptionCard.svelte';
	import Mascot from '#lib/ui/Mascot.svelte';
	import { durationLabel, parseEuros } from './text';

	type TypeView = {
		id: string;
		nameGl: string;
		nameEs: string;
		mascot: string;
		color: string;
		bookingMode: 'slot' | 'unit' | 'capacity' | 'day';
	};

	let {
		types,
		initial,
		locale,
		id = 'fac-form',
		action,
		error = null,
		issues = [],
		submit,
		aside,
		showAccessibility = false,
		showSimpleAccessible = true
	}: {
		types: TypeView[];
		initial: FormValues;
		locale: Locale;
		id?: string;
		action?: string;
		error?: string | null;
		issues?: { path: string; message: string }[];
		/** Texto del botón de envío dentro del formulario (si la página no lo pone en su cabecera). */
		submit?: string;
		/** Bloques de la columna derecha, bajo la vista previa. */
		aside?: Snippet;
		/** La ficha detallada solo se edita una vez creada la instalación. */
		showAccessibility?: boolean;
		/** El asistente mantiene el interruptor simple; la ficha lo sustituye al editar. */
		showSimpleAccessible?: boolean;
	} = $props();

	// El formulario arranca con `initial`; la página lo recrea (`{#key}`) si cambian los datos.
	// svelte-ignore state_referenced_locally
	let v = $state<FormValues>({ ...initial });

	const type = $derived(types.find((x) => x.id === v.typeId));
	const mode = $derived(type?.bookingMode ?? 'slot');
	const typeName = (x: TypeView) => (locale === 'es' ? x.nameEs : x.nameGl);
	const durations = $derived(
		[...new Set([30, 60, 90, 120, 180, Number(v.slotMinutes) || 60])].sort((a, b) => a - b)
	);

	const option = $derived({
		facilityName: v.name.trim() || t(locale, 'adm.fac.preview_nome'),
		location: v.location.trim(),
		unitIndex: mode === 'unit' ? 0 : null,
		remainingSeats: mode === 'capacity' ? Math.max(1, Number(v.capacity) || 1) : null,
		startsAt: new Date(),
		priceResidentCents: parseEuros(v.priceResident) ?? 0,
		priceNonResidentCents: parseEuros(v.priceNonResident) ?? 0
	});
</script>

<div class="grid">
	<form {id} method="POST" {action} class="campos">
		{#if error === 'INVALID_CONFIG'}
			<div class="erro" role="alert">
				<p>{t(locale, 'adm.erro.INVALID_CONFIG')}</p>
				<ul>
					{#each issues as i, n (n)}<li>{i.message}</li>{/each}
				</ul>
			</div>
		{:else if error === 'INVALID' || error === 'NOT_FOUND'}
			<p class="erro" role="alert">
				{t(locale, error === 'INVALID' ? 'adm.erro.INVALID' : 'adm.erro.NOT_FOUND')}
			</p>
		{/if}

		<div class="campo">
			<label for="f-name">{t(locale, 'adm.fac.nome')}</label>
			<input id="f-name" name="name" required maxlength="120" bind:value={v.name} />
		</div>

		<fieldset class="campo">
			<legend>{t(locale, 'adm.fac.tipo')}</legend>
			<div class="chips">
				{#each types as x (x.id)}
					<label class="chip" class:on={v.typeId === x.id}>
						<input type="radio" name="typeId" value={x.id} bind:group={v.typeId} required />
						<Mascot kind={x.mascot} size={28} animated={false} color={x.color} />
						<span>{typeName(x)}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="campo">
			<label for="f-location">{t(locale, 'adm.fac.lugar')}</label>
			<input id="f-location" name="location" maxlength="200" bind:value={v.location} />
		</div>

		<div class="campo">
			<label for="f-address">{t(locale, 'adm.fac.enderezo')}</label>
			<input id="f-address" name="address" maxlength="200" bind:value={v.address} />
		</div>

		{#if mode === 'unit'}
			<div class="campo">
				<label for="f-units">{t(locale, 'adm.fac.unidades')}</label>
				<input
					id="f-units"
					name="units"
					type="number"
					min="2"
					max="999"
					required
					bind:value={v.units}
				/>
			</div>
		{/if}
		{#if mode === 'capacity'}
			<div class="campo">
				<label for="f-capacity">{t(locale, 'adm.fac.aforo')}</label>
				<input
					id="f-capacity"
					name="capacity"
					type="number"
					min="2"
					max="9999"
					required
					bind:value={v.capacity}
				/>
			</div>
		{/if}

		<div class="campo">
			<label for="f-slot">{t(locale, 'adm.fac.duracion')}</label>
			<select id="f-slot" name="slotMinutes" bind:value={v.slotMinutes}>
				{#each durations as d (d)}
					<option value={String(d)}>{durationLabel(locale, d)}</option>
				{/each}
			</select>
		</div>

		<div class="prezos">
			<div class="campo">
				<label for="f-res">{t(locale, 'adm.fac.prezo_res')}</label>
				<input
					id="f-res"
					name="priceResident"
					inputmode="decimal"
					required
					aria-describedby="f-prezo-axuda"
					bind:value={v.priceResident}
				/>
			</div>
			<div class="campo">
				<label for="f-non">{t(locale, 'adm.fac.prezo_non')}</label>
				<input
					id="f-non"
					name="priceNonResident"
					inputmode="decimal"
					required
					aria-describedby="f-prezo-axuda"
					bind:value={v.priceNonResident}
				/>
			</div>
		</div>
		<p id="f-prezo-axuda" class="axuda">{t(locale, 'adm.fac.prezo_axuda')}</p>

		<div class="campo social">
			<label for="f-social">{t(locale, 'adm.asis.prezo_social')}</label>
			<input
				id="f-social"
				name="priceSocial"
				inputmode="decimal"
				aria-describedby="f-social-axuda"
				bind:value={v.priceSocial}
			/>
			<p id="f-social-axuda" class="axuda">{t(locale, 'adm.asis.prezo_social_axuda')}</p>
		</div>

		{#if showSimpleAccessible}
			<label class="check">
				<input type="checkbox" name="accessible" bind:checked={v.accessible} />
				{t(locale, 'adm.fac.accesible')}
			</label>
		{/if}

		{#if showAccessibility}
			<fieldset class="accesibilidade">
				<legend>{t(locale, 'adm.acc.titulo')}</legend>
				<p class="axuda">{t(locale, 'adm.acc.axuda')}</p>
				<div class="campo">
					<label for="f-step">{t(locale, 'adm.acc.step')}</label>
					<select id="f-step" name="stepFreeAccess" bind:value={v.stepFreeAccess}>
						<option value="">{t(locale, 'adm.acc.unknown')}</option>
						<option value="yes">{t(locale, 'adm.acc.yes')}</option>
						<option value="no">{t(locale, 'adm.acc.no')}</option>
						<option value="partial">{t(locale, 'adm.acc.partial')}</option>
					</select>
				</div>
				{#each [['adaptedToilet', 'f-toilet', 'adm.acc.toilet'], ['adaptedChangingRoom', 'f-changing', 'adm.acc.changing'], ['accessibleParkingNearby', 'f-parking', 'adm.acc.parking'], ['hearingLoop', 'f-loop', 'adm.acc.loop']] as [name, id, label] (name)}
					<div class="campo">
						<label for={id}>{t(locale, label as never)}</label>
						<select
							{id}
							{name}
							value={v[name as keyof FormValues] === true
								? 'yes'
								: v[name as keyof FormValues] === false
									? 'no'
									: ''}
						>
							<option value="">{t(locale, 'adm.acc.unknown')}</option>
							<option value="yes">{t(locale, 'adm.acc.yes')}</option>
							<option value="no">{t(locale, 'adm.acc.no')}</option>
						</select>
					</div>
				{/each}
				<div class="campo">
					<label for="f-support">{t(locale, 'adm.acc.contact')}</label>
					<input
						id="f-support"
						name="supportContact"
						maxlength="120"
						value={v.supportContact ?? ''}
					/>
				</div>
				<div class="campo">
					<label for="f-access-notes">{t(locale, 'adm.acc.notes')}</label>
					<textarea id="f-access-notes" name="accessibilityNotes" rows="3" maxlength="300"
						>{v.accessibilityNotes ?? ''}</textarea
					>
				</div>
				<input type="hidden" name="accessibilityCheckedAt" value="" />
			</fieldset>
		{/if}

		<div class="campo">
			<label class="check">
				<input type="checkbox" name="needsOpening" bind:checked={v.needsOpening} />
				{t(locale, 'adm.fac.needs_opening')}
			</label>
		</div>

		<div class="campo">
			<label for="f-access-info">{t(locale, 'adm.fac.access_info_gl')}</label>
			<textarea
				id="f-access-info"
				name="accessInfo"
				rows="3"
				maxlength="2000"
				bind:value={v.accessInfo}
			></textarea>
		</div>
		<div class="campo">
			<label for="f-access-info-es">{t(locale, 'adm.fac.access_info_es')}</label>
			<textarea
				id="f-access-info-es"
				name="accessInfoEs"
				rows="3"
				maxlength="2000"
				bind:value={v.accessInfoEs}
			></textarea>
		</div>

		<div class="campo">
			<label for="f-rules">{t(locale, 'adm.fac.normas')}</label>
			<textarea id="f-rules" name="rules" rows="4" maxlength="2000" bind:value={v.rules}></textarea>
			<p class="axuda">{t(locale, 'adm.fac.normas_axuda')}</p>
		</div>

		{#if submit}
			<div><Button type="submit">{submit}</Button></div>
		{/if}
	</form>

	<div class="dereita">
		<section aria-labelledby="preview-t">
			<h2 id="preview-t" class="k">{t(locale, 'adm.fac.preview')}</h2>
			<div class="mini">
				<Mascot kind={type?.mascot ?? 'sala'} size={56} color={type?.color} />
				<FreeOptionCard {option} {locale} noun={nounFor(mode, type?.mascot ?? 'sala')} />
			</div>
		</section>
		{@render aside?.()}
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.campos,
	.dereita {
		display: grid;
		gap: 16px;
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
	legend {
		padding: 0;
		font-weight: 800;
	}

	input:not([type='radio']):not([type='checkbox']),
	select,
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

	.prezos {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.axuda {
		margin: -8px 0 0;
		color: var(--texto-suave);
		font-weight: 600;
	}

	.campo .axuda {
		margin: 0;
	}

	.social input {
		max-width: 50%;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--toque);
	}

	.check input {
		width: 24px;
		height: 24px;
	}

	.accesibilidade {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 16px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: var(--toque);
		padding: 4px 12px 4px 8px;
		border: 2px solid var(--ceo);
		border-radius: 999px;
		background: var(--branco);
		font-weight: 700;
		cursor: pointer;
	}

	.chip.on {
		border-color: var(--txt);
		background: var(--ceo);
	}

	.chip input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.chip:has(input:focus-visible) {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}

	.k {
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--texto-suave);
	}

	/* Mini-teléfono: la vecindad ve la tarjeta de «libre» así */
	.mini {
		display: grid;
		gap: 10px;
		max-width: 300px;
		padding: 18px 14px 16px;
		border: 4px solid var(--txt);
		border-radius: 28px;
		background: var(--ceo);
	}

	.erro {
		margin: 0;
		color: var(--perigo);
		font-weight: 800;
	}

	.erro p {
		margin: 0 0 4px;
	}

	.erro ul {
		margin: 0;
		padding-left: 20px;
	}
</style>
