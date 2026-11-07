// SPDX-License-Identifier: EUPL-1.2
import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { facilities, requests } from '../../../../lib/server/db/schema';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { responsibleEntities } from '../../../../lib/server/services/entities';
import {
	createRequest,
	resendRequest,
	type RequestInput
} from '../../../../lib/server/services/requests';
import { requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

/** Número opcional do formulario: baleiro ou ausente é null, nunca 0. */
function optionalNumber(form: FormData, name: string): number | null {
	const raw = form.get(name);
	return raw === null || raw === '' ? null : Number(raw);
}

function input(form: FormData): RequestInput {
	const kind = String(form.get('kind') ?? 'outro') as RequestInput['kind'];
	return {
		kind,
		facilityId: String(form.get('facilityId') ?? '') || null,
		unitIndex: optionalNumber(form, 'unitIndex'),
		fromDate: String(form.get('fromDate') ?? ''),
		toDate: String(form.get('toDate') ?? ''),
		weekdays: form.getAll('weekdays').map(Number),
		startsTime: String(form.get('startsTime') ?? ''),
		endsTime: String(form.get('endsTime') ?? ''),
		title: String(form.get('title') ?? ''),
		description: String(form.get('description') ?? ''),
		people: optionalNumber(form, 'people'),
		phone: String(form.get('phone') ?? ''),
		entityId: String(form.get('entityId') ?? '') || null
	};
}

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const id = event.url.searchParams.get('id');
	const [facilityRows, entities, old] = await Promise.all([
		event.locals.db
			.select()
			.from(facilities)
			.where(and(eq(facilities.municipalityId, municipality.id), eq(facilities.active, true))),
		responsibleEntities(event.locals.db, municipality.id, user.id),
		id
			? event.locals.db
					.select()
					.from(requests)
					.where(
						and(
							eq(requests.id, id),
							eq(requests.userId, user.id),
							eq(requests.municipalityId, municipality.id)
						)
					)
			: []
	]);
	if (id && (!old[0] || old[0].status !== 'mais_datos')) error(404);
	return { facilities: facilityRows, entities, request: old[0] ?? null };
};

export const actions: Actions = {
	gardar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const requestInput = input(form);
		const id = String(form.get('id') ?? '');
		const result = id
			? await resendRequest(event.locals.db, municipality.id, user.id, id, requestInput)
			: await createRequest(event.locals.db, municipality.id, user.id, requestInput);
		if (!result.ok) return fail(result.error === 'NOT_FOUND' ? 404 : 422, { error: result.error });
		redirect(303, `/${event.params.slug}/solicitudes`);
	}
};
