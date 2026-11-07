// SPDX-License-Identifier: EUPL-1.2
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { TZDate } from '@date-fns/tz';
import { municipalities } from '../../../lib/server/db/schema';
import { requirePageStaff } from '../../../lib/server/http/page-guards';
import { addLocalDays, localDateOf, TZ } from '../../../lib/server/domain/time';
import { cancelBooking, markAttended, markNoShow } from '../../../lib/server/services/bookings';
import { getMunicipalityShell } from '../../../lib/server/services/municipalities';
import { getAgenda, getAgendaHours, getOpenMinutes } from '../../../lib/server/services/staff';
import { closuresToday } from '../../../lib/server/services/closure-status';
import type { Actions, PageServerLoad } from './$types';
import { dayParam } from './dates';
import { busyMinutes, levelOf, weekOf } from './week';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function municipalityOf(event: Pick<RequestEvent, 'locals' | 'params' | 'url'>) {
	const municipality = await getMunicipalityShell(event.locals.db, event.params.slug ?? '');
	if (!municipality) error(404);
	await requirePageStaff(event, municipality.id, ['conserxe', 'apertura']);
	return municipality;
}

const minuteOf = (instant: Date) => {
	const local = new TZDate(instant.getTime(), TZ);
	return local.getHours() * 60 + local.getMinutes();
};

export const load: PageServerLoad = async (event) => {
	const { db } = event.locals;
	const municipality = await municipalityOf(event);
	const now = event.locals.now();
	const today = localDateOf(now);
	const date = dayParam(event.url.searchParams.get('dia'), today);
	const vista = event.url.searchParams.get('vista') === 'semana' ? 'semana' : 'dia';

	const all = await getAgenda(db, municipality.id, date);
	const closures = await closuresToday(
		db,
		all.map((f) => f.facilityId),
		date
	);
	const facilityOptions = all.map((f) => ({
		facilityId: f.facilityId,
		facilityName: f.facilityName,
		mascot: f.mascot,
		color: f.color,
		closure: closures.get(f.facilityId) ?? null
	}));
	// Filtro de instalaciones: solo cuentan los ids que son de este concello; ninguno = todas.
	const known = new Set(all.map((f) => f.facilityId));
	let selected = [...new Set(event.url.searchParams.getAll('inst'))].filter(
		(id) => UUID.test(id) && known.has(id)
	);
	// Todas marcadas é o mesmo que ningunha: sen filtro (e o menú non se ensina activo).
	if (selected.length === known.size) selected = [];
	const shown = (f: { facilityId: string }) =>
		selected.length === 0 || selected.includes(f.facilityId);

	const common = { today, date, vista, facilityOptions, selected };

	if (vista === 'semana') {
		const days = weekOf(date);
		// Una agenda por día local: cada una con sus propios límites (el día del cambio de hora
		// dura 25 h), así que cada reserva sale una sola vez, en su día.
		const others = days.filter((d) => d !== date);
		const agendas = await Promise.all(others.map((d) => getAgenda(db, municipality.id, d)));
		const byDate = new Map([[date, all], ...others.map((d, i) => [d, agendas[i]] as const)]);
		const open = await getOpenMinutes(db, municipality.id, days);
		const rows = facilityOptions.filter(shown).map((f) => ({
			...f,
			cells: days.map((d) => {
				const group = byDate.get(d)?.find((g) => g.facilityId === f.facilityId);
				// Con varias unidades, minutos e apertura son por unidade (media).
				const minutes = group ? busyMinutes(group) : 0;
				const possible = open.get(f.facilityId)?.get(d) ?? 0;
				return { date: d, minutes, possible, level: levelOf(minutes, possible) };
			})
		}));
		return {
			...common,
			prev: addLocalDays(date, -7),
			next: addLocalDays(date, 7),
			week: {
				days: days.map((d) => ({ date: d, isToday: d === today, isPast: d < today })),
				rows
			},
			facilities: [],
			startMinute: 0,
			endMinute: 0,
			nowMinute: null,
			now,
			summary: null,
			panel: null
		};
	}

	const open = await getOpenMinutes(db, municipality.id, [date]);
	const facilities = all
		.filter(shown)
		.map((f) => ({ ...f, closed: (open.get(f.facilityId)?.get(date) ?? 0) === 0 }));

	const hours = await getAgendaHours(db, municipality.id, date);
	// Que ninguna reserva ni temporada quede fuera de la columna; lo que pasa de medianoche
	// (p. ej. 23:30–00:30) estira la columna hasta las 24:00.
	let { startMinute, endMinute } = hours;
	for (const f of all) {
		for (const b of [...f.bookings, ...f.seasons]) {
			startMinute = Math.min(startMinute, Math.floor(minuteOf(b.startsAt) / 60) * 60);
			const end = localDateOf(b.endsAt) > date ? 24 * 60 : minuteOf(b.endsAt);
			endMinute = Math.max(endMinute, Math.ceil(end / 60) * 60);
		}
	}

	const live = facilities.flatMap((f) => f.bookings).filter((b) => b.status !== 'cancelled');
	const summary = {
		reservas: live.length,
		telefono: live.filter((b) => b.channel !== 'online').length,
		nonVeu: live.filter((b) => b.status === 'no_show').length
	};

	let panel = null;
	const reserva = event.url.searchParams.get('reserva');
	if (reserva !== null) {
		if (!UUID.test(reserva)) error(404);
		const group = all.find((f) => f.bookings.some((b) => b.id === reserva));
		const booking = group?.bookings.find((b) => b.id === reserva);
		if (!group || !booking) error(404);
		const [policy] = await db
			.select({ noShowThreshold: municipalities.noShowThreshold })
			.from(municipalities)
			.where(eq(municipalities.id, municipality.id));
		const siblings =
			group.bookingMode === 'capacity'
				? group.bookings.filter(
						(b) =>
							b.id !== booking.id &&
							b.status !== 'cancelled' &&
							b.startsAt.getTime() === booking.startsAt.getTime()
					)
				: [];
		panel = {
			...booking,
			facilityName: group.facilityName,
			mascot: group.mascot,
			color: group.color,
			bookingMode: group.bookingMode,
			noShowThreshold: policy?.noShowThreshold ?? 3,
			siblings: siblings.map((b) => ({ id: b.id, displayName: b.displayName, seats: b.seats }))
		};
	}

	return {
		...common,
		prev: addLocalDays(date, -1),
		next: addLocalDays(date, 1),
		week: null,
		facilities,
		startMinute,
		endMinute,
		nowMinute: date === today ? minuteOf(now) : null,
		now,
		summary,
		panel
	};
};

type Run = (
	db: Parameters<typeof markAttended>[0],
	input: { municipalityId: string; bookingId: string; now: Date }
) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;

async function run(event: Parameters<Actions[string]>[0], name: string, fn: Run) {
	const municipality = await municipalityOf(event);
	const id = event.url.searchParams.get('reserva') ?? '';
	if (!UUID.test(id)) error(404);
	const result = await fn(event.locals.db, {
		municipalityId: municipality.id,
		bookingId: id,
		now: event.locals.now()
	});
	if (!result.ok) {
		if (result.error === 'NOT_FOUND') error(404);
		// Motivo de cancelación vacío o largo: sigue en «Seguro?» para corregirlo.
		if (result.error === 'VALIDATION_FAILED') {
			return fail(400, { confirmCancel: id, error: result.error });
		}
		return fail(422, { error: result.error });
	}
	return { done: name };
}

export const actions: Actions = {
	chegou: async (event) => {
		const municipality = await municipalityOf(event);
		await requirePageStaff(event, municipality.id, ['conserxe']);
		return run(event, 'chegou', markAttended);
	},
	nonVeu: async (event) => {
		const municipality = await municipalityOf(event);
		await requirePageStaff(event, municipality.id, ['conserxe']);
		return run(event, 'nonVeu', markNoShow);
	},
	// Lo hace el personal: puede cancelar fuera de plazo. Pide una segunda confirmación (sin JS
	// también): el primer envío devuelve `confirmCancel` y la página enseña «Seguro?».
	cancelar: async (event) => {
		const municipality = await municipalityOf(event);
		// Quen só abre a instalación (apertura) ve a axenda pero non cancela reservas.
		await requirePageStaff(event, municipality.id, ['conserxe']);
		const form = await event.request.formData().catch(() => null);
		const id = event.url.searchParams.get('reserva') ?? '';
		if (!UUID.test(id)) error(404);
		if (form?.get('confirmar') !== '1') return fail(409, { confirmCancel: id });
		// Motivo obligatorio: lo valida el servicio (VALIDATION_FAILED → 400, sigue en «Seguro?»).
		const reason = String(form.get('motivo') ?? '');
		return run(event, 'cancelar', (db, input) =>
			cancelBooking(db, { ...input, byStaff: true, reason, actorId: event.locals.user!.id })
		);
	}
};
