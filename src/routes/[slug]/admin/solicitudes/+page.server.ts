// SPDX-License-Identifier: EUPL-1.2
import { fail, error } from '@sveltejs/kit';
import {
	askMoreInfo,
	approveRequest,
	listRequests,
	rejectRequest,
	requestConflicts
} from '../../../../lib/server/services/requests';
import { requireAdminPage } from '../guard';
import { field } from '../form';
import { isUuid } from '../instalacions/form';
import type { Actions, PageServerLoad } from './$types';

const status = (value: string) =>
	['pendente', 'mais_datos', 'aprobada', 'rexeitada', 'retirada'].includes(value)
		? (value as 'pendente' | 'mais_datos' | 'aprobada' | 'rexeitada' | 'retirada')
		: undefined;
const kind = (value: string) =>
	['tempada', 'evento', 'outro'].includes(value)
		? (value as 'tempada' | 'evento' | 'outro')
		: undefined;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const filters = {
		status: status(event.url.searchParams.get('estado') ?? ''),
		kind: kind(event.url.searchParams.get('tipo') ?? '')
	};
	const rows = await listRequests(event.locals.db, municipality.id, filters);
	const id = event.url.searchParams.get('id');
	const selected = id ? rows.find((row) => row.request.id === id) : null;
	if (id && !selected) error(404);
	const conflicts = selected
		? await requestConflicts(event.locals.db, municipality.id, selected.request, event.locals.now())
		: null;
	return { rows, filters, selected, conflicts: conflicts?.ok ? conflicts.value : [] };
};

export const actions: Actions = {
	aprobar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const id = field(form, 'id');
		if (!isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const result = await approveRequest(event.locals.db, municipality.id, user.id, id, {
			response: field(form, 'response'),
			cancelAffected: field(form, 'cancelAffected') === '1',
			now: event.locals.now()
		});
		return result.ok
			? { approved: true as const }
			: fail(result.error === 'CONFLICTS' ? 409 : 400, { error: result.error });
	},
	// Un só formulario co motivo: o botón decide se se rexeita ou se piden máis datos.
	responder: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const id = field(form, 'id');
		if (!isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const decide = field(form, 'decision') === 'rexeitar' ? rejectRequest : askMoreInfo;
		const result = await decide(
			event.locals.db,
			municipality.id,
			user.id,
			id,
			field(form, 'message'),
			event.locals.now()
		);
		if (!result.ok) return fail(400, { error: result.error });
		return field(form, 'decision') === 'rexeitar'
			? { rejected: true as const }
			: { asked: true as const };
	},
	rexeitar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		if (!isUuid(field(form, 'id'))) return fail(404, { error: 'NOT_FOUND' as const });
		const result = await rejectRequest(
			event.locals.db,
			municipality.id,
			user.id,
			field(form, 'id'),
			field(form, 'message'),
			event.locals.now()
		);
		return result.ok ? { rejected: true as const } : fail(400, { error: result.error });
	},
	maisDatos: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		if (!isUuid(field(form, 'id'))) return fail(404, { error: 'NOT_FOUND' as const });
		const result = await askMoreInfo(
			event.locals.db,
			municipality.id,
			user.id,
			field(form, 'id'),
			field(form, 'message'),
			event.locals.now()
		);
		return result.ok ? { asked: true as const } : fail(400, { error: result.error });
	}
};
