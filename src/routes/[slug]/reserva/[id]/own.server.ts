// SPDX-License-Identifier: EUPL-1.2
// Reserva propia para detalle, cancelar y cambiar: sesión, concello y 404 si no es de la persona.
import { error, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { localDateOf } from '../../../../lib/server/domain/time';
import { canCancel } from '../../../../lib/server/domain/policies';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { getOwnBooking, getProfile } from '../../../../lib/server/services/profiles';
import { entities } from '../../../../lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getFacilityContext } from '../../../../lib/server/services/reservar';
import { requireMunicipality } from '../../municipality.server';

type Event = Pick<RequestEvent, 'params' | 'url' | 'locals'>;

export async function loadOwn(event: Event) {
	const user = requirePageUser(event);
	const { locals, params } = event;
	const municipality = await requireMunicipality(locals.db, params.slug!);
	// Recurso ajeno o inexistente → 404.
	if (!z.uuid().safeParse(params.id).success) error(404);
	const profile = await getProfile(locals.db, municipality.id, user.id);
	if (!profile) error(404);
	const booking = await getOwnBooking(locals.db, municipality.id, profile.id, params.id!);
	if (!booking) error(404);
	const ctx = await getFacilityContext(locals.db, municipality.id, booking.facilityId);
	if (!ctx) error(404);
	const [entity] = booking.entityId
		? await locals.db
				.select({ name: entities.name })
				.from(entities)
				.where(and(eq(entities.id, booking.entityId), eq(entities.municipalityId, municipality.id)))
		: [];
	const now = locals.now();
	return {
		user,
		municipality,
		profile,
		booking,
		entityName: entity?.name ?? null,
		ctx,
		now,
		today: localDateOf(now),
		/** Confirmada y sin empezar: se puede cambiar o cancelar. */
		editable: booking.status === 'confirmed' && booking.startsAt.getTime() > now.getTime(),
		/** Aún se puede cancelar o cambiar sin que cuente como falta. */
		inTime: canCancel(booking.startsAt, now, {
			cancellationDeadlineMinutes: ctx.cancellationDeadlineMinutes,
			maxDaysAhead: 0,
			noShowThreshold: 0,
			penaltyDays: 0
		})
	};
}

/** Datos de la instalación que usan las tres páginas. */
export function facilityData(ctx: Awaited<ReturnType<typeof loadOwn>>['ctx']) {
	return {
		name: ctx.facilityName,
		location: ctx.location,
		address: ctx.address,
		latitude: ctx.latitude,
		longitude: ctx.longitude,
		nameGl: ctx.nameGl,
		nameEs: ctx.nameEs,
		color: ctx.color,
		mascot: ctx.mascot,
		bookingMode: ctx.bookingMode,
		rules: ctx.rules,
		accessInfo: ctx.accessInfo,
		accessInfoEs: ctx.accessInfoEs,
		cancellationDeadlineMinutes: ctx.cancellationDeadlineMinutes
	};
}
