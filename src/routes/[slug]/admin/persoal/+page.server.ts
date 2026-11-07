// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { Uuid } from '../../../../lib/server/http/schemas';
import {
	addStaff,
	addStaffIdentity,
	listStaff,
	removeStaff,
	searchStaffCandidates
} from '../../../../lib/server/services/staff';
import { requireAdminPage } from '../guard';
import { field } from '../form';
import type { Actions, PageServerLoad } from './$types';

const IdentityInput = z.object({
	provider: z.enum(['clave', 'chave365']),
	subject: z.string().trim().min(1).max(64),
	displayName: z.string().trim().min(1).max(200)
});

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	return { staff: await listStaff(event.locals.db, municipality.id) };
};

export const actions: Actions = {
	// La búsqueda es POST: el nombre buscado no debe quedar en la URL ni en los registros.
	buscar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const q = field(await event.request.formData(), 'q').trim();
		const candidates = q ? await searchStaffCandidates(event.locals.db, municipality.id, q) : [];
		return { busca: { q, candidates } };
	},
	engadir: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const role = field(form, 'role');
		const userId = Uuid.safeParse(field(form, 'userId'));
		if ((role !== 'conserxe' && role !== 'admin' && role !== 'apertura') || !userId.success)
			return fail(400, { error: 'INVALID' });
		const res = await addStaff(event.locals.db, municipality.id, {
			userId: userId.data,
			role,
			actorId: user.id
		});
		return res.ok ? { added: true } : fail(422, { error: 'NO_PROFILE' });
	},
	engadirIdentidade: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const role = field(form, 'role');
		const identity = IdentityInput.safeParse({
			provider: field(form, 'provider'),
			subject: field(form, 'subject'),
			displayName: field(form, 'displayName')
		});
		if ((role !== 'conserxe' && role !== 'admin' && role !== 'apertura') || !identity.success)
			return fail(400, { error: 'INVALID' });
		return (await addStaffIdentity(event.locals.db, municipality.id, identity.data, role))
			? { added: true }
			: fail(422, { error: 'INVALID' });
	},
	quitar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const roleId = Uuid.safeParse(field(await event.request.formData(), 'roleId'));
		if (!roleId.success) return fail(400, { error: 'INVALID' });
		const res = await removeStaff(event.locals.db, municipality.id, roleId.data, user.id);
		if (res.ok) return { removed: true };
		return fail(res.error === 'LAST_ADMIN' ? 409 : 404, { error: res.error });
	}
};
