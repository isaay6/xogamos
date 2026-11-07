// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { addLocalDays, localDateTimeToUtc } from '../../../../../lib/server/domain/time';
import { getAvailability, rescheduleBooking } from '../../../../../lib/server/services/bookings';
import { getMaxDaysAhead, rescheduleSlots } from '../../../../../lib/server/services/reservar';
import { formatTime } from '../../../../../lib/ui/format';
import { clampDate, parseDate, parseTime } from '../../../municipality.server';
import { facilityData, loadOwn } from '../own.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const own = await loadOwn(event);
	const { municipality, booking, now, today } = own;
	// Solo se cambia una reserva confirmada y sin empezar, y dentro del plazo.
	if (!own.editable || !own.inTime) redirect(303, `/${municipality.slug}/reserva/${booking.id}`);

	const { db } = event.locals;
	const maxDaysAhead = await getMaxDaysAhead(db, municipality.id);
	const dates = Array.from({ length: maxDaysAhead + 1 }, (_, i) => addLocalDays(today, i));
	const perDay = await Promise.all(
		dates.map(async (date) => ({
			date,
			slots: await rescheduleSlots(db, municipality.id, booking, date, now, maxDaysAhead)
		}))
	);
	const days = perDay.map((d) => ({ date: d.date, full: !d.slots.some((s) => s.free) }));

	// `?date=` dentro de la ventana; si no, el primer día con hueco (o hoy).
	const asked = parseDate(event.url.searchParams.get('date'));
	const date = asked
		? clampDate(asked, dates[0], dates[dates.length - 1])
		: (days.find((d) => !d.full)?.date ?? dates[0]);
	const slots = perDay.find((d) => d.date === date)?.slots ?? [];
	const capacity = own.ctx.bookingMode === 'capacity';
	const hours =
		own.ctx.bookingMode === 'day'
			? []
			: slots.map((s) => ({
					time: formatTime(s.startsAt),
					free: s.free,
					remainingSeats: capacity ? s.remainingSeats : null
				}));

	return {
		id: booking.id,
		facilityId: booking.facilityId,
		startsAt: booking.startsAt,
		unitIndex: booking.unitIndex,
		today,
		days,
		date,
		hours,
		facility: facilityData(own.ctx)
	};
};

const BUSY = new Set(['SLOT_UNAVAILABLE', 'UNIT_UNAVAILABLE', 'CAPACITY_EXCEEDED']);

export const actions: Actions = {
	default: async (event) => {
		const { municipality, booking, ctx, now } = await loadOwn(event);
		const data = await event.request.formData();
		const date = parseDate(String(data.get('date') ?? ''));
		if (!date) return fail(422, { error: 'SEN_HORA' });
		// En modo día no hay hora: la franja es la del día entero.
		const time = parseTime(String(data.get('time') ?? ''));
		if (!time && ctx.bookingMode !== 'day') return fail(422, { error: 'SEN_HORA' });
		let startsAt: Date;
		if (time) startsAt = localDateTimeToUtc(date, time);
		else {
			const day = await getAvailability(event.locals.db, municipality.id, booking.facilityId, date);
			const first = day.ok ? day.value[0] : undefined;
			if (!first) return fail(422, { error: 'SEN_HORA' });
			startsAt = first.startsAt;
		}

		// Elegir la franja que ya tiene no cambia nada.
		if (startsAt.getTime() === booking.startsAt.getTime()) {
			return fail(422, { error: 'MESMA' });
		}

		const result = await rescheduleBooking(event.locals.db, {
			municipalityId: municipality.id,
			bookingId: booking.id,
			startsAt,
			now
		});
		if (result.ok) redirect(303, `/${municipality.slug}/reserva/${result.value.id}/xa`);
		if (BUSY.has(result.error) || result.error === 'ALREADY_FINAL') {
			return fail(409, { error: BUSY.has(result.error) ? 'OCUPADO' : result.error });
		}
		return fail(422, { error: result.error });
	}
};
