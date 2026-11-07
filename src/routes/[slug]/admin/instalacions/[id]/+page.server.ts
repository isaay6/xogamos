// SPDX-License-Identifier: EUPL-1.2
import { error, fail } from '@sveltejs/kit';
import {
	createClosure,
	deactivateFacility,
	deleteClosure,
	listAllFacilities,
	listClosures,
	listFacilityTypes,
	reactivateFacility,
	updateFacility
} from '../../../../../lib/server/services/admin';
import {
	addFacilityPhoto,
	deleteFacilityPhoto,
	listFacilityPhotos,
	moveFacilityPhoto
} from '../../../../../lib/server/services/facility-photos';
import { MAX_LOGO_BYTES } from '../../../../../lib/server/services/logo';
import {
	addLocalDays,
	localDateOf,
	localDateTimeToUtc
} from '../../../../../lib/server/domain/time';
import { requireAdminPage } from '../../guard';
import { field } from '../../form';
import {
	countBookingsInClosure,
	countFutureBookings,
	echo,
	failOf,
	isUuid,
	parseFacilityForm,
	saveHours
} from '../form';
import type { Actions, PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const db = event.locals.db;
	const id = event.params.id;
	if (!isUuid(id)) error(404);
	const facility = (await listAllFacilities(db, municipality.id)).find((f) => f.id === id);
	if (!facility) error(404);
	const closures = await listClosures(db, municipality.id, id);
	if (!closures.ok) error(404);
	return {
		created: event.url.searchParams.get('creada') === '1',
		facility,
		types: await listFacilityTypes(db, municipality.id),
		closures: closures.value.map((c) => ({
			id: c.id,
			// `endsAt` es el comienzo del día siguiente al último día cerrado.
			from: localDateOf(c.startsAt),
			to: localDateOf(new Date(c.endsAt.getTime() - 1)),
			reason: c.kind === 'evento' ? `Evento: ${c.title ?? ''}` : c.reason
		})),
		photos: await listFacilityPhotos(db, facility.id)
	};
};

export const actions: Actions = {
	gardar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const db = event.locals.db;
		const form = await event.request.formData();
		const values = echo(form);
		const parsed = parseFacilityForm(form, await listFacilityTypes(db, municipality.id));
		if ('error' in parsed) {
			return parsed.error === 'NOT_FOUND'
				? fail(404, { error: 'NOT_FOUND' as const })
				: fail(400, { error: 'INVALID' as const, values });
		}
		if ('stepFreeAccess' in parsed.input) {
			parsed.input.accessibilityCheckedAt = localDateOf(event.locals.now());
		}
		const res = await updateFacility(
			db,
			municipality.id,
			event.params.id,
			parsed.input,
			event.locals.now(),
			user.id
		);
		if (!res.ok) {
			const f = failOf(res.error, { issues: res.issues });
			return fail(f.status, { ...f.data, values });
		}
		return { saved: true as const };
	},

	horario: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const db = event.locals.db;
		const facility = (await listAllFacilities(db, municipality.id)).find(
			(f) => f.id === event.params.id
		);
		if (!facility) return failOf('NOT_FOUND');
		const form = await event.request.formData();
		// Las mismas reglas que Horarios: errores por día también para «múltiplo» y «un tramo».
		return saveHours(db, municipality.id, facility.id, form, event.locals.now(), {
			mode: facility.bookingMode,
			slotMinutes: facility.slotMinutes,
			actorId: user.id
		});
	},

	/** Desactivar la instalación; con reservas futuras explica cuántas son. */
	pechar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const db = event.locals.db;
		const now = event.locals.now();
		const res = await deactivateFacility(db, municipality.id, event.params.id, {
			force: false,
			now,
			actorId: user.id
		});
		if (!res.ok) {
			const n =
				res.error === 'HAS_FUTURE_BOOKINGS'
					? await countFutureBookings(db, municipality.id, event.params.id, now)
					: 0;
			return failOf(res.error, { count: n });
		}
		return { closed: true as const };
	},

	/**
	 * «Pechar unha temporada»: de `from` a `to`, ambos días incluidos (hora de Madrid). Si hay
	 * reservas confirmadas en el período, primero 409 «hai N reservas» y la administradora
	 * confirma la cancelación. Un cierre que bloquea el uso nunca deja reservas válidas.
	 */
	peche: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const form = await event.request.formData();
		const from = field(form, 'from');
		const to = field(form, 'to');
		if (!DATE.test(from) || !DATE.test(to) || to < from) {
			return fail(400, { error: 'INVALID' as const, closureError: true as const });
		}
		const startsAt = localDateTimeToUtc(from, '00:00');
		const endsAt = localDateTimeToUtc(addLocalDays(to, 1), '00:00');
		const db = event.locals.db;
		const now = event.locals.now();
		const confirmed = field(form, 'confirmar') === '1';
		if (!confirmed) {
			const affected = await countBookingsInClosure(
				db,
				municipality.id,
				event.params.id,
				{ from: startsAt, to: endsAt },
				now
			);
			if (affected > 0) {
				return fail(409, { affected, accion: 'peche' as const, values: echo(form) });
			}
		}
		const res = await createClosure(
			db,
			municipality.id,
			event.params.id,
			{ startsAt, endsAt, reason: field(form, 'reason') },
			{ cancelNow: now, actorId: user.id }
		);
		if (!res.ok) return failOf(res.error);
		return { closureSaved: true as const };
	},

	/** Volver a abrir una instalación desactivada. */
	reactivar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const res = await reactivateFacility(
			event.locals.db,
			municipality.id,
			event.params.id,
			user.id
		);
		return res.ok ? { reactivated: true as const } : failOf(res.error);
	},

	borrarPeche: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const closureId = field(form, 'closureId');
		if (!isUuid(closureId)) return failOf('NOT_FOUND');
		const res = await deleteClosure(event.locals.db, municipality.id, closureId, user.id);
		return res.ok ? { closureDeleted: true as const } : failOf(res.error);
	},

	foto: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const form = await event.request.formData();
		const file = form.get('foto');
		const altGl = field(form, 'altGl');
		const altEs = field(form, 'altEs');
		if (!altGl.trim()) return fail(400, { photoError: 'ALT_REQUIRED' as const });
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { photoError: 'UNSUPPORTED_IMAGE' as const });
		if (file.size > MAX_LOGO_BYTES) return fail(400, { photoError: 'PHOTO_TOO_LARGE' as const });
		const res = await addFacilityPhoto(
			event.locals.db,
			municipality.id,
			event.params.id,
			new Uint8Array(await file.arrayBuffer()),
			file.size,
			altGl,
			altEs,
			user.id
		);
		if (!res.ok)
			return res.error === 'NOT_FOUND' ? failOf(res.error) : fail(400, { photoError: res.error });
		return { photoSaved: true as const };
	},

	borrarFoto: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const photoId = field(await event.request.formData(), 'photoId');
		if (!isUuid(photoId)) return failOf('NOT_FOUND');
		const res = await deleteFacilityPhoto(
			event.locals.db,
			municipality.id,
			event.params.id,
			photoId,
			user.id
		);
		return res.ok ? { photoDeleted: true as const } : failOf(res.error);
	},

	moverFoto: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		if (!isUuid(event.params.id)) return failOf('NOT_FOUND');
		const form = await event.request.formData();
		const photoId = field(form, 'photoId');
		const direction =
			field(form, 'direction') === 'up' ? -1 : field(form, 'direction') === 'down' ? 1 : null;
		if (!isUuid(photoId) || direction === null) return failOf('NOT_FOUND');
		const res = await moveFacilityPhoto(
			event.locals.db,
			municipality.id,
			event.params.id,
			photoId,
			direction,
			user.id
		);
		return res.ok ? { photoMoved: true as const } : failOf(res.error);
	}
};
