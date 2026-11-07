// SPDX-License-Identifier: EUPL-1.2
import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Cadena de conexión de PostgreSQL',
		schema: (value) => value || undefined
	},
	IDENTITY_MODE: {
		description:
			"Identidad: 'simulated' activa el simulador de Cl@ve y Chave365; otro valor lo desactiva",
		schema: (value) => value || undefined
	},
	DEMO: {
		description:
			"Modo demo: '1' activa a portada /demo, os percorridos guiados e a faixa «Datos de demostración» (só con IDENTITY_MODE=simulated e unha base desbotable)",
		schema: (value) => value || undefined
	},
	DEMO_DATABASE_IS_DISPOSABLE: {
		description: "Confirma con '1' que DATABASE_URL apunta a unha base de datos demo desbotable",
		schema: (value) => value || undefined
	},
	AUTH_SECRET: {
		description: 'Secreto HMAC de las aserciones simuladas (mínimo 32 caracteres)',
		schema: (value) => value || undefined
	},
	SMTP_URL: {
		description:
			'URL SMTP (smtp://usuario:clave@servidor:587) para enviar los avisos por correo; sin ella solo se guardan en el buzón',
		schema: (value) => value || undefined
	},
	PUBLIC_ORIGIN: {
		description:
			'Origen público (https://reservas.exemplo.gal) de las URL que codifican los QR; sin él, el de cada petición',
		schema: (value) => value?.trim().replace(/\/+$/, '') || undefined
	},
	MAIL_FROM: {
		description: 'Remitente de los correos de aviso (por defecto avisos@localhost)',
		schema: (value) => value || undefined
	}
});
