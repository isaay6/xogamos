// SPDX-License-Identifier: EUPL-1.2
import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requirePageDeputacion } from '../../../lib/server/http/page-guards';
import type { Db } from '../../../lib/server/db/client';
import { Uuid } from '../../../lib/server/http/schemas';
import {
	addMunicipalityAdmin,
	addMunicipalityAdminIdentity,
	getDeputacionStaffCandidate,
	listMunicipalitiesWithAdmins,
	searchDeputacionStaffCandidates
} from '../../../lib/server/services/deputacion';
import { removeStaff } from '../../../lib/server/services/staff';
import { writeActivity } from '../../../lib/server/services/activity-log';
import type { Actions, PageServerLoad } from './$types';

const IdentityInput = z.object({
	provider: z.enum(['clave', 'chave365']),
	subject: z.string().trim().min(1).max(64),
	displayName: z.string().trim().min(1).max(200)
});

const field = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
};

// Esta ruta oculta a existencia da función provincial a quen non ten o rol.
async function requireAdministradores(event: RequestEvent) {
	try {
		return await requirePageDeputacion(event);
	} catch (cause) {
		if (isHttpError(cause) && cause.status === 403) error(404);
		throw cause;
	}
}

async function municipalityName(db: Db, id: string) {
	const municipalities = await listMunicipalitiesWithAdmins(db);
	return municipalities.find((municipality) => municipality.id === id)?.name ?? null;
}

export const load: PageServerLoad = async (event) => {
	await requireAdministradores(event);
	return { municipalities: await listMunicipalitiesWithAdmins(event.locals.db) };
};

export const actions: Actions = {
	buscar: async (event) => {
		await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const q = field(form, 'q').trim();
		if (!municipalityId.success || !(await municipalityName(event.locals.db, municipalityId.data)))
			return fail(400, { error: 'INVALID' });
		return {
			search: {
				municipalityId: municipalityId.data,
				q,
				candidates: q ? await searchDeputacionStaffCandidates(event.locals.db, q) : []
			}
		};
	},
	preparar: async (event) => {
		await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const userId = Uuid.safeParse(field(form, 'userId'));
		if (!municipalityId.success || !userId.success) return fail(400, { error: 'INVALID' });
		const [municipality, candidate] = await Promise.all([
			municipalityName(event.locals.db, municipalityId.data),
			getDeputacionStaffCandidate(event.locals.db, userId.data)
		]);
		if (!municipality || !candidate) return fail(404, { error: 'NOT_FOUND' });
		return {
			confirm: {
				kind: 'add' as const,
				municipalityId: municipalityId.data,
				municipality,
				candidate
			}
		};
	},
	prepararIdentidade: async (event) => {
		await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const identity = IdentityInput.safeParse({
			provider: field(form, 'provider'),
			subject: field(form, 'subject'),
			displayName: field(form, 'displayName')
		});
		const municipality = municipalityId.success
			? await municipalityName(event.locals.db, municipalityId.data)
			: null;
		if (!municipalityId.success || !identity.success || !municipality)
			return fail(400, { error: 'INVALID' });
		return {
			confirm: {
				kind: 'identity' as const,
				municipalityId: municipalityId.data,
				municipality,
				identity: identity.data
			}
		};
	},
	engadir: async (event) => {
		const user = await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const userId = Uuid.safeParse(field(form, 'userId'));
		if (!municipalityId.success || !userId.success) return fail(400, { error: 'INVALID' });
		if (!(await addMunicipalityAdmin(event.locals.db, municipalityId.data, userId.data)))
			return fail(404, { error: 'NOT_FOUND' });
		await writeActivity(event.locals.db, {
			municipalityId: municipalityId.data,
			actorId: user.id,
			kind: 'staff_added',
			params: { detalle: 'admin' }
		});
		return { added: true };
	},
	engadirIdentidade: async (event) => {
		const user = await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const identity = IdentityInput.safeParse({
			provider: field(form, 'provider'),
			subject: field(form, 'subject'),
			displayName: field(form, 'displayName')
		});
		if (!municipalityId.success || !identity.success) return fail(400, { error: 'INVALID' });
		if (!(await addMunicipalityAdminIdentity(event.locals.db, municipalityId.data, identity.data)))
			return fail(404, { error: 'NOT_FOUND' });
		await writeActivity(event.locals.db, {
			municipalityId: municipalityId.data,
			actorId: user.id,
			kind: 'staff_added',
			params: { detalle: 'admin' }
		});
		return { added: true };
	},
	prepararQuitar: async (event) => {
		await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const roleId = Uuid.safeParse(field(form, 'roleId'));
		if (!municipalityId.success || !roleId.success) return fail(400, { error: 'INVALID' });
		const municipalities = await listMunicipalitiesWithAdmins(event.locals.db);
		const municipality = municipalities.find((item) => item.id === municipalityId.data);
		const admin = municipality?.admins.find((item) => item.roleId === roleId.data);
		if (!municipality || !admin) return fail(404, { error: 'NOT_FOUND' });
		return {
			confirm: {
				kind: 'remove' as const,
				municipalityId: municipality.id,
				municipality: municipality.name,
				admin
			}
		};
	},
	quitar: async (event) => {
		const user = await requireAdministradores(event);
		const form = await event.request.formData();
		const municipalityId = Uuid.safeParse(field(form, 'municipalityId'));
		const roleId = Uuid.safeParse(field(form, 'roleId'));
		if (!municipalityId.success || !roleId.success) return fail(400, { error: 'INVALID' });
		const result = await removeStaff(event.locals.db, municipalityId.data, roleId.data, user.id);
		if (result.ok) return { removed: true };
		return fail(result.error === 'LAST_ADMIN' ? 409 : 404, { error: result.error });
	}
};
