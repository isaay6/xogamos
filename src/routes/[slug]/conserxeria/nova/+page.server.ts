// SPDX-License-Identifier: EUPL-1.2
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { GENERAL, priceFor } from '../../../../lib/server/domain/policies';
import { localDateOf } from '../../../../lib/server/domain/time';
import { createBooking } from '../../../../lib/server/services/bookings';
import { municipalities } from '../../../../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { listMyBookings } from '../../../../lib/server/services/profiles';
import {
	dayStrip,
	freeOptions,
	hoursForDay,
	listSports
} from '../../../../lib/server/services/search';
import { dniSecret } from '../../../../lib/server/auth/dni-secret';
import { dniLetterOk, normalizeDni } from '../../../../lib/server/domain/dni';
import {
	createLocalPerson,
	getBookingReceipt,
	getPersonDetail
} from '../../../../lib/server/services/staff';
import { buscarAction, confirmarDniAction } from '../busca';
import { deskContext, UUID } from '../guard';
import type { Actions, PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const personForm = z.object({
	nome: z.string().trim().min(2).max(120),
	telefono: z
		.string()
		.trim()
		.regex(/^\+?[\d ]{6,20}$/)
});

const optionForm = z.object({
	facilityId: z.string().regex(UUID),
	unitIndex: z.union([z.literal(''), z.string().regex(/^\d{1,3}$/)]),
	startsAt: z.iso.datetime()
});

/** `facilityId|unidade|instante ISO`: lo que lleva el radio de cada opción libre. */
const optionValue = (facilityId: string, unitIndex: number | null, startsAt: Date) =>
	`${facilityId}|${unitIndex ?? ''}|${startsAt.toISOString()}`;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await deskContext(event);
	const { db } = event.locals;
	const now = event.locals.now();
	const params = event.url.searchParams;

	let person = null;
	let lastBooking = null;
	const persoa = params.get('persoa');
	if (persoa !== null) {
		if (!UUID.test(persoa)) error(404);
		person = await getPersonDetail(db, municipality.id, persoa);
		if (!person) error(404);
		const past = await listMyBookings(db, municipality.id, persoa, { scope: 'past', now });
		const last = past.find((b) => b.status !== 'cancelled');
		lastBooking = last ? { facilityName: last.facilityName, startsAt: last.startsAt } : null;
	}

	const sports = await listSports(db, municipality.id);
	const tipo = params.get('tipo') ?? '';
	const sport = sports.find((s) => s.typeId === tipo) ?? null;

	let days: Awaited<ReturnType<typeof dayStrip>> = [];
	let hours: Awaited<ReturnType<typeof hoursForDay>> = [];
	let options: {
		value: string;
		facilityName: string;
		location: string;
		unitIndex: number | null;
		remainingSeats: number | null;
		startsAt: string;
		endsAt: string;
		priceCents: number;
	}[] = [];
	let date = localDateOf(now);
	let time: string | null = null;
	if (sport) {
		days = await dayStrip(db, municipality.id, sport.typeId, now);
		const wanted = params.get('date') ?? '';
		date =
			DATE.test(wanted) && days.some((d) => d.date === wanted) ? wanted : (days[0]?.date ?? date);
		hours = await hoursForDay(db, municipality.id, sport.typeId, date, now);
		const wantedTime = params.get('time') ?? '';
		time = TIME.test(wantedTime) && hours.some((h) => h.time === wantedTime) ? wantedTime : null;
		if (time !== null || sport.bookingMode === 'day') {
			const free = await freeOptions(db, municipality.id, sport.typeId, date, time, now);
			options = free.map((o) => ({
				value: optionValue(o.facilityId, o.unitIndex, o.startsAt),
				facilityName: o.facilityName,
				location: o.location,
				unitIndex: o.unitIndex,
				remainingSeats: o.remainingSeats,
				startsAt: o.startsAt.toISOString(),
				endsAt: o.endsAt.toISOString(),
				// El mismo cálculo que al guardar la reserva (categoría comprobada por el personal).
				priceCents: priceFor(o, person ?? GENERAL, 1)
			}));
		}
	}

	const [policy] = await db
		.select({
			cancellationMinutes: municipalities.cancellationDeadlineMinutes,
			noShowThreshold: municipalities.noShowThreshold,
			penaltyDays: municipalities.penaltyDays,
			maxDaysAhead: municipalities.maxDaysAhead
		})
		.from(municipalities)
		.where(eq(municipalities.id, municipality.id));

	return {
		person,
		lastBooking,
		sports,
		sport,
		days,
		hours,
		date,
		time,
		options,
		selected: params.get('opcion') ?? '',
		rules: policy
	};
};

export const actions: Actions = {
	// La búsqueda es POST: nombres, teléfonos y DNI no deben quedar en la URL ni en los registros.
	buscar: async (event) => {
		const { municipality } = await deskContext(event);
		return buscarAction(event, municipality.id);
	},
	confirmarDni: async (event) => {
		const { municipality } = await deskContext(event);
		return confirmarDniAction(event, municipality);
	},

	novaPersoa: async (event) => {
		const { municipality } = await deskContext(event);
		const data = await event.request.formData();
		const echo = {
			nome: String(data.get('nome') ?? ''),
			telefono: String(data.get('telefono') ?? ''),
			dni: String(data.get('dni') ?? '')
		};
		const parsed = personForm.safeParse({ nome: data.get('nome'), telefono: data.get('telefono') });
		if (!parsed.success) return fail(400, { novaPersoaError: true, ...echo });
		// DNI opcional: se se escribe, enteiro e coa letra correcta.
		const rawDni = echo.dni.trim();
		const dni = rawDni ? normalizeDni(rawDni) : null;
		const secret = dniSecret();
		if (rawDni && (!dni || !dniLetterOk(dni) || !secret)) {
			return fail(400, { novaPersoaError: true, dniError: true, ...echo });
		}
		const created = await createLocalPerson(
			event.locals.db,
			municipality.id,
			{
				displayName: parsed.data.nome,
				phone: parsed.data.telefono,
				...(dni ? { dni } : {})
			},
			secret ?? undefined
		);
		if (!created.ok) return fail(409, { novaPersoaError: true, error: created.error, ...echo });
		redirect(303, `${event.url.pathname}?persoa=${created.value.profileId}`);
	},

	reservar: async (event) => {
		const { municipality, user } = await deskContext(event);
		const { db } = event.locals;
		const data = await event.request.formData();
		const persoa = String(data.get('persoa') ?? '');
		if (!UUID.test(persoa)) error(404);
		const person = await getPersonDetail(db, municipality.id, persoa);
		if (!person) error(404);

		const [facilityId, unitIndex, startsAt] = String(data.get('opcion') ?? '').split('|');
		const option = optionForm.safeParse({ facilityId, unitIndex, startsAt });
		if (!option.success) return fail(422, { error: 'NO_OPTION' });

		const canle = data.get('canle') === 'desk' ? 'desk' : 'phone';
		const seatsRaw = String(data.get('seats') ?? '').trim();
		const seats =
			/^\d{1,4}$/.test(seatsRaw) && Number(seatsRaw) >= 1 ? Number(seatsRaw) : undefined;

		const result = await createBooking(db, {
			municipalityId: municipality.id,
			facilityId: option.data.facilityId,
			profileId: person.profileId,
			startsAt: new Date(option.data.startsAt),
			unitIndex: option.data.unitIndex === '' ? undefined : Number(option.data.unitIndex),
			seats,
			channel: canle,
			createdByUserId: user.id,
			now: event.locals.now()
		});
		if (!result.ok) return fail(422, { error: result.error });
		const receipt = await getBookingReceipt(db, municipality.id, result.value.id);
		if (!receipt) error(404);
		return {
			booked: {
				id: receipt.id,
				accessCode: receipt.accessCode,
				facilityName: receipt.facilityName,
				color: receipt.color,
				displayName: receipt.displayName,
				startsAt: receipt.startsAt.toISOString(),
				endsAt: receipt.endsAt.toISOString(),
				priceCents: receipt.priceCents
			}
		};
	}
};
