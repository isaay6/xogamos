// SPDX-License-Identifier: EUPL-1.2
import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, gte } from 'drizzle-orm';
import {
	bookings,
	entities,
	entityMembers,
	facilities,
	seasonBookings
} from '../../../../lib/server/db/schema';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { localDateOf } from '../../../../lib/server/domain/time';
import { requireMunicipality } from '../../municipality.server';
import { cancelBooking } from '../../../../lib/server/services/bookings';
import { Uuid } from '../../../../lib/server/http/schemas';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async (event) => {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	if (!Uuid.safeParse(event.params.entityId).success) error(404);
	const [entity] = await event.locals.db
		.select()
		.from(entities)
		.innerJoin(entityMembers, eq(entityMembers.entityId, entities.id))
		.where(
			and(
				eq(entities.id, event.params.entityId),
				eq(entities.municipalityId, municipality.id),
				eq(entityMembers.userId, user.id)
			)
		);
	if (!entity) error(404);
	const now = event.locals.now();
	const [upcoming, seasons] = await Promise.all([
		event.locals.db
			.select({
				id: bookings.id,
				startsAt: bookings.startsAt,
				endsAt: bookings.endsAt,
				status: bookings.status,
				facilityName: facilities.name
			})
			.from(bookings)
			.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
			.where(
				and(
					eq(bookings.entityId, entity.entities.id),
					eq(bookings.status, 'confirmed'),
					gte(bookings.endsAt, now)
				)
			)
			.orderBy(asc(bookings.startsAt)),
		event.locals.db
			.select()
			.from(seasonBookings)
			.where(eq(seasonBookings.entityId, entity.entities.id))
			.orderBy(asc(seasonBookings.weekday), asc(seasonBookings.startsTime))
	]);
	return { entity: entity.entities, upcoming, seasons, today: localDateOf(now) };
};

export const actions: Actions = {
	cancelar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const entityId = event.params.entityId;
		const bookingId = String((await event.request.formData()).get('bookingId') ?? '');
		if (!Uuid.safeParse(entityId).success || !Uuid.safeParse(bookingId).success)
			return fail(404, { error: 'NOT_FOUND' as const });
		const [member] = await event.locals.db
			.select({ id: entityMembers.entityId })
			.from(entityMembers)
			.innerJoin(entities, eq(entities.id, entityMembers.entityId))
			.where(
				and(
					eq(entityMembers.entityId, entityId),
					eq(entityMembers.userId, user.id),
					eq(entities.municipalityId, municipality.id)
				)
			);
		if (!member) return fail(404, { error: 'NOT_FOUND' as const });
		// Só se cancelan reservas deste club, nunca outra reserva do concello polo seu id.
		const [own] = await event.locals.db
			.select({ id: bookings.id })
			.from(bookings)
			.where(
				and(
					eq(bookings.id, bookingId),
					eq(bookings.entityId, entityId),
					eq(bookings.municipalityId, municipality.id)
				)
			);
		if (!own) return fail(404, { error: 'NOT_FOUND' as const });
		const result = await cancelBooking(event.locals.db, {
			municipalityId: municipality.id,
			bookingId,
			byStaff: false,
			now: event.locals.now()
		});
		return result.ok ? { cancelled: true as const } : fail(422, { error: result.error });
	}
};
