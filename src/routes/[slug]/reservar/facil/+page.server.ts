// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { localDateOf } from '../../../../lib/server/domain/time';
import { getProfile } from '../../../../lib/server/services/profiles';
import { dayStrip, freeOptions, hoursForDay, listSports } from '../../../../lib/server/services/search';
import { parseDate, parseTime, requireMunicipality } from '../../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const user = requirePageUser({ locals, params, url });
	const municipality = await requireMunicipality(locals.db, params.slug);
	const [profile, sports] = await Promise.all([
		getProfile(locals.db, municipality.id, user.id),
		listSports(locals.db, municipality.id)
	]);
	if (!profile) redirect(303, `/${municipality.slug}/eu`);
	const typeId = url.searchParams.get('tipo') ?? '';
	const sport = sports.find((s) => s.typeId === typeId) ?? null;
	const now = locals.now();
	const days = sport ? (await dayStrip(locals.db, municipality.id, sport.typeId, now)).slice(0, 7) : [];
	const date = sport ? parseDate(url.searchParams.get('date')) : null;
	const selectedDate = date && days.some((d) => d.date === date) ? date : null;
	const time = sport && selectedDate ? parseTime(url.searchParams.get('time')) : null;
	const hours = sport && selectedDate ? await hoursForDay(locals.db, municipality.id, sport.typeId, selectedDate, now) : [];
	const free = sport && selectedDate && time ? await freeOptions(locals.db, municipality.id, sport.typeId, selectedDate, time, now) : [];
	const first = free[0];
	const confirm = first
		? `/${municipality.slug}/confirmar?${new URLSearchParams({
				facility: first.facilityId,
				startsAt: first.startsAt.toISOString(),
				...(first.unitIndex === null ? {} : { unit: String(first.unitIndex) }),
				easy: '1'
			})}`
		: null;
	if (confirm) redirect(303, confirm);
	return { sports, sport, days, selectedDate, hours, time, confirm, today: localDateOf(now) };
};
