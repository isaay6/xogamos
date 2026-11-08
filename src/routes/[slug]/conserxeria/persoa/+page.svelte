<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import Avatar from '#lib/ui/Avatar.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import { facilityLabel, nounFor } from '#lib/ui/booking-text.js';
	import { formatCode, formatEuros, formatTime, longDate } from '#lib/ui/format.js';
	import BuscaPersoa from '../BuscaPersoa.svelte';
	import { dayLabel } from '../dates';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const busca = $derived(form && 'busca' in form ? form.busca : null);
	const done = $derived(form && 'done' in form ? form.done : null);
	const failed = $derived(form && 'error' in form ? form.error : null);
	const confirming = $derived(form && 'confirmCancel' in form ? form.confirmCancel : null);

	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/conserxeria`);
	type Row = (typeof data.upcoming)[number];
	const when = (b: Row) =>
		`${dayLabel(locale, b.startsAt.toISOString())} · ${formatTime(b.startsAt)}`;
	const place = (b: Row) =>
		facilityLabel(locale, b.facilityName, b.unitIndex, nounFor('unit', b.mascot));
	// As accións levan a persoa na query, como a URL da ficha.
	const action = (name: string) => `?/${name}&persoa=${data.person?.profileId ?? ''}`;
	// Botón visible se hai declaración sen comprobar ou se aínda non consta como empadroada.
	const canVerify = $derived(
		data.person !== null &&
			(!data.person.isResident ||
				(data.person.residencyDeclaredAt !== null && data.person.residencyVerifiedAt === null))
	);
	let passTypeId = $state('');
	const selectedPassType = $derived(
		data.passTypes.find((type) => type.id === passTypeId) ?? data.passTypes[0]
	);
</script>

<svelte:head>
	<title
		>{t(locale, 'cons.per.titulo')}{data.municipality ? ` · ${data.municipality.name}` : ''}</title
	>
</svelte:head>

<header class="mh">
	<p class="k">{t(locale, 'cons.per.sub')}</p>
	<h1>{t(locale, 'cons.per.titulo')}</h1>
</header>

<div class="cols">
	<section class="busca" data-tour="persoa-ficha">
		<BuscaPersoa
			{locale}
			{busca}
			selectedId={data.person?.profileId ?? null}
			resetHref={`${base}/persoa`}
			registerHref={`${base}/nova#nova-persoa`}
			confirmAction={`${base}/nova?/confirmarDni`}
		/>
	</section>

	{#if data.person}
		{@const p = data.person}
		<section class="ficha" aria-labelledby="ficha-h">
			<div class="cab">
				<Avatar avatar={p.avatar} userId={p.userId} name={p.displayName} size={72} {locale} />
				<div>
					<h2 id="ficha-h">{p.displayName}</h2>
					<p class="k">
						{t(locale, p.isResident ? 'cons.panel.empadroada' : 'cons.panel.nonempadroada')}
						{#if p.phone}
							· {t(locale, 'cons.nova.tel', { tel: p.phone })}{/if}
					</p>
					<p class="k">
						{t(locale, 'cons.per.faltas', { n: p.noShowCount, max: data.threshold })} ·
						{p.penaltyUntil
							? t(locale, 'cons.per.penal', {
									data: dayLabel(locale, p.penaltyUntil.toISOString())
								})
							: t(locale, 'cons.per.sen')}
					</p>
				</div>
			</div>

			{#if done}
				<p class="okmsg" role="status">{t(locale, `cons.per.feito.${done}` as MessageKey)}</p>
				{#if form && 'soldPass' in form && form.soldPass}
					<section class="credencial">
						<Fob
							code={form.soldPass.pin}
							color="#1AA6C8"
							size="xl"
							{locale}
							qr={form.soldPass.qr}
						/>
						<Button type="button" onclick={() => window.print()}
							>{t(locale, 'cons.per.imprimir')}</Button
						>
					</section>
				{/if}
			{:else if failed && !confirming}
				<p class="err" role="alert">
					{t(
						locale,
						(failed === 'VALIDATION_FAILED'
							? 'cons.per.err.VALIDATION_FAILED'
							: `cons.err.${failed}`) as MessageKey
					)}
				</p>
			{/if}

			<div class="xestion">
				<div class="bloque">
					{#if p.residencyVerifiedAt}
						<p class="k">
							{t(locale, 'cons.per.comprobado', {
								data: dayLabel(locale, p.residencyVerifiedAt.toISOString())
							})}
						</p>
					{/if}
					{#if p.residencyDeclaredAt && !p.residencyVerifiedAt}
						<p class="k">
							{t(locale, 'cons.per.declarou', {
								data: dayLabel(locale, p.residencyDeclaredAt.toISOString())
							})}
						</p>
					{/if}
					{#if canVerify}
						<form use:enhance method="POST" action={action('empadroamento')}>
							<Button type="submit" variant="out">{t(locale, 'cons.per.empadroamento')}</Button>
						</form>
					{/if}
				</div>
				<form use:enhance method="POST" action={action('tarifa')} class="bloque tarifa">
					<label for="tarifa" class="k">{t(locale, 'cons.per.tarifa')}</label>
					<div class="fila">
						<select id="tarifa" name="tarifa">
							<option value="" selected={p.socialTariff === null}
								>{t(locale, 'cons.tarifa.ningunha')}</option
							>
							{#each data.tariffs as tf (tf)}
								<option value={tf} selected={p.socialTariff === tf}
									>{t(locale, `cons.tarifa.${tf}` as MessageKey)}</option
								>
							{/each}
						</select>
						<Button type="submit" variant="out">{t(locale, 'cons.per.gardar')}</Button>
					</div>
				</form>
			</div>

			<a class="nova" href="{base}/nova?persoa={p.profileId}">{t(locale, 'cons.per.nova')}</a>

			<section class="abonos">
				<h3>{t(locale, 'cons.per.abonos')}</h3>
				{#if data.passTypes.length > 0}
					<form use:enhance method="POST" action={action('venderAbono')} class="vender-abono">
						<label>
							{t(locale, 'cons.per.tipo_abono')}
							<select name="passTypeId" bind:value={passTypeId} required>
								{#each data.passTypes as type (type.id)}
									<option value={type.id}
										>{type.name} · {formatEuros(type.priceCents, locale)}</option
									>
								{/each}
							</select>
						</label>
						{#if selectedPassType?.closedToday}<p class="err">
								{t(locale, 'cons.per.abono_pechado')}
							</p>{/if}
						<label>
							{t(locale, 'cons.per.inicio_abono')}
							<input name="startsOn" type="date" min={data.today} value={data.today} required />
						</label>
						<Button type="submit">{t(locale, 'cons.per.vender_abono')}</Button>
					</form>
				{:else}
					<p class="k">{t(locale, 'cons.per.sen_abonos')}</p>
				{/if}
				{#if data.passes.length > 0}
					<ul class="lista">
						{#each data.passes as pass (pass.id)}
							<li>
								<span
									><b>{pass.name}</b> · {t(locale, 'cons.per.valido_abono', {
										ata: longDate(locale, pass.endsOn)
									})}</span
								><span class="k">{t(locale, 'cons.per.pin')} {formatCode(pass.pin)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<h3>{t(locale, 'cons.per.reservas')}</h3>
			{#if data.upcoming.length === 0}
				<p class="k">{t(locale, 'cons.per.ningunha')}</p>
			{:else}
				<ul class="lista">
					{#each data.upcoming as b (b.id)}
						<li>
							<span>
								<b>{place(b)}</b> · {when(b)} · {formatEuros(b.priceCents, locale)}
								<span class="k">
									· {t(locale, 'cons.panel.codigo')} {formatCode(b.accessCode)}</span
								>
							</span>
							{#if confirming === b.id}
								<form
									use:enhance
									method="POST"
									action={action('cancelar')}
									class="seguro"
									role="alert"
								>
									<b>{t(locale, 'cons.panel.seguro')}</b>
									{#if failed === 'VALIDATION_FAILED'}
										<p class="err">{t(locale, 'cons.err.VALIDATION_FAILED')}</p>
									{/if}
									<input type="hidden" name="reserva" value={b.id} />
									<input type="hidden" name="confirmar" value="1" />
									<label class="motivo">
										<span>{t(locale, 'cons.panel.motivo')}</span>
										<textarea name="motivo" required maxlength="200" rows="2"></textarea>
									</label>
									<div class="acts">
										<Button type="submit" variant="perigo"
											>{t(locale, 'cons.panel.cancelar')}</Button
										>
										<Button variant="out" href={`?persoa=${p.profileId}`}
											>{t(locale, 'cons.panel.non')}</Button
										>
									</div>
								</form>
							{:else}
								<form use:enhance method="POST" action={action('cancelar')}>
									<input type="hidden" name="reserva" value={b.id} />
									<Button type="submit" variant="perigo">{t(locale, 'cons.panel.cancelar')}</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<h3>{t(locale, 'cons.per.historial')}</h3>
			{#if data.past.length === 0}
				<p class="k">{t(locale, 'cons.per.ningunha')}</p>
			{:else}
				<ul class="lista pasadas">
					{#each data.past as b (b.id)}
						<li>
							<span>
								<b>{place(b)}</b> · {when(b)}
								<span class="k"> · {t(locale, `cons.estado.${b.status}` as MessageKey)}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	.mh {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 900;
	}
	h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 900;
	}
	h3 {
		margin: 16px 0 4px;
		font-size: 15px;
	}
	.k {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	.cols {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.busca {
		width: 340px;
		max-width: 100%;
		display: grid;
		gap: 10px;
	}
	.ficha {
		flex: 1;
		min-width: 280px;
		display: grid;
		gap: 8px;
	}
	.cab {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.xestion {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 12px;
		border: 2px solid var(--ceo);
		border-radius: var(--radio);
	}
	.bloque {
		display: grid;
		gap: 6px;
		align-content: start;
	}
	.fila {
		display: flex;
		gap: 8px;
	}
	select {
		min-height: var(--toque);
		padding: 0 10px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
	}
	.nova {
		display: inline-flex;
		align-items: center;
		min-height: var(--toque);
		color: var(--txt);
		font-weight: 800;
	}
	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.lista li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--ceo);
	}
	.pasadas li {
		background: none;
		padding: 0;
	}
	.seguro {
		display: grid;
		gap: 8px;
		width: 100%;
		padding: 10px;
		border: 2px solid var(--perigo);
		border-radius: 10px;
		background: var(--branco);
	}
	.motivo {
		display: grid;
		gap: 4px;
		font-size: 14px;
		font-weight: 700;
	}
	textarea {
		padding: 8px;
		border: 2px solid var(--txt);
		border-radius: 8px;
		font: inherit;
	}
	.vender-abono {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: end;
	}
	.vender-abono label {
		display: grid;
		gap: 4px;
		font-size: 14px;
		font-weight: 700;
	}
	input {
		min-height: var(--toque);
		padding: 0 10px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		font: inherit;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.okmsg {
		margin: 0;
		font-weight: 800;
		color: #1f7a3b;
	}
	.err {
		margin: 0;
		padding: 8px 10px;
		border: 2px solid var(--perigo);
		border-radius: 8px;
		color: var(--perigo);
		font-weight: 800;
	}
	a:focus-visible,
	select:focus-visible,
	input:focus-visible,
	textarea:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
</style>
