// SPDX-License-Identifier: EUPL-1.2
import { isLocalMonth, localDateOf } from '../../../../lib/server/domain/time';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import {
	getProfile,
	HISTORY_STATES,
	historyState,
	listMyBookings,
	type HistoryState
} from '../../../../lib/server/services/profiles';
import { requireMunicipality } from '../../municipality.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const now = event.locals.now();
	// Filtros de la URL; un valor que no se entiende se ignora (sin error).
	const mesParam = event.url.searchParams.get('mes');
	const estadoParam = event.url.searchParams.get('estado');
	const mes = isLocalMonth(mesParam) ? mesParam : null;
	const estado = (HISTORY_STATES as readonly string[]).includes(estadoParam ?? '')
		? (estadoParam as HistoryState)
		: null;

	const profile = await getProfile(event.locals.db, municipality.id, user.id);
	const list = (filters: { month?: string; status?: HistoryState }) =>
		profile
			? listMyBookings(event.locals.db, municipality.id, profile.id, {
					scope: 'all',
					now,
					...filters
				})
			: Promise.resolve([]);
	// Todas (para los meses y los contadores) y las filtradas (la lista).
	const [every, rows] = await Promise.all([
		list({}),
		mes || estado ? list({ month: mes ?? undefined, status: estado ?? undefined }) : null
	]);

	// Meses locales (Europe/Madrid) con reservas, del más reciente al más antiguo.
	const monthOf = (d: Date) => localDateOf(d).slice(0, 7);
	const monthOptions = [...new Set(every.map((b) => monthOf(b.startsAt)))];
	if (mes && !monthOptions.includes(mes)) monthOptions.push(mes);
	monthOptions.sort().reverse();

	// Contadores de cada estado dentro del mes escogido (o de todos).
	const counts: Record<'todas' | HistoryState, number> = {
		todas: 0,
		proxima: 0,
		feita: 0,
		non_fuches: 0,
		cancelada: 0
	};
	for (const b of every) {
		if (mes && monthOf(b.startsAt) !== mes) continue;
		counts.todas++;
		counts[historyState(b.status, b.endsAt, now)]++;
	}

	// Ya vienen de más reciente a más antigua; se agrupan por mes local.
	const months: {
		month: string;
		items: {
			id: string;
			state: HistoryState;
			mascot: string;
			color: string;
			sportGl: string;
			sportEs: string;
			facilityName: string;
			unitIndex: number | null;
			bookingMode: (typeof every)[number]['bookingMode'];
			startsAt: Date;
		}[];
	}[] = [];
	for (const b of rows ?? every) {
		const month = monthOf(b.startsAt);
		let group = months.find((m) => m.month === month);
		if (!group) {
			group = { month, items: [] };
			months.push(group);
		}
		group.items.push({
			id: b.id,
			state: historyState(b.status, b.endsAt, now),
			mascot: b.mascot,
			color: b.color,
			sportGl: b.typeNameGl,
			sportEs: b.typeNameEs,
			facilityName: b.facilityName,
			unitIndex: b.unitIndex,
			bookingMode: b.bookingMode,
			startsAt: b.startsAt
		});
	}
	return { months, monthOptions, counts, filters: { mes, estado } };
};
