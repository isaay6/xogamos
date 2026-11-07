// SPDX-License-Identifier: EUPL-1.2
// Horarios: todas las instalaciones en una tabla, con las franjas editables en su sitio.
import { listAllFacilities, listFacilityTypes } from '../../../../lib/server/services/admin';
import { requireAdminPage } from '../guard';
import { field } from '../form';
import { failOf, isUuid, saveHours } from '../instalacions/form';
import { isLocalDate } from '../../../../lib/server/domain/time';
import {
	addFixedHolidays,
	addHoliday,
	listHolidays,
	removeHoliday
} from '../../../../lib/server/services/holidays';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const [facilities, types] = await Promise.all([
		listAllFacilities(event.locals.db, municipality.id),
		listFacilityTypes(event.locals.db, municipality.id)
	]);
	// La fila en edición sin JS (`?editar=<id>`): solo si es una instalación de este concello.
	const wanted = event.url.searchParams.get('editar') ?? '';
	const editing = facilities.some((f) => f.id === wanted) ? wanted : null;
	return {
		facilities,
		types,
		editing,
		holidays: await listHolidays(event.locals.db, municipality.id)
	};
};

export const actions: Actions = {
	/** Guarda las franjas de una instalación: el mismo flujo que la ficha (409 y avisos). */
	horario: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const db = event.locals.db;
		const form = await event.request.formData();
		const facilityId = field(form, 'facilityId');
		if (!isUuid(facilityId)) return failOf('NOT_FOUND');
		const facility = (await listAllFacilities(db, municipality.id)).find(
			(f) => f.id === facilityId
		);
		if (!facility) return failOf('NOT_FOUND');
		return saveHours(db, municipality.id, facilityId, form, event.locals.now(), {
			mode: facility.bookingMode,
			slotMinutes: facility.slotMinutes
		});
	},
	festivo: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const date = field(form, 'date');
		const name = field(form, 'name').trim();
		const mode = field(form, 'mode') === 'sunday_hours' ? 'sunday_hours' : 'closed';
		if (!isLocalDate(date) || !name) return failOf('VALIDATION_FAILED');
		await addHoliday(
			event.locals.db,
			municipality.id,
			date,
			name,
			mode,
			event.locals.now(),
			user.id
		);
		return { holidaySaved: true as const };
	},
	festivosFixos: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const year = Number(field(form, 'year'));
		if (!Number.isInteger(year) || year < 2020 || year > 2100) return failOf('VALIDATION_FAILED');
		await addFixedHolidays(event.locals.db, municipality.id, year, event.locals.now(), user.id);
		return { holidaysLoaded: true as const };
	},
	borrarFestivo: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const id = field(form, 'holidayId');
		if (!isUuid(id)) return failOf('NOT_FOUND');
		await removeHoliday(event.locals.db, municipality.id, id, user.id);
		return { holidayDeleted: true as const };
	}
};
