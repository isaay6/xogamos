// SPDX-License-Identifier: EUPL-1.2
import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { DATABASE_URL, MAIL_FROM, SMTP_URL } from '$app/env/private';
import { LOCALE_COOKIE, localeFromCookie } from './lib/i18n';
import { readIdentityConfig } from './lib/server/auth/config';
import type { Db } from './lib/server/db/client';
import { startBackgroundJobs } from './lib/server/jobs/scheduler';
import { resolveDb } from './lib/server/db/resolve-db';
import {
	SESSION_COOKIE,
	sessionCookieOptions,
	validateSession
} from './lib/server/services/sessions';
import { users } from './lib/server/db/schema';
import { eq } from 'drizzle-orm';

const ACCESSIBILITY_COOKIE = 'quenda_accessibility';

// Una sola instancia por proceso, creada en la primera petición.
let db: Promise<Db> | undefined;
let configChecked = false;

function getDb(): Promise<Db> {
	if (!configChecked) {
		// Falla con un error claro si IDENTITY_MODE=simulated y AUTH_SECRET no es válido.
		readIdentityConfig();
		configChecked = true;
	}
	// Sin DATABASE_URL, solo en desarrollo hay PGlite con datos de demostración. La carga es un
	// import() dentro de la rama `dev` (constante en el build): en producción no se incluye.
	const first = db === undefined;
	db ??= resolveDb({
		databaseUrl: DATABASE_URL,
		loadDemo: import.meta.env.DEV
			? () => import('./lib/server/db/dev-demo').then((m) => m.createDemoDb())
			: undefined
	});
	// Lembranzas y buzón de correo: una vez por proceso (también con `npm run dev:demo`).
	// Nunca bajo Vitest (los tests de hooks sustituyen `$app/env/private`).
	if (first && !process.env.VITEST) {
		db.then(
			(d) => startBackgroundJobs(d, { smtpUrl: SMTP_URL, mailFrom: MAIL_FROM }),
			() => {} // el error ya lo ve la petición que espera la base
		);
	}
	return db;
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = await getDb();
	event.locals.now = () => new Date();
	event.locals.user = null;
	event.locals.sessionId = null;
	const locale = localeFromCookie(event.cookies.get(LOCALE_COOKIE));
	event.locals.locale = locale;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = await validateSession(event.locals.db, token, event.locals.now());
		if (session) {
			event.locals.user = session.user;
			event.locals.sessionId = session.sessionId;
			if (session.renewedExpiresAt) {
				event.cookies.set(
					SESSION_COOKIE,
					token,
					sessionCookieOptions(session.renewedExpiresAt, !dev)
				);
			}
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}
	const cookieSettings = event.cookies.get(ACCESSIBILITY_COOKIE) ?? '';
	let accessibility = cookieSettings;
	if (event.locals.user) {
		const [settings] = await event.locals.db
			.select({
				textSize: users.textSize,
				highContrast: users.highContrast,
				reduceMotion: users.reduceMotion
			})
			.from(users)
			.where(eq(users.id, event.locals.user.id));
		if (settings)
			accessibility = `${settings.textSize}|${settings.highContrast ? 'alto' : 'normal'}|${settings.reduceMotion}`;
	}
	const [textSize = 'normal', contrast = 'normal', motion = 'system'] = accessibility.split('|');
	const attrs = ` data-texto="${textSize === 'large' ? 'grande' : textSize === 'very_large' ? 'moi-grande' : 'normal'}" data-contraste="${contrast === 'alto' ? 'alto' : 'normal'}" data-movemento="${motion === 'always' ? 'reducido' : 'sistema'}"`;
	// `<html lang>` según el idioma (app.html lleva `%lang%`).
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%lang%', locale).replace('<html ', `<html${attrs} `)
	});
};
