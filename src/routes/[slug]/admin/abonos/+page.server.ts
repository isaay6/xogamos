// SPDX-License-Identifier: EUPL-1.2
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { bookingQrValue } from '#lib/server/auth/booking-qr-secret.js';
import { field } from '../form';
import { requireAdminPage } from '../guard';
import { parseEuros } from '../instalacions/text';
import { isLocalDate, localDateOf } from '#lib/server/domain/time.js';
import { getPersonDetail } from '#lib/server/services/staff.js';
import {
	createPassType,
	closedPassTypeIds,
	listCurrentPasses,
	listPassTypes,
	sellPass
} from '#lib/server/services/passes.js';
import { isUuid } from '../instalacions/form';
import { buscarAction, confirmarDniAction } from '../../conserxeria/busca';
import { writeActivity } from '../../../../lib/server/services/activity-log';

const positiveInt = (value: string) => (/^\d+$/.test(value) ? Number(value) : null);

export const load = async (event: RequestEvent) => {
	const { municipality } = await requireAdminPage(event);
	const persoa = event.url.searchParams.get('persoa');
	const [types, sports, currentPasses, person, closedTypes] = await Promise.all([
		listPassTypes(event.locals.db, municipality.id),
		event.locals.db.query.facilityTypes.findMany({
			where: (t, { eq }) => eq(t.municipalityId, municipality.id)
		}),
		listCurrentPasses(event.locals.db, municipality.id, event.locals.now()),
		persoa && isUuid(persoa) ? getPersonDetail(event.locals.db, municipality.id, persoa) : null,
		closedPassTypeIds(event.locals.db, municipality.id, event.locals.now())
	]);
	if (persoa && (!isUuid(persoa) || !person)) error(404);
	return {
		types: types.map((type) => ({ ...type, closedToday: closedTypes.has(type.facilityTypeId) })),
		person,
		currentPasses,
		today: localDateOf(event.locals.now()),
		sports: sports.map((s) => ({ id: s.id, nameGl: s.nameGl, nameEs: s.nameEs }))
	};
};

export const actions = {
	crearTipo: async (event: RequestEvent) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const facilityTypeId = field(form, 'facilityTypeId');
		const days = positiveInt(field(form, 'days'));
		const priceCents = parseEuros(field(form, 'priceCents'));
		if (!isUuid(facilityTypeId) || days === null || days < 1 || priceCents === null)
			return fail(400, { error: 'INVALID' as const });
		const result = await createPassType(event.locals.db, municipality.id, {
			facilityTypeId,
			name: field(form, 'name'),
			days,
			priceCents
		});
		return result.ok
			? { typeCreated: true as const }
			: fail(result.error === 'NOT_FOUND' ? 404 : 400, { error: result.error });
	},
	buscar: async (event: RequestEvent) => {
		const { municipality } = await requireAdminPage(event);
		return buscarAction(event, municipality.id);
	},
	confirmarDni: async (event: RequestEvent) => {
		const { municipality } = await requireAdminPage(event);
		return confirmarDniAction(
			event,
			municipality,
			(profileId) => `/${municipality.slug}/admin/abonos?persoa=${profileId}`
		);
	},
	vender: async (event: RequestEvent) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const passTypeId = field(form, 'passTypeId');
		const profileId = field(form, 'profileId');
		const startsOn = field(form, 'startsOn');
		const paymentMethod = field(form, 'paymentMethod') === 'wallet' ? 'wallet' : 'facility';
		if (!isUuid(passTypeId) || !isUuid(profileId) || !isLocalDate(startsOn))
			return fail(400, { error: 'INVALID' as const });
		const result = await sellPass(event.locals.db, {
			municipalityId: municipality.id,
			passTypeId,
			profileId,
			createdBy: user.id,
			startsOn,
			paymentMethod,
			now: event.locals.now()
		});
		if (!result.ok)
			return fail(result.error === 'INSUFFICIENT_WALLET_BALANCE' ? 422 : 404, {
				error: result.error
			});
		await writeActivity(event.locals.db, {
			municipalityId: municipality.id,
			actorId: user.id,
			kind: 'pass_sold',
			params: { detalle: profileId }
		});
		return {
			sold: { ...result.value, qr: bookingQrValue(event.url, municipality.slug, result.value.id) }
		};
	}
};
