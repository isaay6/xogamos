// SPDX-License-Identifier: EUPL-1.2
import { error, fail } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import {
	facilities,
	municipalityProfiles,
	waitlistEntries
} from '../../../../lib/server/db/schema';
import { localDateOf, localDateTimeToUtc, localTimeOf } from '../../../../lib/server/domain/time';
import { loadDayAvailability } from '../../../../lib/server/services/bookings';
import { ensureProfile } from '../../../../lib/server/services/profiles';
import { dayStrip, hoursForDay, listSports } from '../../../../lib/server/services/search';
import { joinWaitlist, suggestAlternatives } from '../../../../lib/server/services/waitlist';
import { parseDate, requireMunicipality } from '../../municipality.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	const sports = await listSports(locals.db, municipality.id);
	const sport = sports.find((s) => s.typeId === params.typeId);
	if (!sport) error(404);

	const now = locals.now();
	const days = await dayStrip(locals.db, municipality.id, sport.typeId, now);
	// `?date=` solo vale si está en la tira; si no, el primer día con hueco (o el primero).
	const asked = parseDate(url.searchParams.get('date'));
	const date =
		days.find((d) => d.date === asked)?.date ??
		days.find((d) => !d.full)?.date ??
		days[0]?.date ??
		null;
	if (!date) error(404);

	const hours = await hoursForDay(locals.db, municipality.id, sport.typeId, date, now);
	// Para unha hora completa gardamos unha instalación concreta: a cola é por instalación,
	// non polo deporte. Só se amosan as que de verdade están completas, nunca un peche.
	const candidates = await locals.db
		.select()
		.from(facilities)
		.where(
			and(
				eq(facilities.municipalityId, municipality.id),
				eq(facilities.typeId, sport.typeId),
				eq(facilities.active, true)
			)
		);
	const waitlistSlots: Record<string, { facilityId: string; startsAt: string }> = {};
	for (const hour of hours.filter((value) => !value.free && !value.closed && !value.past)) {
		const startsAt = localDateTimeToUtc(date, hour.time);
		for (const facility of candidates) {
			const slots = await loadDayAvailability(locals.db, facility, sport.bookingMode, date);
			const slot = slots.find((value) => value.startsAt.getTime() === startsAt.getTime());
			const full =
				sport.bookingMode === 'unit'
					? slot?.freeUnits.length === 0
					: sport.bookingMode === 'capacity'
						? slot?.remainingSeats === 0
						: !slot?.free;
			if (slot && full) {
				waitlistSlots[hour.time] = { facilityId: facility.id, startsAt: startsAt.toISOString() };
				break;
			}
		}
	}
	const suggested =
		hours.length > 0 && hours.every((hour) => !hour.free) && candidates[0]
			? await suggestAlternatives(locals.db, {
					municipalityId: municipality.id,
					facilityId: candidates[0].id,
					date,
					now
				})
			: [];
	const suggestions = suggested.map((suggestion) => ({
		...suggestion,
		date: localDateOf(suggestion.startsAt),
		time: localTimeOf(suggestion.startsAt)
	}));
	// Horas do día nas que esta persoa xa espera, para non ofrecerlle apuntarse outra vez.
	const waitingTimes: string[] = [];
	if (locals.user && candidates.length > 0) {
		const [profile] = await locals.db
			.select({ id: municipalityProfiles.id })
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.municipalityId, municipality.id),
					eq(municipalityProfiles.userId, locals.user.id)
				)
			);
		if (profile) {
			const entries = await locals.db
				.select({ startsAt: waitlistEntries.startsAt })
				.from(waitlistEntries)
				.where(
					and(
						eq(waitlistEntries.profileId, profile.id),
						inArray(waitlistEntries.status, ['waiting', 'offered']),
						inArray(
							waitlistEntries.facilityId,
							candidates.map((c) => c.id)
						)
					)
				);
			for (const e of entries)
				if (localDateOf(e.startsAt) === date) waitingTimes.push(localTimeOf(e.startsAt));
		}
	}
	return { sport, days, date, hours, waitlistSlots, waitingTimes, suggestions };
};

export const actions: Actions = {
	waitlist: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'LOGIN_REQUIRED' });
		const form = await request.formData();
		const value = form.get('waitlist');
		if (typeof value !== 'string') return fail(422, { error: 'NOT_ALIGNED' });
		const [facilityId, startsAt] = value.split('|');
		const date = startsAt ? new Date(startsAt) : null;
		if (!facilityId || !date || Number.isNaN(date.getTime()))
			return fail(422, { error: 'NOT_ALIGNED' });
		const municipality = await requireMunicipality(locals.db, params.slug);
		const profile = await ensureProfile(locals.db, municipality.id, locals.user.id);
		const result = await joinWaitlist(locals.db, {
			municipalityId: municipality.id,
			facilityId,
			profileId: profile.id,
			startsAt: date,
			now: locals.now()
		});
		return result.ok ? { joined: true } : fail(409, { error: result.error });
	}
};
