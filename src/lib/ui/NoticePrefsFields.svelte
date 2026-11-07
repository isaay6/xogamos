<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '../i18n';

	// Campos das preferencias de avisos (benvida, paso 3, e «Eu → Avisos»): só na app ou
	// tamén por correo, co enderezo e unha caixa de consentimento explícito. Sen JS, todo á vista.
	let {
		locale,
		avisos,
		email,
		consent = false,
		issues = {}
	}: {
		locale: Locale;
		avisos: 'app' | 'correo';
		email: string;
		/** A caixa vén marcada só se xa había consentimento. */
		consent?: boolean;
		issues?: { email?: boolean; consentimento?: boolean };
	} = $props();
</script>

<fieldset class="prefs">
	<legend>{t(locale, 'vec.prefs.legend')}</legend>
	<label class="opcion">
		<input type="radio" name="avisos" value="app" checked={avisos === 'app'} />
		<span>
			{t(locale, 'vec.prefs.app')}
			<small>{t(locale, 'vec.prefs.app.nota')}</small>
		</span>
	</label>
	<label class="opcion">
		<input type="radio" name="avisos" value="correo" checked={avisos === 'correo'} />
		<span>{t(locale, 'vec.prefs.correo')}</span>
	</label>

	<div class="correo">
		<label for="prefs-email">{t(locale, 'vec.prefs.email')}</label>
		<input
			id="prefs-email"
			type="email"
			name="email"
			value={email}
			autocomplete="email"
			aria-invalid={issues.email ? 'true' : undefined}
			aria-describedby={issues.email ? 'prefs-erro-email' : undefined}
		/>
		{#if issues.email}
			<p class="erro" id="prefs-erro-email">{t(locale, 'vec.prefs.erro.email')}</p>
		{/if}
		<label class="caixa">
			<input
				type="checkbox"
				name="consentimento"
				value="si"
				checked={consent}
				aria-invalid={issues.consentimento ? 'true' : undefined}
				aria-describedby={issues.consentimento ? 'prefs-erro-consentimento' : undefined}
			/>
			<span>{t(locale, 'vec.prefs.consentimento')}</span>
		</label>
		{#if issues.consentimento}
			<p class="erro" id="prefs-erro-consentimento">
				{t(locale, 'vec.prefs.erro.consentimento')}
			</p>
		{/if}
	</div>
</fieldset>

<style>
	.prefs {
		display: grid;
		gap: 8px;
	}

	legend {
		margin-bottom: 6px;
		font-weight: 900;
	}

	.opcion,
	.caixa {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 8px 12px;
		border: 2px solid var(--liña);
		border-radius: var(--radio);
		font-weight: 800;
		cursor: pointer;
	}

	.opcion:has(input:checked) {
		border-color: var(--txt);
	}

	.caixa {
		align-items: flex-start;
		border: 0;
		padding: 8px 0;
		font-weight: 600;
		line-height: 1.35;
	}

	input[type='radio'],
	input[type='checkbox'] {
		flex: none;
		width: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--txt);
	}

	small {
		display: block;
		font-weight: 600;
		color: var(--texto-suave);
	}

	.correo {
		display: grid;
		gap: 4px;
		padding-left: 4px;
	}

	.correo > label:first-child {
		font-weight: 800;
	}

	input[type='email'] {
		min-height: var(--toque);
		padding: 0 12px;
		border: 2px solid var(--txt);
		border-radius: var(--radio);
		font-weight: 600;
	}

	input[aria-invalid='true'] {
		border-color: var(--perigo);
		outline-color: var(--perigo);
	}

	.erro {
		font-weight: 800;
		color: var(--perigo);
	}
</style>
