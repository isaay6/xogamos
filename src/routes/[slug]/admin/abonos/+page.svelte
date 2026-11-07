<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/index.js';
	import Button from '#lib/ui/Button.svelte';
	import Fob from '#lib/ui/Fob.svelte';
	import { formatEuros, longDate } from '#lib/ui/format.js';
	import BuscaPersoa from '../../conserxeria/BuscaPersoa.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/admin/abonos`);
	const busca = $derived(form && 'busca' in form ? form.busca : null);
	let passTypeId = $state('');
	const selectedType = $derived(data.types.find((type) => type.id === passTypeId) ?? data.types[0]);
</script>

<svelte:head>
	<title>{t(locale, 'adm.abonos.titulo')} · {data.municipality.name}</title>
</svelte:head>
<h1>{t(locale, 'adm.abonos.titulo')}</h1>
{#if form && 'sold' in form && form.sold}
	<p class="ok" role="status">{t(locale, 'adm.abonos.vendido')}</p>
	<section class="credencial">
		<Fob code={form.sold.pin} color="#1AA6C8" size="xl" {locale} qr={form.sold.qr} />
		<Button type="button" onclick={() => window.print()}>{t(locale, 'adm.abonos.imprimir')}</Button>
	</section>
{/if}
{#if form && 'typeCreated' in form}
	<p class="ok" role="status">{t(locale, 'adm.abonos.tipo_creado')}</p>
{/if}

<section data-tour="abonos">
	<h2>{t(locale, 'adm.abonos.vender')}</h2>
	{#if data.types.length === 0}
		<p>{t(locale, 'adm.abonos.sen_venda')}</p>
	{:else}
		<BuscaPersoa
			{locale}
			{busca}
			selectedId={data.person?.profileId ?? null}
			resetHref={base}
			registerHref={`/${data.municipality.slug}/conserxeria/nova#nova-persoa`}
			confirmAction={`${base}?/confirmarDni`}
			personHref={(profileId) => `${base}?persoa=${profileId}`}
		/>
		{#if data.person}
			<form use:enhance method="POST" action="?/vender" id="vender">
				<p><b>{data.person.displayName}</b></p>
				<input type="hidden" name="profileId" value={data.person.profileId} />
				<label>
					{t(locale, 'adm.abonos.tipo')}
					<select name="passTypeId" bind:value={passTypeId} required>
						{#each data.types as type (type.id)}
							<option value={type.id}>
								{type.name} · {type.days} {t(locale, 'adm.abonos.dias')} ·
								{formatEuros(type.priceCents, locale)}
							</option>
						{/each}
					</select>
				</label>
				<label>
					<input type="radio" name="paymentMethod" value="facility" checked />
					{t(locale, 'vec.monedero.pagar_instalacion')}
				</label>
				<label>
					<input type="radio" name="paymentMethod" value="wallet" />
					{t(locale, 'adm.monedero.pagar')}
				</label>
				{#if selectedType?.closedToday}<p class="aviso">{t(locale, 'adm.abonos.pechado')}</p>{/if}
				<label>
					{t(locale, 'adm.abonos.inicio')}
					<input name="startsOn" type="date" min={data.today} value={data.today} required />
				</label>
				<Button type="submit">{t(locale, 'adm.abonos.vender')}</Button>
			</form>
		{/if}
	{/if}
</section>
<section>
	<h2>{t(locale, 'adm.abonos.vixentes')}</h2>
	{#if data.currentPasses.length === 0}
		<p>{t(locale, 'adm.abonos.sen_vixentes')}</p>
	{:else}
		<ul>{#each data.currentPasses as pass (pass.id)}<li><b>{pass.displayName}</b> · {pass.name} · {t(locale, 'adm.abonos.valido_ata', { ata: longDate(locale, pass.endsOn) })}</li>{/each}</ul>
	{/if}
</section>
<section><h2>{t(locale, 'adm.abonos.novo_tipo')}</h2><form method="POST" action="?/crearTipo"><label>{t(locale, 'adm.abonos.nome')}<input name="name" required maxlength="80" /></label><label>{t(locale, 'adm.abonos.deporte')}<select name="facilityTypeId" required>{#each data.sports as row (row.id)}<option value={row.id}>{locale === 'gl' ? row.nameGl : row.nameEs}</option>{/each}</select></label><label>{t(locale, 'adm.abonos.dias')}<input name="days" type="number" min="1" required /></label><label>{t(locale, 'adm.abonos.prezo_centimos')}<input name="priceCents" inputmode="decimal" required /></label><Button type="submit" variant="out">{t(locale, 'adm.abonos.crear')}</Button></form></section>
<section><h2>{t(locale, 'adm.abonos.tipos')}</h2><ul>{#each data.types as type (type.id)}<li>{type.name} · {type.days} {t(locale, 'adm.abonos.dias')} · {formatEuros(type.priceCents, locale)}</li>{/each}</ul></section>

<style>
	section { margin: 24px 0; }
	form { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
	label { display: grid; gap: 4px; font-weight: 700; }
	input, select { min-height: var(--toque); padding: 0 10px; border: 2px solid var(--txt); border-radius: 10px; font: inherit; }
	.ok { color: #1f7a3b; font-weight: 800; }
</style>
