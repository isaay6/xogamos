// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { getSettings } from '../../../../lib/server/services/admin';
import { requireAdminPage } from '../guard';
import { field, intField, mergeSettings } from '../form';
import { writeActivity } from '../../../../lib/server/services/activity-log';
import type { Actions, PageServerLoad } from './$types';

/** Antelación de cancelación que ofrece el selector, en horas. */
const HOURS = [0, 1, 2, 6, 12, 24, 48];

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const s = await getSettings(event.locals.db, municipality.id);
	return {
		hours: HOURS,
		cancelMinutes: s.cancellationDeadlineMinutes,
		maxDaysAhead: s.maxDaysAhead,
		noShowThreshold: s.noShowThreshold,
		penaltyDays: s.penaltyDays
	};
};

/** Rangos de la API (`PUT admin/settings`): el formulario no puede ser más estrecho ni más ancho. */
const MAX_DEADLINE_MINUTES = 10_080;

export const actions: Actions = {
	default: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const db = event.locals.db;
		// Un plazo guardado que no está en la lista (`m30`) se conserva tal cual, sin redondearlo.
		const raw = field(form, 'cancelHours').trim();
		let minutes: number | null = null;
		const kept = /^m(\d{1,5})$/.exec(raw);
		if (kept) {
			const current = (await getSettings(db, municipality.id)).cancellationDeadlineMinutes;
			if (Number(kept[1]) === current && current <= MAX_DEADLINE_MINUTES) minutes = current;
		} else {
			const hours = intField(form, 'cancelHours', 0, 48);
			if (hours !== null && HOURS.includes(hours)) minutes = hours * 60;
		}
		const maxDaysAhead = intField(form, 'maxDaysAhead', 1, 90);
		const noShowThreshold = intField(form, 'noShowThreshold', 1, 10);
		const penaltyDays = intField(form, 'penaltyDays', 0, 90);
		if (
			minutes === null ||
			maxDaysAhead === null ||
			noShowThreshold === null ||
			penaltyDays === null
		)
			return fail(400, { error: 'INVALID' });
		const saved = await mergeSettings(db, municipality.id, {
			cancellationDeadlineMinutes: minutes,
			maxDaysAhead,
			noShowThreshold,
			penaltyDays
		});
		if (!saved) return fail(404, { error: 'NOT_FOUND' });
		await writeActivity(db, {
			municipalityId: municipality.id,
			actorId: user.id,
			kind: 'rules_saved',
			params: {}
		});
		return { saved: true };
	}
};
