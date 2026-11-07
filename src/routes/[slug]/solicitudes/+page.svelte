<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.js';
	import { longDate } from '#lib/ui/format.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const locale = $derived(data.locale);
	const base = $derived(`/${data.municipality.slug}/solicitudes`);
	const errorText = $derived(
		form && 'error' in form
			? t(
					locale,
					`vec.sol.erro.${['NOT_FOUND', 'VALIDATION_FAILED'].includes(form.error ?? '') ? form.error : 'OTHER'}` as MessageKey
				)
			: null
	);
</script>

<svelte:head><title>{t(locale, 'vec.sol.titulo')} · {data.municipality.name}</title></svelte:head>

<main class="solicitudes">
	<header>
		<h1>{t(locale, 'vec.sol.titulo')}</h1>
		<Button href={`${base}/nova`}>{t(locale, 'vec.sol.nova')}</Button>
	</header>
	{#if errorText}<p class="erro" role="alert">{errorText}</p>{/if}
	{#if data.rows.length === 0}
		<p class="baleiro">{t(locale, 'vec.sol.baleiro')}</p>
	{:else}
		<ul>
			{#each data.rows as request (request.id)}
				<li>
					<div>
						<b>{request.title}</b><span class="chip"
							>{t(locale, `vec.sol.estado.${request.status}`)}</span
						>
					</div>
					<p>
						{request.fromDate === request.toDate
							? longDate(locale, request.fromDate)
							: t(locale, 'vec.club.rango_datas', {
									desde: longDate(locale, request.fromDate),
									ata: longDate(locale, request.toDate)
								})} · {request.startsTime}–{request.endsTime}
					</p>
					{#if request.response}<p class="resposta">{request.response}</p>{/if}
					{#if request.status === 'pendente' || request.status === 'mais_datos'}
						<div class="actions">
							{#if request.status === 'mais_datos'}<Button
									variant="out"
									href={`${base}/nova?id=${request.id}`}>{t(locale, 'vec.sol.editar')}</Button
								>{/if}
							<form method="POST" action="?/retirar">
								<input type="hidden" name="id" value={request.id} /><Button
									variant="out"
									type="submit">{t(locale, 'vec.sol.retirar')}</Button
								>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.solicitudes {
		max-width: 720px;
		padding: 12px 16px 24px;
	}
	header,
	li > div,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		font-weight: 900;
	}
	ul {
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: 14px 0;
		border-bottom: 2px solid var(--ceo);
	}
	b {
		font-size: 18px;
	}
	p {
		margin: 5px 0 0;
		color: var(--texto-suave);
		font-weight: 600;
	}
	.resposta {
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--ceo);
		color: var(--txt);
	}
	.chip {
		padding: 4px 8px;
		border-radius: 999px;
		background: var(--ceo);
		font-size: 13px;
		font-weight: 800;
	}
	.actions {
		justify-content: flex-start;
		margin-top: 10px;
	}
	.erro {
		color: var(--perigo);
	}
	.baleiro {
		margin-top: 20px;
	}
</style>
