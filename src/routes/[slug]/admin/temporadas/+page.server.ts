// SPDX-License-Identifier: EUPL-1.2
// Reservas de temporada de clubs y escuelas: la misma franja cada semana entre dos fechas.
// Antes de guardar se enseña lo que pisa: otra temporada (bloqueado) o reservas confirmadas
// (hay que confirmar su cancelación; cada dueño recibe su aviso).
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { municipalities } from '../../../../lib/server/db/schema';
import { localDateOf, localTimeOf } from '../../../../lib/server/domain/time';
import type { BookingRow, SeasonRow } from '../../../../lib/server/db/schema';
import { listAllFacilities } from '../../../../lib/server/services/admin';
import { facilityLooks } from '../../../../lib/server/services/indicators';
import {
	createSeasons,
	deleteSeason,
	listSeasons,
	SEASON_ENTITY_MAX,
	updateSeason,
	type SeasonInput
} from '../../../../lib/server/services/seasons';
import { requireAdminPage } from '../guard';
import { listEntities } from '../../../../lib/server/services/entities';
import { field } from '../form';
import { echo, isUuid } from '../instalacions/form';
import type { Actions, PageServerLoad } from './$types';

/** Conflictos que se listan; del resto solo se dice cuántos más hay. */
const SHOWN = 10;

const seasonView = (s: SeasonRow) => ({
	id: s.id,
	facilityId: s.facilityId,
	unitIndex: s.unitIndex,
	entityName: s.entityName,
	entityId: s.entityId,
	weekday: s.weekday,
	startsTime: s.startsTime,
	endsTime: s.endsTime,
	fromDate: s.fromDate,
	toDate: s.toDate
});

const conflictView = (b: BookingRow) => ({
	id: b.id,
	facilityId: b.facilityId,
	unitIndex: b.unitIndex,
	date: localDateOf(b.startsAt),
	start: localTimeOf(b.startsAt),
	end: localTimeOf(b.endsAt)
});

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const db = event.locals.db;
	const [all, looks, seasons, entities] = await Promise.all([
		listAllFacilities(db, municipality.id),
		facilityLooks(db, municipality.id),
		listSeasons(db, municipality.id),
		listEntities(db, municipality.id)
	]);
	const facilities = all.map((f) => ({
		id: f.id,
		name: f.name,
		active: f.active,
		bookingMode: f.bookingMode,
		units: f.units,
		mascot: looks.get(f.id)?.mascot ?? 'sala'
	}));
	const editId = event.url.searchParams.get('editar');
	const editing = editId ? (seasons.find((s) => s.id === editId) ?? null) : null;
	if (editId && !editing) error(404);
	return {
		today: localDateOf(event.locals.now()),
		entityMax: SEASON_ENTITY_MAX,
		entities: entities
			.filter((entity) => entity.active)
			.map((entity) => ({ id: entity.id, name: entity.name })),
		facilities,
		seasons: seasons.map((s) => ({ ...seasonView(s), facilityName: s.facilityName })),
		editing: editing ? seasonView(editing) : null,
		seasonPriorityCriteria: municipality.seasonPriorityCriteria
	};
};

/** Días marcados (0 = luns … 6 = domingo), sin repetir; null si alguno no es válido. */
function weekdaysOf(form: FormData): number[] | null {
	const raw = form.getAll('weekday').filter((v): v is string => typeof v === 'string');
	const days = [...new Set(raw)].map(Number);
	return days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
		raw.every((v) => /^\d$/.test(v))
		? days.sort((a, b) => a - b)
		: null;
}

export const actions: Actions = {
	criterios: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const parsed = z.string().trim().max(1000).safeParse(field(form, 'seasonPriorityCriteria'));
		if (!parsed.success) return fail(400, { criteriaError: true });
		await event.locals.db
			.update(municipalities)
			.set({ seasonPriorityCriteria: parsed.data })
			.where(eq(municipalities.id, municipality.id));
		return { criteriaSaved: true };
	},
	/**
	 * Crear (un día o varios a la vez) o, con `id`, editar una temporada (un solo día).
	 * Sin `confirmar=1`, si pisa reservas confirmadas → 409 con la lista; si pisa otra temporada
	 * → 409 bloqueado con la lista.
	 */
	gardar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const db = event.locals.db;
		const form = await event.request.formData();
		const values = echo(form);
		const weekdays = weekdaysOf(form) ?? [];
		const id = field(form, 'id');
		if (id && !isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const invalid = () => fail(400, { error: 'INVALID' as const, values, weekdays });
		// `lugar`: «idInstalación» (enteira) o «idInstalación:unidade».
		const [facilityId, unit] = field(form, 'lugar').split(':');
		if (!isUuid(facilityId ?? '')) return invalid();
		if (unit !== undefined && !/^\d{1,3}$/.test(unit)) return invalid();
		if (weekdaysOf(form) === null || weekdays.length === 0) return invalid();
		if (id && weekdays.length !== 1) return invalid();
		const inputs: SeasonInput[] = weekdays.map((weekday) => ({
			facilityId,
			unitIndex: unit === undefined ? null : Number(unit),
			entityName: field(form, 'entityName'),
			entityId: isUuid(field(form, 'entityId')) ? field(form, 'entityId') : null,
			weekday,
			startsTime: field(form, 'startsTime'),
			endsTime: field(form, 'endsTime'),
			fromDate: field(form, 'fromDate'),
			toDate: field(form, 'toDate'),
			createdBy: user.id
		}));
		const opts = {
			confirm: field(form, 'confirmar') === '1',
			now: event.locals.now(),
			actorId: user.id
		};
		const res = id
			? await updateSeason(db, municipality.id, id, inputs[0], opts)
			: await createSeasons(db, municipality.id, inputs, opts);
		if (res.ok) return { saved: true as const, cancelled: res.cancelled };
		switch (res.error) {
			case 'NOT_FOUND':
				return fail(404, { error: 'NOT_FOUND' as const });
			case 'SEASON_OVERLAP':
				return fail(409, {
					error: 'SEASON_OVERLAP' as const,
					overlaps: res.overlaps.map(seasonView),
					values,
					weekdays
				});
			case 'CONFLICTS':
				return fail(409, {
					error: 'CONFLICTS' as const,
					conflicts: res.conflicts.slice(0, SHOWN).map(conflictView),
					total: res.conflicts.length,
					values,
					weekdays
				});
			default:
				return invalid();
		}
	},

	borrar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const id = field(form, 'id');
		if (!isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const res = await deleteSeason(event.locals.db, municipality.id, id, user.id);
		return res.ok ? { deleted: true as const } : fail(404, { error: 'NOT_FOUND' as const });
	}
};
