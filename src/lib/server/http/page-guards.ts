// SPDX-License-Identifier: EUPL-1.2
// Guardas para páginas: como las de `guards.ts`, pero redirigen a «Entrar» o lanzan `error(403)`
// en lugar de devolver una respuesta JSON.
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { municipalities } from '../db/schema';
import type { SessionUser } from '../auth/types';
import { requireDeputacion, requireStaff } from './guards';

type PageEvent = Pick<RequestEvent, 'locals' | 'params' | 'url'>;
type StaffRole = 'admin' | 'conserxe' | 'apertura';

/** Sin sesión, 303 a `/{slug}/entrar?redirectTo={ruta actual}`. */
function toLogin(event: PageEvent): never {
	const back = event.url.pathname + event.url.search;
	const slug = event.params.slug;
	const login = slug ? `/${slug}/entrar` : '/';
	redirect(303, `${login}?redirectTo=${encodeURIComponent(back)}`);
}

/** Usuario con sesión; si no hay, redirige a «Entrar» y vuelve aquí después. */
export function requirePageUser(event: PageEvent): SessionUser {
	return event.locals.user ?? toLogin(event);
}

/**
 * Personal del concello con alguno de los roles dados. Misma regla que `requireStaff`
 * (`admin` cumple `conserxe`; `deputacion` nunca cuenta): sin sesión redirige, sin rol 403.
 */
export async function requirePageStaff(
	event: PageEvent,
	municipalityId: string,
	roles: StaffRole[]
): Promise<SessionUser> {
	requirePageUser(event);
	const result = await requireStaff(event, municipalityId, roles);
	if (result instanceof Response) error(403);
	return result;
}

/**
 * Personal de la deputación (rol provincial, sin concello). Sin sesión redirige a «Entrar» del
 * concello recordado (cookie `concello`, si existe) o del primero por nombre, y vuelve aquí;
 * sin ningún concello, a la raíz. Sin el rol, 403.
 */
export async function requirePageDeputacion(
	event: Pick<RequestEvent, 'locals' | 'url'> & Partial<Pick<RequestEvent, 'cookies' | 'params'>>
): Promise<SessionUser> {
	if (!event.locals.user) {
		const back = encodeURIComponent(event.url.pathname + event.url.search);
		const all = await event.locals.db
			.select({ slug: municipalities.slug })
			.from(municipalities)
			.orderBy(asc(municipalities.name));
		const remembered = event.cookies?.get('concello');
		const slug = all.find((m) => m.slug === remembered)?.slug ?? all[0]?.slug;
		redirect(303, `${slug ? `/${slug}/entrar` : '/'}?redirectTo=${back}`);
	}
	const result = await requireDeputacion(event);
	if (result instanceof Response) error(403);
	return result;
}
