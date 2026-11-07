// SPDX-License-Identifier: EUPL-1.2
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { bookingQrValue } from '#lib/server/auth/booking-qr-secret.js';
import { eq } from 'drizzle-orm';
import { municipalities } from '../../../../lib/server/db/schema';
import type { SocialTariff } from '../../../../lib/server/domain/policies';
import { isLocalDate, localDateOf } from '../../../../lib/server/domain/time';
import { cancelBooking } from '../../../../lib/server/services/bookings';
import {
	closedPassTypeIds,
	listMyPasses,
	listPassTypes,
	sellPass
} from '../../../../lib/server/services/passes';
import { listMyBookings } from '../../../../lib/server/services/profiles';
import {
	getPersonDetail,
	setSocialTariff,
	verifyResidency
} from '../../../../lib/server/services/staff';
import { buscarAction } from '../busca';
import { deskContext, UUID } from '../guard';
import type { Actions, PageServerLoad } from './$types';

const TARIFFS: readonly SocialTariff[] = ['xove', 'maior', 'familia'];

export const load: PageServerLoad = async (event) => {
	const { municipality } = await deskContext(event);
	const { db } = event.locals;
	const now = event.locals.now();
	const persoa = event.url.searchParams.get('persoa');
	let person = null;
	let upcoming: Awaited<ReturnType<typeof listMyBookings>> = [];
	let past: typeof upcoming = [];
	let passes: Awaited<ReturnType<typeof listMyPasses>> = [];
	let threshold = 3;
	if (persoa !== null) {
		if (!UUID.test(persoa)) error(404);
		person = await getPersonDetail(db, municipality.id, persoa);
		if (!person) error(404);
		upcoming = await listMyBookings(db, municipality.id, persoa, { scope: 'upcoming', now });
		past = await listMyBookings(db, municipality.id, persoa, { scope: 'past', now });
		passes = await listMyPasses(db, municipality.id, persoa, now);
		const [policy] = await db
			.select({ noShowThreshold: municipalities.noShowThreshold })
			.from(municipalities)
			.where(eq(municipalities.id, municipality.id));
		threshold = policy?.noShowThreshold ?? 3;
	}
	const passTypes = await listPassTypes(db, municipality.id);
	const closedTypes = await closedPassTypeIds(db, municipality.id, now);
	return {
		person,
		upcoming,
		past,
		passes,
		passTypes: passTypes.map((type) => ({
			...type,
			closedToday: closedTypes.has(type.facilityTypeId)
		})),
		today: localDateOf(now),
		threshold,
		tariffs: TARIFFS
	};
};

/** Conserxe e persoa da ficha (`?persoa=` na URL da acción); 404 se é doutro concello. */
async function personContext(event: RequestEvent) {
	const { municipality, user } = await deskContext(event);
	const persoa = event.url.searchParams.get('persoa') ?? '';
	if (!UUID.test(persoa)) error(404);
	const person = await getPersonDetail(event.locals.db, municipality.id, persoa);
	if (!person) error(404);
	return { municipality, user, person };
}

export const actions: Actions = {
	// La búsqueda es POST: nombres, teléfonos y DNI no deben quedar en la URL ni en los registros.
	buscar: async (event) => {
		const { municipality } = await deskContext(event);
		return buscarAction(event, municipality.id);
	},

	empadroamento: async (event) => {
		const { municipality, user, person } = await personContext(event);
		const r = await verifyResidency(
			event.locals.db,
			municipality.id,
			person.profileId,
			user.id,
			event.locals.now()
		);
		if (!r.ok) error(404);
		return { done: 'empadroamento' as const };
	},

	tarifa: async (event) => {
		const { municipality, person, user } = await personContext(event);
		const raw = String((await event.request.formData()).get('tarifa') ?? '');
		const tariff = TARIFFS.find((x) => x === raw) ?? null;
		if (raw !== '' && tariff === null) return fail(400, { error: 'VALIDATION_FAILED' });
		const r = await setSocialTariff(event.locals.db, municipality.id, person.profileId, tariff);
		if (!r.ok) error(404);
		return { done: 'tarifa' as const };
	},

	// Como na axenda: dúas veces (tamén sen JS) e co motivo obrigatorio, que lle chega á persoa.
	cancelar: async (event) => {
		const { municipality, user, person } = await personContext(event);
		const form = await event.request.formData();
		const id = String(form.get('reserva') ?? '');
		if (!UUID.test(id)) error(404);
		const now = event.locals.now();
		const mine = await listMyBookings(event.locals.db, municipality.id, person.profileId, {
			scope: 'upcoming',
			now
		});
		// Só as próximas reservas desta persoa: calquera outro id é un 404.
		if (!mine.some((b) => b.id === id)) error(404);
		if (form.get('confirmar') !== '1') return fail(409, { confirmCancel: id });
		const r = await cancelBooking(event.locals.db, {
			municipalityId: municipality.id,
			bookingId: id,
			byStaff: true,
			reason: String(form.get('motivo') ?? ''),
			now,
			actorId: user.id
		});
		if (!r.ok) {
			if (r.error === 'NOT_FOUND') error(404);
			if (r.error === 'VALIDATION_FAILED') {
				return fail(400, { confirmCancel: id, error: r.error });
			}
			return fail(422, { error: r.error });
		}
		return { done: 'cancelar' as const };
	},

	venderAbono: async (event) => {
		const { municipality, user, person } = await personContext(event);
		const form = await event.request.formData();
		const passTypeId = String(form.get('passTypeId') ?? '');
		const startsOn = String(form.get('startsOn') ?? '');
		if (!UUID.test(passTypeId) || !isLocalDate(startsOn))
			return fail(400, { error: 'VALIDATION_FAILED' });
		const result = await sellPass(event.locals.db, {
			municipalityId: municipality.id,
			passTypeId,
			profileId: person.profileId,
			createdBy: user.id,
			startsOn,
			now: event.locals.now()
		});
		if (!result.ok) error(404);
		return {
			done: 'abono' as const,
			soldPass: {
				...result.value,
				qr: bookingQrValue(event.url, municipality.slug, result.value.id)
			}
		};
	}
};
