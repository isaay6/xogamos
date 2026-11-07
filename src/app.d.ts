// SPDX-License-Identifier: EUPL-1.2
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from './lib/server/auth/types';
import type { Db } from './lib/server/db/client';
import type { Locale } from './lib/i18n';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db: Db;
			now: () => Date;
			user: SessionUser | null;
			sessionId: string | null;
			/** Idioma de la interfaz, de la cookie `lingua` (galego por defecto). */
			locale: Locale;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
