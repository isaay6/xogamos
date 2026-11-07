// SPDX-License-Identifier: EUPL-1.2
import type { RequestEvent } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { SessionUser } from '../auth/types';
import { staffRoles } from '../db/schema';
import { getMunicipalityBySlug, type MunicipalityRow } from '../services/municipalities';
import { fail } from './respond';
import { Slug } from './schemas';

type Event = Pick<RequestEvent, 'locals' | 'params'>;
type StaffRole = 'admin' | 'conserxe' | 'apertura';

/** Usuario con sesión, o 401. Uso: `const u = requireUser(e); if (u instanceof Response) return u;` */
export function requireUser(event: Pick<RequestEvent, 'locals'>): SessionUser | Response {
	return event.locals.user ?? fail('UNAUTHENTICATED');
}

/** Concello del `slug` de la ruta: 400 si el slug está mal formado, 404 si no existe. */
export async function requireMunicipality(event: Event): Promise<MunicipalityRow | Response> {
	const slug = Slug.safeParse(event.params.slug);
	if (!slug.success) {
		return fail('VALIDATION_FAILED', { issues: [{ path: 'slug', message: 'Invalid slug' }] });
	}
	return (await getMunicipalityBySlug(event.locals.db, slug.data)) ?? fail('NOT_FOUND');
}

/**
 * Personal del concello con alguno de los roles dados (401 sin sesión, 403 sin rol).
 * `admin` cumple cualquier requisito de `conserxe`; `deputacion` nunca cuenta.
 */
export async function requireStaff(
	event: Pick<RequestEvent, 'locals'>,
	municipalityId: string,
	roles: StaffRole[]
): Promise<SessionUser | Response> {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const accepted = new Set<string>(roles);
	if (accepted.has('conserxe')) accepted.add('admin');
	const held = await event.locals.db
		.select({ role: staffRoles.role })
		.from(staffRoles)
		.where(and(eq(staffRoles.userId, user.id), eq(staffRoles.municipalityId, municipalityId)));
	return held.some((r) => accepted.has(r.role)) ? user : fail('FORBIDDEN');
}

/** Personal de la deputación (rol provincial, sin concello): 401 o 403. */
export async function requireDeputacion(
	event: Pick<RequestEvent, 'locals'>
): Promise<SessionUser | Response> {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const [row] = await event.locals.db
		.select({ id: staffRoles.id })
		.from(staffRoles)
		.where(
			and(
				eq(staffRoles.userId, user.id),
				isNull(staffRoles.municipalityId),
				eq(staffRoles.role, 'deputacion')
			)
		);
	return row ? user : fail('FORBIDDEN');
}
