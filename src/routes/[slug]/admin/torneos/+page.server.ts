// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { facilities, tournaments } from '../../../../lib/server/db/schema';
import { localDateOf, localDateTimeToUtc, localTimeOf } from '../../../../lib/server/domain/time';
import {
	cancelTournament,
	createTournament,
	updateTournament
} from '../../../../lib/server/services/tournaments';
import { requireAdminPage } from '../guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const [rows, venueRows] = await Promise.all([
		event.locals.db
			.select()
			.from(tournaments)
			.where(eq(tournaments.municipalityId, municipality.id)),
		event.locals.db
			.select({ id: facilities.id, name: facilities.name })
			.from(facilities)
			.where(eq(facilities.municipalityId, municipality.id))
	]);
	return {
		rows: rows.map((row) => ({
			...row,
			signupDeadlineLocal: `${localDateOf(row.signupDeadline)}T${localTimeOf(row.signupDeadline)}`
		})),
		facilities: venueRows
	};
};

export const actions: Actions = {
	crear: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const deadlineValue = String(form.get('signupDeadline') ?? '');
		const deadline = localDateTimeToUtc(deadlineValue.slice(0, 10), deadlineValue.slice(11, 16));
		const result = await createTournament(event.locals.db, municipality.id, user.id, {
			title: String(form.get('title') ?? ''),
			sportDescription: String(form.get('sportDescription') ?? ''),
			startsOn: String(form.get('startsOn') ?? ''),
			endsOn: String(form.get('endsOn') ?? ''),
			description: String(form.get('description') ?? ''),
			rules: String(form.get('rules') ?? ''),
			format: String(form.get('format') ?? 'individual') as 'individual' | 'parellas' | 'equipos',
			teamSize: Number(form.get('teamSize') ?? '') || null,
			maxEntries: Number(form.get('maxEntries') ?? 0),
			signupDeadline: deadline,
			feeCents: Math.round(Number(form.get('feeEuros') ?? 0) * 100),
			facilityId: String(form.get('facilityId') ?? '')
		});
		return result.ok ? { created: true as const } : fail(400, { error: result.error });
	},
	editar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const deadlineValue = String(form.get('signupDeadline') ?? '');
		const deadline = localDateTimeToUtc(deadlineValue.slice(0, 10), deadlineValue.slice(11, 16));
		const result = await updateTournament(
			event.locals.db,
			municipality.id,
			user.id,
			String(form.get('id') ?? ''),
			{
				title: String(form.get('title') ?? ''),
				sportDescription: String(form.get('sportDescription') ?? ''),
				startsOn: String(form.get('startsOn') ?? ''),
				endsOn: String(form.get('endsOn') ?? ''),
				description: String(form.get('description') ?? ''),
				rules: String(form.get('rules') ?? ''),
				format: String(form.get('format') ?? 'individual') as 'individual' | 'parellas' | 'equipos',
				teamSize: Number(form.get('teamSize') ?? '') || null,
				maxEntries: Number(form.get('maxEntries') ?? 0),
				signupDeadline: deadline,
				feeCents: Math.round(Number(form.get('feeEuros') ?? 0) * 100),
				facilityId: String(form.get('facilityId') ?? '')
			}
		);
		return result.ok ? { updated: true as const } : fail(400, { error: result.error });
	},
	cancelar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const id = String((await event.request.formData()).get('id') ?? '');
		const result = await cancelTournament(
			event.locals.db,
			municipality.id,
			user.id,
			id,
			event.locals.now()
		);
		return result.ok ? { cancelled: true as const } : fail(404, { error: result.error });
	}
};
