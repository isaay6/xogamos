// SPDX-License-Identifier: EUPL-1.2
// Abre a sesión dunha identidade xa comprobada: o retorno do simulador e a portada /demo.
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import { upsertIdentity, type UserRow } from '../services/identity';
import {
	SESSION_COOKIE,
	createSession,
	invalidateSession,
	sessionCookieOptions
} from '../services/sessions';

export type VerifiedIdentity = {
	provider: 'clave' | 'chave365';
	subject: string;
	displayName: string;
	email: string | null;
};

/**
 * Crea ou actualiza a persoa e abre unha sesión nova. Nunca se reutiliza a sesión previa:
 * invalídase antes de abrir a nova (cambiar de persoa é saír e entrar).
 */
export async function startSession(
	event: { locals: App.Locals; cookies: Cookies },
	identity: VerifiedIdentity
): Promise<UserRow> {
	const { locals, cookies } = event;
	const user = await upsertIdentity(locals.db, identity);
	if (locals.sessionId) await invalidateSession(locals.db, locals.sessionId);
	const { token, expiresAt } = await createSession(locals.db, user.id, locals.now());
	cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt, !dev));
	return user;
}
