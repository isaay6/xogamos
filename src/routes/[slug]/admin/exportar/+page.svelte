<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const api = $derived(`/api/v1/m/${data.municipality.slug}`);
	const links = $derived([
		{
			href: `${api}/admin/export.xlsx`,
			title: t(data.locale, 'adm.exportar.xlsx'),
			text: t(data.locale, 'adm.exportar.xlsx_texto')
		},
		{
			href: `${api}/admin/export/bookings`,
			title: t(data.locale, 'adm.exportar.csv'),
			text: t(data.locale, 'adm.exportar.csv_texto')
		},
		{
			href: `${api}/admin/export`,
			title: t(data.locale, 'adm.exportar.json'),
			text: t(data.locale, 'adm.exportar.json_texto')
		},
		{
			href: `${api}/admin/export.ics`,
			title: t(data.locale, 'adm.exportar.cal'),
			text: t(data.locale, 'adm.exportar.cal_texto')
		}
	]);
</script>

<svelte:head>
	<title>{t(data.locale, 'adm.menu.exportar')} · {data.municipality.name}</title>
</svelte:head>

<h1>{t(data.locale, 'adm.exportar.titulo')}</h1>
<p class="intro">{t(data.locale, 'adm.exportar.texto')}</p>
<ul>
	{#each links as l (l.href)}
		<li>
			<a href={l.href} download>
				<b>{l.title}</b>
				<span>{l.text}</span>
			</a>
		</li>
	{/each}
</ul>

<section aria-labelledby="importar">
	<h2 id="importar">{t(data.locale, 'adm.importar.titulo')}</h2>
	<p>{t(data.locale, 'adm.importar.texto')}</p>
	<a href="/plantillas/instalacions.csv" download>
		{t(data.locale, 'adm.importar.modelo')}
	</a>
	<form method="POST" action="?/previsualizar" enctype="multipart/form-data">
		<label for="ficheiro">{t(data.locale, 'adm.importar.ficheiro')}</label>
		<input id="ficheiro" name="ficheiro" type="file" accept=".csv,text/csv" required />
		<button>{t(data.locale, 'adm.importar.previsualizar')}</button>
	</form>
	{#if form?.importError}
		<p class="error">{t(data.locale, form.importError as MessageKey)}</p>
	{/if}
	{#if form?.preview}
		<table>
			<thead>
				<tr>
					<th>{t(data.locale, 'adm.importar.fila')}</th>
					<th>{t(data.locale, 'adm.importar.cambio')}</th>
					<th>{t(data.locale, 'adm.importar.erro')}</th>
				</tr>
			</thead>
			<tbody>
				{#each form.preview as row (row.line)}
					<tr>
						<td>{row.line}</td>
						<td>
							{row.change === 'create'
								? t(data.locale, 'adm.importar.crear')
								: t(data.locale, 'adm.importar.actualizar')}
						</td>
						<td>{row.error ? t(data.locale, row.error as MessageKey) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<form method="POST" action="?/importar">
			<input name="rows" type="hidden" value={JSON.stringify(form.preview)} />
			<button disabled={form.preview.some((row) => row.error)}>
				{t(data.locale, 'adm.importar.confirmar')}
			</button>
		</form>
	{/if}
	{#if form?.imported !== undefined}
		<p>{t(data.locale, 'adm.importar.feito', { n: form.imported })}</p>
	{/if}
</section>

<style>
	h1 {
		margin: 0 0 6px;
		font-size: 28px;
		font-weight: 900;
	}

	.intro {
		margin: 0 0 18px;
		color: var(--texto-suave);
		font-weight: 600;
	}

	ul {
		display: grid;
		gap: 10px;
		max-width: 520px;
		padding: 0;
		list-style: none;
	}

	section {
		max-width: 680px;
		margin-top: 32px;
	}

	form {
		display: grid;
		gap: 10px;
		margin-top: 14px;
	}

	button,
	input {
		min-height: var(--toque);
	}

	table {
		width: 100%;
		margin-top: 16px;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 8px;
		border-bottom: 1px solid var(--gris);
		text-align: left;
	}

	.error {
		color: var(--perigo);
	}

	a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: var(--toque);
		padding: 12px 16px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		color: var(--txt);
		text-decoration: none;
	}

	a b {
		font-size: 18px;
		font-weight: 900;
	}

	a span {
		color: var(--texto-suave);
		font-weight: 600;
	}

	a:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 3px;
	}
</style>
