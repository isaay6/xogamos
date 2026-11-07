// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { municipalities, municipalityProfiles, staffRoles } from '../../../../lib/server/db/schema';
import { requireUser } from '../../../../lib/server/http/guards';
import { fail, json } from '../../../../lib/server/http/respond';
import { parseBody } from '../../../../lib/server/http/validate';
import { ContactInput, updateContact } from '../../../../lib/server/services/me';

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const { db } = event.locals;
	const profiles = await db
		.select({
			municipalitySlug: municipalities.slug,
			isResident: municipalityProfiles.isResident,
			penaltyUntil: municipalityProfiles.penaltyUntil
		})
		.from(municipalityProfiles)
		.innerJoin(municipalities, eq(municipalities.id, municipalityProfiles.municipalityId))
		.where(eq(municipalityProfiles.userId, user.id))
		.orderBy(municipalities.slug);
	const roles = await db
		.select({ municipalitySlug: municipalities.slug, role: staffRoles.role })
		.from(staffRoles)
		.leftJoin(municipalities, eq(municipalities.id, staffRoles.municipalityId))
		.where(eq(staffRoles.userId, user.id))
		.orderBy(staffRoles.role);
	return json({ user, profiles, roles });
};

/** Correo y teléfono de la persona (el nombre viene de Cl@ve o Chave365 y no se edita). */
export const PATCH: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const body = await parseBody(event, ContactInput);
	if (!body.ok) return fail(body.error, { issues: body.issues });
	const result = await updateContact(event.locals.db, user.id, body.value);
	if (!result.ok) return fail(result.error);
	const { id, displayName, provider, email, phone } = result.value;
	return json({ id, displayName, provider, email, phone });
};
