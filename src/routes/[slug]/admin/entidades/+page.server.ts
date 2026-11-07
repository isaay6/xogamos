// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { Uuid } from '../../../../lib/server/http/schemas';
import { listAllFacilities } from '../../../../lib/server/services/admin';
import {
	listEntities,
	addEntityMember,
	removeEntityMember,
	saveEntity,
	setEntityActive
} from '../../../../lib/server/services/entities';
import { searchStaffCandidates } from '../../../../lib/server/services/staff';
import { requireAdminPage } from '../guard';
import type { Actions, PageServerLoad } from './$types';

const number = (form: FormData, name: string, min: number) => {
	const raw = form.get(name);
	if (raw === null || raw === '') return null;
	const parsed = z.coerce.number().int().min(min).safeParse(raw);
	return parsed.success ? parsed.data : undefined;
};
export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const [items, facilities] = await Promise.all([
		listEntities(event.locals.db, municipality.id),
		listAllFacilities(event.locals.db, municipality.id)
	]);
	return { entities: items, facilities: facilities.map((f) => ({ id: f.id, name: f.name })) };
};
export const actions: Actions = {
	gardar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const advanceDays = number(form, 'advanceDays', 0);
		const maxActiveBookings = number(form, 'maxActiveBookings', 1);
		const maxConsecutiveSlots = number(form, 'maxConsecutiveSlots', 1);
		const fixedPriceCents = number(form, 'fixedPriceCents', 0);
		if (
			[advanceDays, maxActiveBookings, maxConsecutiveSlots, fixedPriceCents].some(
				(value) => value === undefined
			)
		)
			return fail(422, { error: 'INVALID' as const });
		if (
			advanceDays === undefined ||
			maxActiveBookings === undefined ||
			maxConsecutiveSlots === undefined ||
			fixedPriceCents === undefined
		)
			return fail(422, { error: 'INVALID' as const });
		const mode = form.get('priceMode');
		const row = await saveEntity(
			event.locals.db,
			municipality.id,
			user.id,
			{
				name: String(form.get('name') ?? ''),
				shortName: String(form.get('shortName') ?? ''),
				phone: String(form.get('phone') ?? ''),
				priceMode: mode === 'normal' || mode === 'free' || mode === 'fixed' ? mode : null,
				fixedPriceCents,
				advanceDays,
				maxActiveBookings,
				maxConsecutiveSlots,
				noShowsCount: form.get('noShowsCount') === 'on',
				facilityIds: form.getAll('facilityId').filter((v): v is string => typeof v === 'string'),
				memberIds: form.getAll('memberId').filter((v): v is string => typeof v === 'string')
			},
			String(form.get('id') || '') || undefined
		);
		return row ? { saved: true as const } : fail(422, { error: 'INVALID' as const });
	},
	activar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const row = await setEntityActive(
			event.locals.db,
			municipality.id,
			user.id,
			String(form.get('id') ?? ''),
			form.get('active') === 'true'
		);
		return row ? { saved: true as const } : fail(404, { error: 'NOT_FOUND' as const });
	},
	buscarResponsable: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const q = String(form.get('q') ?? '').trim();
		const entityId = String(form.get('entityId') ?? '');
		const candidates = q ? await searchStaffCandidates(event.locals.db, municipality.id, q) : [];
		return { responsibleSearch: { entityId, q, candidates } };
	},
	engadirResponsable: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const entityId = Uuid.safeParse(form.get('entityId'));
		const userId = Uuid.safeParse(form.get('userId'));
		if (!entityId.success || !userId.success) return fail(400, { error: 'INVALID' as const });
		const row = await addEntityMember(
			event.locals.db,
			municipality.id,
			entityId.data,
			userId.data,
			user.id
		);
		return row ? { saved: true as const } : fail(404, { error: 'NOT_FOUND' as const });
	},
	quitarResponsable: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const entityId = Uuid.safeParse(form.get('entityId'));
		const userId = Uuid.safeParse(form.get('userId'));
		if (!entityId.success || !userId.success) return fail(400, { error: 'INVALID' as const });
		const row = await removeEntityMember(
			event.locals.db,
			municipality.id,
			entityId.data,
			userId.data,
			user.id
		);
		return row ? { saved: true as const } : fail(404, { error: 'NOT_FOUND' as const });
	}
};
