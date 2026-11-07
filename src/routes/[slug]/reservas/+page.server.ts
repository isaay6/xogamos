// SPDX-License-Identifier: EUPL-1.2
import { bookingQrValue } from '../../../lib/server/auth/booking-qr-secret';
import {
	addLocalDays,
	addLocalMonths,
	isLocalDate,
	isLocalMonth,
	localDateOf,
	weekdayOf
} from '../../../lib/server/domain/time';
import { getProfile, listMyBookings } from '../../../lib/server/services/profiles';
import { listMyPasses } from '../../../lib/server/services/passes';
import { listMyTournamentEntries } from '../../../lib/server/services/tournaments';
import { requireMunicipality } from '../municipality.server';
import type { PageServerLoad } from './$types';

/** Hasta dónde deja avanzar el calendario: un año desde el mes actual. */
const MAX_MONTHS_AHEAD = 12;

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	// `?vista=` desconocida → lista.
	const vista: 'lista' | 'calendario' =
		url.searchParams.get('vista') === 'calendario' ? 'calendario' : 'lista';
	const now = locals.now();
	const todayDate = localDateOf(now);
	if (!locals.user)
		return {
			needsLogin: true,
			vista,
			todayDate,
			groups: [],
			calendar: null,
			passes: [],
			tournamentEntries: []
		};

	const profile = await getProfile(locals.db, municipality.id, locals.user.id);
	// Sin perfil todavía (no reservó nunca): lista vacía. Las que ya empezaron y no acabaron
	// siguen aquí: el PIN hace falta en la puerta aunque se llegue tarde.
	const rows = profile
		? await listMyBookings(locals.db, municipality.id, profile.id, {
				scope: 'upcoming',
				now,
				includeOngoing: true
			})
		: [];
	const [passes, tournamentEntries] = await Promise.all([
		profile ? listMyPasses(locals.db, municipality.id, profile.id, now) : [],
		listMyTournamentEntries(locals.db, municipality.id, locals.user.id)
	]);
	const items = rows.map((b) => ({
		id: b.id,
		code: b.accessCode,
		// El QR solo va en la lista; en el calendario la axenda enseña el PIN.
		qr: vista === 'lista' ? bookingQrValue(url, municipality.slug, b.id) : null,
		color: b.color,
		mascot: b.mascot,
		bookingMode: b.bookingMode,
		sportGl: b.typeNameGl,
		sportEs: b.typeNameEs,
		facilityName: b.facilityName,
		location: b.facilityLocation,
		unitIndex: b.unitIndex,
		startsAt: b.startsAt,
		endsAt: b.endsAt,
		// Día local de Madrid: una reserva a las 00:30 del día 1 es del día 1.
		date: localDateOf(b.startsAt)
	}));

	if (vista === 'lista') {
		// «Esta semana» llega hasta el domingo (la semana empieza en lunes).
		const sunday = addLocalDays(todayDate, 6 - weekdayOf(todayDate));
		const groups = [
			{ key: 'hoxe' as const, items: items.filter((b) => b.date <= todayDate) },
			{
				key: 'semana' as const,
				items: items.filter((b) => b.date > todayDate && b.date <= sunday)
			},
			{ key: 'adiante' as const, items: items.filter((b) => b.date > sunday) }
		];
		return {
			needsLogin: false,
			vista,
			todayDate,
			groups: groups.filter((g) => g.items.length > 0),
			calendar: null,
			passes: passes.map((p) => ({ ...p, qr: bookingQrValue(url, municipality.slug, p.id) })),
			tournamentEntries
		};
	}

	// Calendario: solo el mes actual o los siguientes (el pasado está en el historial).
	const currentMonth = todayDate.slice(0, 7);
	const lastMonth = addLocalMonths(currentMonth, MAX_MONTHS_AHEAD);
	const mes = url.searchParams.get('mes');
	const month = isLocalMonth(mes) && mes >= currentMonth && mes <= lastMonth ? mes : currentMonth;
	const inMonth = items.filter((b) => b.date.startsWith(month));
	const days: Record<string, { mascot: string; color: string }[]> = {};
	// Leyenda: cada deporte una vez, en el orden en que aparece.
	const legend = new Map<string, { color: string; mascot: string; gl: string; es: string }>();
	for (const b of inMonth) {
		(days[b.date] ??= []).push({ mascot: b.mascot, color: b.color });
		if (!legend.has(b.sportGl))
			legend.set(b.sportGl, { color: b.color, mascot: b.mascot, gl: b.sportGl, es: b.sportEs });
	}

	// `?dia=` vale si es un día de ese mes desde hoy; si no, el primero con reservas desde hoy (una
	// en curso que empezó ayer no cuenta: su día ya pasó).
	const dia = url.searchParams.get('dia');
	const selected =
		isLocalDate(dia) && dia.startsWith(month) && dia >= todayDate
			? dia
			: (inMonth.find((b) => b.date >= todayDate)?.date ??
				(month === currentMonth ? todayDate : `${month}-01`));

	return {
		needsLogin: false,
		vista,
		todayDate,
		groups: [],
		calendar: {
			month,
			prev: month > currentMonth ? addLocalMonths(month, -1) : null,
			next: month < lastMonth ? addLocalMonths(month, 1) : null,
			selected,
			days,
			legend: [...legend.values()],
			agenda: inMonth.filter((b) => b.date === selected)
		},
		passes: [],
		tournamentEntries: []
	};
};
