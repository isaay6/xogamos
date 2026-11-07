// SPDX-License-Identifier: EUPL-1.2
import { error, redirect } from '@sveltejs/kit';
import { GENERAL, priceFor } from '../../../../../lib/server/domain/policies';
import { addLocalDays, localDateOf } from '../../../../../lib/server/domain/time';
import { getProfile } from '../../../../../lib/server/services/profiles';
import { getMaxDaysAhead } from '../../../../../lib/server/services/reservar';
import {
	accessibilitySheets,
	alternatives,
	freeOptions,
	listSports
} from '../../../../../lib/server/services/search';
import { clampDate, parseDate, parseTime, requireMunicipality } from '../../../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	const sports = await listSports(locals.db, municipality.id);
	const sport = sports.find((s) => s.typeId === params.typeId);
	if (!sport) error(404);

	const now = locals.now();
	const today = localDateOf(now);
	const asked = parseDate(url.searchParams.get('date')) ?? today;
	// Fuera de la ventana de reserva no se busca: se lleva al día más cercano que sí vale.
	const last = addLocalDays(today, await getMaxDaysAhead(locals.db, municipality.id));
	const date = clampDate(asked, today, last);
	if (date !== url.searchParams.get('date')) {
		const fixed = new URLSearchParams(url.searchParams);
		fixed.set('date', date);
		redirect(303, `${url.pathname}?${fixed}`);
	}
	// En modo `day` la hora no cuenta.
	const time = sport.bookingMode === 'day' ? null : parseTime(url.searchParams.get('time'));
	const options = await freeOptions(locals.db, municipality.id, sport.typeId, date, time, now);
	const sheets = await accessibilitySheets(locals.db, municipality.id, [
		...new Set(options.map((option) => option.facilityId))
	]);
	const optionsWithAccessibility = options.flatMap((option) => {
		const sheet = sheets.get(option.facilityId);
		return sheet ? [{ ...option, ...sheet }] : [];
	});
	const alts =
		options.length === 0
			? await alternatives(locals.db, municipality.id, sport.typeId, date, time, now)
			: [];

	// Precio según el perfil: con sesión, empadronada o no; sin sesión, `null` (los dos precios).
	// Con sesión, además, el precio de cada opción con su tarifa social (`priceFor`, como al guardar).
	let resident: boolean | null = null;
	let priced = optionsWithAccessibility.map((o) => ({ ...o, priceCents: null as number | null }));
	if (locals.user) {
		const profile = await getProfile(locals.db, municipality.id, locals.user.id);
		resident = profile?.isResident ?? false;
		priced = optionsWithAccessibility.map((o) => ({
			...o,
			priceCents: priceFor(o, profile ?? GENERAL, 1)
		}));
	}

	return {
		sport,
		sports,
		date,
		time,
		today,
		options: priced,
		alternatives: alts,
		resident,
		cheo: url.searchParams.get('cheo') === '1'
	};
};
