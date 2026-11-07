// SPDX-License-Identifier: EUPL-1.2
// Reservas de temporada de clubs y escuelas (adestramentos semanales). Ocupan la instalación en
// `loadDayAvailability`; crearlas sobre reservas confirmadas exige confirmarlo, y entonces el
// personal cancela esas reservas con motivo y avisa a sus dueños.
import { and, asc, eq, gt, lt, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	entities,
	facilities,
	facilityTypes,
	seasonBookings,
	type BookingRow,
	type FacilityRow,
	type SeasonRow
} from '../db/schema';
import { bookingHitsSeason, seasonsOverlap, type SeasonRule } from '../domain/seasons';
import { addLocalDays, isLocalDate, localDateTimeToUtc } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { cancelBookingTx, facilityLockQuery, type Tx } from './bookings';
import { err, ok, type Result } from './result';
import { writeActivity } from './activity-log';

export type SeasonInput = {
	facilityId: string;
	/** Solo en modo `unit`; null o ausente = toda la instalación. */
	unitIndex?: number | null;
	entityName: string;
	entityId?: string | null;
	/** 0 = luns … 6 = domingo. */
	weekday: number;
	startsTime: string;
	endsTime: string;
	/** 'YYYY-MM-DD', ambos incluidos. */
	fromDate: string;
	toDate: string;
	createdBy: string;
};

export type SeasonView = SeasonRow & { facilityName: string };

/** Fallos al guardar: los dos con lista se enseñan antes de escribir nada. */
export type SeasonFailure =
	| { ok: false; error: 'NOT_FOUND' | 'VALIDATION_FAILED' }
	/** Pisa otra temporada de la misma instalación (y unidad): bloqueado. */
	| { ok: false; error: 'SEASON_OVERLAP'; overlaps: SeasonRow[] }
	/** Pisa reservas confirmadas: hace falta `confirm` para cancelarlas. */
	| { ok: false; error: 'CONFLICTS'; conflicts: BookingRow[] };

export type CreateSeasonResult = { ok: true; value: SeasonRow; cancelled: number } | SeasonFailure;
/** `cancelled`: cuántas reservas canceló (solo con `confirm`). */
export type CreateSeasonsResult =
	{ ok: true; value: SeasonRow[]; cancelled: number } | SeasonFailure;

/** Longitud máxima del nombre de la entidad (cabe en el motivo de 200 de la cancelación). */
export const SEASON_ENTITY_MAX = 120;

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Regla normalizada o null si la entrada no es válida (sin mirar la instalación). */
function ruleOf(
	input: SeasonInput
): (SeasonRule & { entityName: string; entityId: string | null }) | null {
	const entityName = input.entityName.trim();
	const unitIndex = input.unitIndex ?? null;
	if (entityName.length < 1 || entityName.length > SEASON_ENTITY_MAX) return null;
	if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) return null;
	if (!HHMM.test(input.startsTime) || !HHMM.test(input.endsTime)) return null;
	if (input.endsTime <= input.startsTime) return null;
	if (!isLocalDate(input.fromDate) || !isLocalDate(input.toDate)) return null;
	if (input.toDate < input.fromDate) return null;
	if (unitIndex !== null && (!Number.isInteger(unitIndex) || unitIndex < 0)) return null;
	return {
		entityName,
		entityId: input.entityId ?? null,
		weekday: input.weekday,
		startsTime: input.startsTime,
		endsTime: input.endsTime,
		fromDate: input.fromDate,
		toDate: input.toDate,
		unitIndex
	};
}

/** La unidad solo tiene sentido en modo `unit` y dentro del número de unidades. */
const unitFits = (rule: SeasonRule, facility: FacilityRow, mode: BookingMode) =>
	rule.unitIndex === null || (mode === 'unit' && rule.unitIndex < facility.units);

async function facilityWithMode(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	lock: boolean
): Promise<{ facility: FacilityRow; bookingMode: BookingMode } | null> {
	const [facility] = lock
		? await facilityLockQuery(q, municipalityId, facilityId)
		: await q
				.select()
				.from(facilities)
				.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)));
	if (!facility) return null;
	const [type] = await q
		.select({ bookingMode: facilityTypes.bookingMode })
		.from(facilityTypes)
		.where(
			and(eq(facilityTypes.id, facility.typeId), eq(facilityTypes.municipalityId, municipalityId))
		);
	return type ? { facility, bookingMode: type.bookingMode } : null;
}

/** Reservas `confirmed` de la instalación, aún no acabadas, que pisan alguna ocurrencia. */
async function findConflicts(
	q: Db | Tx,
	municipalityId: string,
	facility: FacilityRow,
	bookingMode: BookingMode,
	rule: SeasonRule,
	now: Date
): Promise<BookingRow[]> {
	const from = localDateTimeToUtc(rule.fromDate, '00:00');
	const since = now > from ? now : from;
	const until = localDateTimeToUtc(addLocalDays(rule.toDate, 1), '00:00');
	const rows = await q
		.select()
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.facilityId, facility.id),
				eq(bookings.status, 'confirmed'),
				lt(bookings.startsAt, until),
				gt(bookings.endsAt, since)
			)
		)
		.orderBy(asc(bookings.startsAt), asc(bookings.id));
	return rows.filter((b) => bookingHitsSeason(b, rule, bookingMode));
}

type Checked = {
	rule: SeasonRule & { entityName: string; entityId: string | null };
	facility: FacilityRow;
	bookingMode: BookingMode;
};

/**
 * Comprobaciones comunes de la vista previa y la creación, en el mismo orden: entrada, instalación
 * del concello (`lock` = FOR UPDATE, solo en transacción) y unidad.
 */
async function checkSeason(
	q: Db | Tx,
	municipalityId: string,
	input: SeasonInput,
	lock: boolean
): Promise<Result<Checked, 'NOT_FOUND' | 'VALIDATION_FAILED'>> {
	const rule = ruleOf(input);
	if (!rule) return err('VALIDATION_FAILED');
	const found = await facilityWithMode(q, municipalityId, input.facilityId, lock);
	if (!found) return err('NOT_FOUND');
	if (!unitFits(rule, found.facility, found.bookingMode)) return err('VALIDATION_FAILED');
	return ok({ rule, ...found });
}

/**
 * Vista previa: las reservas confirmadas aún no acabadas en `now` que pisan alguna ocurrencia.
 * Mismas comprobaciones y mismo predicado que `createSeason`, así que la lista y los errores
 * coinciden con lo que esta haría (salvo reservas que cambien entre medias).
 */
export async function seasonConflicts(
	db: Db,
	municipalityId: string,
	input: SeasonInput,
	now: Date
): Promise<Result<BookingRow[], 'NOT_FOUND' | 'VALIDATION_FAILED'>> {
	const checked = await checkSeason(db, municipalityId, input, false);
	if (!checked.ok) return checked;
	const { rule, facility, bookingMode } = checked.value;
	return ok(await findConflicts(db, municipalityId, facility, bookingMode, rule, now));
}

/** Otras temporadas de la instalación que ocupan a la vez (sin contar `excludeId`). */
async function findOverlaps(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	rule: SeasonRule,
	excludeId: string | null
): Promise<SeasonRow[]> {
	const rows = await q
		.select()
		.from(seasonBookings)
		.where(
			and(
				eq(seasonBookings.municipalityId, municipalityId),
				eq(seasonBookings.facilityId, facilityId),
				eq(seasonBookings.weekday, rule.weekday),
				...(excludeId ? [ne(seasonBookings.id, excludeId)] : [])
			)
		)
		.orderBy(asc(seasonBookings.fromDate), asc(seasonBookings.startsTime), asc(seasonBookings.id));
	return rows.filter((r) => seasonsOverlap(r, rule));
}

/**
 * Guarda una o varias temporadas (p. ej. la misma franja en varios días de la semana) en una
 * transacción, todo o nada. Antes de escribir mira cada una bajo el bloqueo de su instalación:
 * - si pisa otra temporada → `SEASON_OVERLAP` con la lista (bloqueado);
 * - si pisa reservas confirmadas futuras y no hay `confirm` → `CONFLICTS` con la lista.
 * Con `confirm` crea las temporadas y cancela esas reservas como personal; cada dueño recibe su
 * aviso con la entidad (`params.season`), que se lee «Reserva de tempada: {entidade}». Una
 * reserva simultánea o ve la temporada o es cancelada por ella. Con `updateId` (una sola
 * entrada) edita esa temporada en vez de crear, sin compararla consigo misma.
 */
async function saveSeasons(
	db: Db,
	municipalityId: string,
	inputs: SeasonInput[],
	opts: { confirm: boolean; now: Date; updateId?: string; actorId?: string }
): Promise<CreateSeasonsResult> {
	// Entrada inválida: sin abrir la transacción.
	if (inputs.length === 0 || inputs.some((i) => !ruleOf(i))) return err('VALIDATION_FAILED');
	return db.transaction(async (tx): Promise<CreateSeasonsResult> => {
		const checked: Checked[] = [];
		for (const input of inputs) {
			const c = await checkSeason(tx, municipalityId, input, true);
			if (!c.ok) return c;
			checked.push(c.value);
		}
		if (opts.updateId) {
			const [current] = await tx
				.select({ id: seasonBookings.id })
				.from(seasonBookings)
				.where(
					and(
						eq(seasonBookings.id, opts.updateId),
						eq(seasonBookings.municipalityId, municipalityId)
					)
				);
			if (!current) return err('NOT_FOUND');
		}
		const overlaps = new Map<string, SeasonRow>();
		const conflicts = new Map<string, BookingRow>();
		for (const { rule, facility, bookingMode } of checked) {
			for (const o of await findOverlaps(
				tx,
				municipalityId,
				facility.id,
				rule,
				opts.updateId ?? null
			)) {
				overlaps.set(o.id, o);
			}
			for (const b of await findConflicts(
				tx,
				municipalityId,
				facility,
				bookingMode,
				rule,
				opts.now
			)) {
				conflicts.set(b.id, b);
			}
		}
		if (overlaps.size > 0) return { ...err('SEASON_OVERLAP'), overlaps: [...overlaps.values()] };
		const hits = [...conflicts.values()].sort(
			(a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id)
		);
		if (hits.length > 0 && !opts.confirm) return { ...err('CONFLICTS'), conflicts: hits };

		const saved: SeasonRow[] = [];
		for (const [i, { rule, facility }] of checked.entries()) {
			if (rule.entityId) {
				const [entity] = await tx
					.select({ id: entities.id, name: entities.name })
					.from(entities)
					.where(and(eq(entities.id, rule.entityId), eq(entities.municipalityId, municipalityId)));
				if (!entity) return err('NOT_FOUND');
				rule.entityName = entity.name;
			}
			const values = {
				facilityId: facility.id,
				unitIndex: rule.unitIndex,
				entityName: rule.entityName,
				entityId: rule.entityId,
				weekday: rule.weekday,
				startsTime: rule.startsTime,
				endsTime: rule.endsTime,
				fromDate: rule.fromDate,
				toDate: rule.toDate
			};
			const [row] = opts.updateId
				? await tx
						.update(seasonBookings)
						.set(values)
						.where(
							and(
								eq(seasonBookings.id, opts.updateId),
								eq(seasonBookings.municipalityId, municipalityId)
							)
						)
						.returning()
				: await tx
						.insert(seasonBookings)
						.values({
							...values,
							municipalityId,
							createdBy: inputs[i].createdBy,
							createdAt: opts.now
						})
						.returning();
			saved.push(row);
		}
		for (const booking of hits) {
			// La entidad de la temporada que pisa la reserva (con varias, la de su instalación y día).
			const owner =
				checked.find(
					(c) =>
						c.facility.id === booking.facilityId &&
						bookingHitsSeason(booking, c.rule, c.bookingMode)
				) ?? checked[0];
			// El aviso lleva solo la entidad (`params.season`); el motivo se redacta al leerlo.
			const cancelled = await cancelBookingTx(tx, {
				municipalityId,
				bookingId: booking.id,
				byStaff: true,
				season: owner.rule.entityName,
				now: opts.now
			});
			// Bajo el bloqueo de la instalación la reserva sigue confirmada: otro resultado es un fallo.
			if (!cancelled.ok) throw new Error(`SEASON_CANCEL_FAILED: ${cancelled.error}`);
		}
		if (opts.actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId: opts.actorId,
				kind: 'season_saved',
				params: { detalle: saved.map((row) => row.entityName).join(', ') }
			});
		return { ...ok(saved), cancelled: hits.length };
	});
}

/** Crea una temporada (ver `saveSeasons`). */
export async function createSeason(
	db: Db,
	municipalityId: string,
	input: SeasonInput,
	opts: { confirm: boolean; now: Date; actorId?: string }
): Promise<CreateSeasonResult> {
	const r = await saveSeasons(db, municipalityId, [input], opts);
	return r.ok ? { ...ok(r.value[0]), cancelled: r.cancelled } : r;
}

/** Crea varias temporadas a la vez, todo o nada (ver `saveSeasons`). */
export function createSeasons(
	db: Db,
	municipalityId: string,
	inputs: SeasonInput[],
	opts: { confirm: boolean; now: Date; actorId?: string }
): Promise<CreateSeasonsResult> {
	return saveSeasons(db, municipalityId, inputs, opts);
}

/** Edita una temporada del concello con las mismas comprobaciones; la ajena es NOT_FOUND. */
export async function updateSeason(
	db: Db,
	municipalityId: string,
	id: string,
	input: SeasonInput,
	opts: { confirm: boolean; now: Date; actorId?: string }
): Promise<CreateSeasonResult> {
	const r = await saveSeasons(db, municipalityId, [input], { ...opts, updateId: id });
	return r.ok ? { ...ok(r.value[0]), cancelled: r.cancelled } : r;
}

/** Temporadas del concello con el nombre de su instalación. */
export async function listSeasons(db: Db, municipalityId: string): Promise<SeasonView[]> {
	const rows = await db
		.select({ season: seasonBookings, facilityName: facilities.name })
		.from(seasonBookings)
		.innerJoin(
			facilities,
			and(
				eq(facilities.id, seasonBookings.facilityId),
				eq(facilities.municipalityId, seasonBookings.municipalityId)
			)
		)
		.where(eq(seasonBookings.municipalityId, municipalityId))
		.orderBy(
			asc(facilities.name),
			asc(seasonBookings.weekday),
			asc(seasonBookings.startsTime),
			asc(seasonBookings.id)
		);
	return rows.map((r) => ({ ...r.season, facilityName: r.facilityName }));
}

/** Borra una temporada del concello (libera sus horas; no recupera reservas canceladas). */
export async function deleteSeason(
	db: Db,
	municipalityId: string,
	id: string,
	actorId?: string
): Promise<Result<{ id: string }, 'NOT_FOUND'>> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.delete(seasonBookings)
			.where(and(eq(seasonBookings.id, id), eq(seasonBookings.municipalityId, municipalityId)))
			.returning({ id: seasonBookings.id, entityName: seasonBookings.entityName });
		if (rows[0] && actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'season_deleted',
				params: { detalle: rows[0].entityName }
			});
		return rows.length > 0 ? ok(rows[0]) : err('NOT_FOUND');
	});
}
