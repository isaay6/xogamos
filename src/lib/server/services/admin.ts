// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	municipalities,
	municipalityProfiles,
	openingHours
} from '../db/schema';
import { validateFacility, validateHours } from '../domain/config-validation';
import type { Mascot } from '../../mascots';
import type { BookingMode, Hours } from '../domain/types';
import { findBookingsInClosure } from './affected';
import { cancelBookingTx, facilityLockQuery, STAFF_CANCEL_REASON_MAX } from './bookings';
import { notifyHoursChanged } from './notifications';
import { err, ok as okResult, type Result } from './result';
import { verifyResidency } from './staff';
import { closuresToday } from './closure-status';
import { localDateOf } from '../domain/time';
import { writeActivity } from './activity-log';

/** Motivo de cancelación cuando el cierre no trae uno. */
const CLOSURE_DEFAULT_REASON = 'Peche da instalación';

export type ConfigIssue = { path: string; message: string };
export type AdminError =
	'NOT_FOUND' | 'INVALID_CONFIG' | 'HAS_FUTURE_BOOKINGS' | 'VALIDATION_FAILED';
export type AdminResult<T> =
	{ ok: true; value: T } | { ok: false; error: AdminError; issues?: ConfigIssue[] };

const ok = <T>(value: T): AdminResult<T> => ({ ok: true, value });
const notFound = (): AdminResult<never> => ({ ok: false, error: 'NOT_FOUND' });
const invalid = (messages: string[]): AdminResult<never> => ({
	ok: false,
	error: 'INVALID_CONFIG',
	issues: messages.map((message) => ({ path: '', message }))
});

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Db | Tx;

// ── Ajustes ──────────────────────────────────────────────────────────────

export type Settings = {
	name: string;
	primaryColor: string;
	cancellationDeadlineMinutes: number;
	maxDaysAhead: number;
	noShowThreshold: number;
	penaltyDays: number;
	legalNotice: string;
	privacyPolicy: string;
	usageRules: string;
	seasonPriorityCriteria: string;
};

const settingsColumns = {
	name: municipalities.name,
	primaryColor: municipalities.primaryColor,
	cancellationDeadlineMinutes: municipalities.cancellationDeadlineMinutes,
	maxDaysAhead: municipalities.maxDaysAhead,
	noShowThreshold: municipalities.noShowThreshold,
	penaltyDays: municipalities.penaltyDays,
	legalNotice: municipalities.legalNotice,
	privacyPolicy: municipalities.privacyPolicy,
	usageRules: municipalities.usageRules,
	seasonPriorityCriteria: municipalities.seasonPriorityCriteria
};

export async function getSettings(db: Db, municipalityId: string): Promise<Settings> {
	const [row] = await db
		.select(settingsColumns)
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!row) throw new Error('MUNICIPALITY_NOT_FOUND');
	return row;
}

export async function updateSettings(
	db: Db,
	municipalityId: string,
	// Os criterios de tempada edítanse noutra pantalla: se non veñen, quedan como estaban.
	input: Omit<Settings, 'seasonPriorityCriteria'> & { seasonPriorityCriteria?: string }
): Promise<AdminResult<Settings>> {
	const [row] = await db
		.update(municipalities)
		.set(input)
		.where(eq(municipalities.id, municipalityId))
		.returning(settingsColumns);
	return row ? ok(row) : notFound();
}

// ── Tipos de instalación ─────────────────────────────────────────────────

export type FacilityTypeInput = {
	nameGl: string;
	nameEs: string;
	mascot: Mascot;
	color: string;
	bookingMode: BookingMode;
};

export function listFacilityTypes(db: Db, municipalityId: string) {
	return db
		.select()
		.from(facilityTypes)
		.where(eq(facilityTypes.municipalityId, municipalityId))
		.orderBy(asc(facilityTypes.nameGl), asc(facilityTypes.id));
}

export async function createFacilityType(db: Db, municipalityId: string, input: FacilityTypeInput) {
	const [row] = await db
		.insert(facilityTypes)
		.values({ ...input, municipalityId })
		.returning();
	return ok(row);
}

async function hasFutureConfirmed(q: Q, municipalityId: string, facilityIds: string[], now: Date) {
	if (facilityIds.length === 0) return false;
	const rows = await q
		.select({ id: bookings.id })
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				inArray(bookings.facilityId, facilityIds),
				eq(bookings.status, 'confirmed'),
				gt(bookings.startsAt, now)
			)
		)
		.limit(1);
	return rows.length > 0;
}

async function hoursOf(q: Q, facilityId: string): Promise<Hours[]> {
	return q
		.select({
			weekday: openingHours.weekday,
			opens: openingHours.opens,
			closes: openingHours.closes
		})
		.from(openingHours)
		.where(eq(openingHours.facilityId, facilityId))
		.orderBy(asc(openingHours.weekday), asc(openingHours.opens));
}

export async function updateFacilityType(
	db: Db,
	municipalityId: string,
	typeId: string,
	input: FacilityTypeInput,
	now: Date
): Promise<AdminResult<typeof facilityTypes.$inferSelect>> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(facilityTypes)
			.where(and(eq(facilityTypes.id, typeId), eq(facilityTypes.municipalityId, municipalityId)));
		if (!current) return notFound();

		if (current.bookingMode !== input.bookingMode) {
			const own = await tx
				.select()
				.from(facilities)
				.where(and(eq(facilities.typeId, typeId), eq(facilities.municipalityId, municipalityId)));
			if (
				await hasFutureConfirmed(
					tx,
					municipalityId,
					own.map((f) => f.id),
					now
				)
			) {
				return invalid(['Cannot change the booking mode while there are future bookings']);
			}
			const problems: string[] = [];
			for (const f of own) {
				const prefix = `${f.name}: `;
				for (const m of validateFacility({
					slotMinutes: f.slotMinutes,
					units: f.units,
					capacity: f.capacity,
					prices: [f.priceResidentCents, f.priceNonResidentCents],
					mode: input.bookingMode
				})) {
					problems.push(prefix + m);
				}
				for (const m of validateHours(await hoursOf(tx, f.id), input.bookingMode, f.slotMinutes)) {
					problems.push(prefix + m);
				}
			}
			if (problems.length) return invalid(problems);
		}

		const [row] = await tx
			.update(facilityTypes)
			.set(input)
			.where(and(eq(facilityTypes.id, typeId), eq(facilityTypes.municipalityId, municipalityId)))
			.returning();
		return ok(row);
	});
}

// ── Instalaciones ────────────────────────────────────────────────────────

export type FacilityInput = {
	typeId: string;
	name: string;
	location: string;
	address: string;
	units: number;
	capacity: number;
	slotMinutes: number;
	priceResidentCents: number;
	priceNonResidentCents: number;
	/** Precio con tarifa social; `null` = sin precio social. Si falta, no se toca al editar. */
	priceSocialCents?: number | null;
	accessible: boolean;
	stepFreeAccess?: 'yes' | 'no' | 'partial' | null;
	adaptedToilet?: boolean | null;
	adaptedChangingRoom?: boolean | null;
	accessibleParkingNearby?: boolean | null;
	hearingLoop?: boolean | null;
	supportContact?: string | null;
	accessibilityNotes?: string | null;
	accessibilityCheckedAt?: string | null;
	needsOpening?: boolean;
	accessInfo?: string;
	accessInfoEs?: string | null;
	rules: string;
};

async function getFacilityRow(q: Q, municipalityId: string, id: string) {
	const [row] = await q
		.select()
		.from(facilities)
		.where(and(eq(facilities.id, id), eq(facilities.municipalityId, municipalityId)));
	return row;
}

async function getTypeRow(q: Q, municipalityId: string, id: string) {
	const [row] = await q
		.select()
		.from(facilityTypes)
		.where(and(eq(facilityTypes.id, id), eq(facilityTypes.municipalityId, municipalityId)));
	return row;
}

const configProblems = (input: FacilityInput, mode: BookingMode) =>
	validateFacility({
		slotMinutes: input.slotMinutes,
		units: input.units,
		capacity: input.capacity,
		prices: [
			input.priceResidentCents,
			input.priceNonResidentCents,
			...(input.priceSocialCents == null ? [] : [input.priceSocialCents])
		],
		mode
	});

export type FacilityAdminOut = typeof facilities.$inferSelect & {
	bookingMode: BookingMode;
	hours: Hours[];
	closure: import('./closure-status').ClosureToday | null;
};

/** Todas las instalaciones del concello, también las inactivas, con su horario. */
export async function listAllFacilities(
	db: Db,
	municipalityId: string,
	now = new Date()
): Promise<FacilityAdminOut[]> {
	const rows = await db
		.select({ facility: facilities, bookingMode: facilityTypes.bookingMode })
		.from(facilities)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, facilities.municipalityId)
			)
		)
		.where(eq(facilities.municipalityId, municipalityId))
		.orderBy(asc(facilities.name), asc(facilities.id));
	const ids = rows.map((r) => r.facility.id);
	const hours = ids.length
		? await db
				.select()
				.from(openingHours)
				.where(inArray(openingHours.facilityId, ids))
				.orderBy(asc(openingHours.weekday), asc(openingHours.opens))
		: [];
	const closed = await closuresToday(db, ids, localDateOf(now));
	return rows.map((r) => ({
		...r.facility,
		closure: closed.get(r.facility.id) ?? null,
		bookingMode: r.bookingMode,
		hours: hours
			.filter((h) => h.facilityId === r.facility.id)
			.map(({ weekday, opens, closes }) => ({ weekday, opens, closes }))
	}));
}

/** Valida e inserta la instalación y su horario dentro de una transacción ya abierta. */
async function insertFacilityTx(
	tx: Tx,
	municipalityId: string,
	type: { id: string; bookingMode: BookingMode },
	input: Omit<FacilityInput, 'typeId'>,
	hours: Hours[]
): Promise<AdminResult<typeof facilities.$inferSelect>> {
	const full = { ...input, typeId: type.id };
	const problems = [
		...configProblems(full, type.bookingMode),
		...validateHours(hours, type.bookingMode, input.slotMinutes)
	];
	if (problems.length) return invalid(problems);
	const [row] = await tx
		.insert(facilities)
		.values({ ...full, municipalityId })
		.returning();
	if (hours.length) {
		await tx.insert(openingHours).values(hours.map((h) => ({ ...h, facilityId: row.id })));
	}
	return ok(row);
}

export async function createFacility(
	db: Db,
	municipalityId: string,
	input: FacilityInput,
	hours: Hours[] = [],
	actorId?: string
): Promise<AdminResult<typeof facilities.$inferSelect>> {
	return db.transaction(async (tx) => {
		const type = await getTypeRow(tx, municipalityId, input.typeId);
		if (!type) return notFound();
		const result = await insertFacilityTx(tx, municipalityId, type, input, hours);
		if (result.ok && actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_saved',
				params: { instalacion: result.value.name }
			});
		return result;
	});
}

/** Fallo de validación dentro de la transacción: se lanza para deshacerla y se devuelve. */
class WizardRollback extends Error {
	constructor(readonly result: AdminResult<never>) {
		super('WIZARD_ROLLBACK');
	}
}

/**
 * Asistente de nueva instalación: en una sola transacción reutiliza el tipo del concello con el
 * mismo personaje y modo de reserva (o lo crea) y crea la instalación con su horario. Si algo no
 * es válido no queda nada escrito, tampoco el tipo.
 */
export async function createFacilityWithType(
	db: Db,
	municipalityId: string,
	type: FacilityTypeInput,
	input: Omit<FacilityInput, 'typeId'>,
	hours: Hours[],
	/**
	 * Nombres del tipo nuevo cuando ya hay otro tipo con el mismo `nameGl` (en otro modo), para que
	 * no salgan dos «Pádel» iguales en las listas: p. ej. «Pádel · por pistas».
	 */
	opts: { namesIfTaken?: { nameGl: string; nameEs: string } } = {}
): Promise<AdminResult<typeof facilities.$inferSelect & { typeCreated: boolean }>> {
	return db
		.transaction(async (tx) => {
			const [existing] = await tx
				.select()
				.from(facilityTypes)
				.where(
					and(
						eq(facilityTypes.municipalityId, municipalityId),
						eq(facilityTypes.mascot, type.mascot),
						eq(facilityTypes.bookingMode, type.bookingMode)
					)
				)
				.orderBy(asc(facilityTypes.nameGl), asc(facilityTypes.id))
				.limit(1);
			let names = { nameGl: type.nameGl, nameEs: type.nameEs };
			if (!existing && opts.namesIfTaken) {
				const [taken] = await tx
					.select({ id: facilityTypes.id })
					.from(facilityTypes)
					.where(
						and(
							eq(facilityTypes.municipalityId, municipalityId),
							eq(facilityTypes.nameGl, type.nameGl)
						)
					)
					.limit(1);
				if (taken) names = opts.namesIfTaken;
			}
			const row =
				existing ??
				(
					await tx
						.insert(facilityTypes)
						.values({ ...type, ...names, municipalityId })
						.returning()
				)[0];
			const res = await insertFacilityTx(tx, municipalityId, row, input, hours);
			// Un fallo deshace también el tipo recién creado.
			if (!res.ok) throw new WizardRollback(res as AdminResult<never>);
			return ok({ ...res.value, typeCreated: !existing });
		})
		.catch((e: unknown) => {
			if (e instanceof WizardRollback) return e.result;
			throw e;
		});
}

export async function updateFacility(
	db: Db,
	municipalityId: string,
	facilityId: string,
	input: FacilityInput,
	now: Date,
	actorId?: string
): Promise<AdminResult<typeof facilities.$inferSelect>> {
	return db.transaction(async (tx) => {
		const current = await getFacilityRow(tx, municipalityId, facilityId);
		if (!current) return notFound();
		const newType = await getTypeRow(tx, municipalityId, input.typeId);
		if (!newType) return notFound();
		const oldType = await getTypeRow(tx, municipalityId, current.typeId);
		if (
			oldType &&
			oldType.bookingMode !== newType.bookingMode &&
			(await hasFutureConfirmed(tx, municipalityId, [facilityId], now))
		) {
			return invalid(['Cannot change the booking mode while there are future bookings']);
		}
		const problems = [
			...configProblems(input, newType.bookingMode),
			...validateHours(await hoursOf(tx, facilityId), newType.bookingMode, input.slotMinutes)
		];
		if (problems.length) return invalid(problems);
		const [row] = await tx
			.update(facilities)
			.set({
				...input,
				accessible:
					input.stepFreeAccess === undefined ? input.accessible : input.stepFreeAccess === 'yes'
			})
			.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)))
			.returning();
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_saved',
				params: { instalacion: row.name }
			});
		return ok(row);
	});
}

/**
 * Desactiva la instalación. Con reservas `confirmed` futuras falla con HAS_FUTURE_BOOKINGS,
 * salvo `force`: entonces se desactiva y las reservas se mantienen (el personal avisa).
 */
export async function deactivateFacility(
	db: Db,
	municipalityId: string,
	facilityId: string,
	opts: { force: boolean; now: Date; actorId?: string }
): Promise<AdminResult<typeof facilities.$inferSelect>> {
	return db.transaction(async (tx) => {
		const current = await getFacilityRow(tx, municipalityId, facilityId);
		if (!current) return notFound();
		if (!opts.force && (await hasFutureConfirmed(tx, municipalityId, [facilityId], opts.now))) {
			return { ok: false, error: 'HAS_FUTURE_BOOKINGS' };
		}
		const [row] = await tx
			.update(facilities)
			.set({ active: false })
			.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)))
			.returning();
		if (opts.actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId: opts.actorId,
				kind: 'facility_closed',
				params: { instalacion: row.name }
			});
		return ok(row);
	});
}

/** Vuelve a activar una instalación desactivada: aparece de nuevo en la búsqueda y se reserva. */
export async function reactivateFacility(
	db: Db,
	municipalityId: string,
	facilityId: string,
	actorId?: string
): Promise<AdminResult<typeof facilities.$inferSelect>> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(facilities)
			.set({ active: true })
			.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)))
			.returning();
		if (row && actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_reopened',
				params: { instalacion: row.name }
			});
		return row ? ok(row) : notFound();
	});
}

/** Sustituye todo el horario (borrar + insertar en una transacción), validado antes de escribir. */
export async function replaceHours(
	db: Db,
	municipalityId: string,
	facilityId: string,
	hours: Hours[],
	/** Con `notifyNow`, avisa en la misma transacción a quien queda fuera del nuevo horario. */
	opts: { notifyNow?: Date; actorId?: string } = {}
): Promise<AdminResult<Hours[]>> {
	return db.transaction(async (tx) => {
		// Comparte el bloqueo con la creación de reservas para que el aviso vea un estado coherente.
		await facilityLockQuery(tx, municipalityId, facilityId);
		const facility = await getFacilityRow(tx, municipalityId, facilityId);
		if (!facility) return notFound();
		const type = await getTypeRow(tx, municipalityId, facility.typeId);
		if (!type) return notFound();
		const problems = validateHours(hours, type.bookingMode, facility.slotMinutes);
		if (problems.length) return invalid(problems);
		await tx.delete(openingHours).where(eq(openingHours.facilityId, facilityId));
		if (hours.length) {
			await tx.insert(openingHours).values(hours.map((h) => ({ ...h, facilityId })));
		}
		if (opts.notifyNow) {
			await notifyHoursChanged(tx, municipalityId, facilityId, hours, opts.notifyNow);
		}
		const saved = await hoursOf(tx, facilityId);
		if (opts.actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId: opts.actorId,
				kind: 'hours_saved',
				params: { instalacion: facility.name }
			});
		return ok(saved);
	});
}

// ── Cierres ──────────────────────────────────────────────────────────────

export async function listClosures(
	db: Db,
	municipalityId: string,
	facilityId: string
): Promise<AdminResult<(typeof closures.$inferSelect)[]>> {
	if (!(await getFacilityRow(db, municipalityId, facilityId))) return notFound();
	return ok(
		await db
			.select()
			.from(closures)
			.where(eq(closures.facilityId, facilityId))
			.orderBy(asc(closures.startsAt), asc(closures.id))
	);
}

export async function createClosure(
	db: Db,
	municipalityId: string,
	facilityId: string,
	input: { startsAt: Date; endsAt: Date; reason: string },
	/** Con `cancelNow`, cancela en la misma transacción las reservas que bloquea el cierre. */
	opts: { cancelNow?: Date; actorId?: string } = {}
): Promise<AdminResult<typeof closures.$inferSelect>> {
	// El motivo es opcional; si hay que cancelar reservas y está vacío, se usa uno genérico.
	const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
	return db.transaction(async (tx) => {
		// Comparte el bloqueo con la creación de reservas antes de publicar el cierre y sus avisos.
		await facilityLockQuery(tx, municipalityId, facilityId);
		if (!(await getFacilityRow(tx, municipalityId, facilityId))) return notFound();
		if (reason.length > STAFF_CANCEL_REASON_MAX) {
			return { ok: false as const, error: 'VALIDATION_FAILED' as const };
		}
		const [row] = await tx
			.insert(closures)
			.values({ ...input, reason, facilityId })
			.returning();
		if (opts.cancelNow) {
			const affected = await findBookingsInClosure(
				tx,
				municipalityId,
				facilityId,
				{ from: input.startsAt, to: input.endsAt },
				opts.cancelNow
			);
			for (const booking of affected) {
				const cancelled = await cancelBookingTx(tx, {
					municipalityId,
					bookingId: booking.id,
					byStaff: true,
					reason: reason || CLOSURE_DEFAULT_REASON,
					closureId: row.id,
					now: opts.cancelNow
				});
				if (!cancelled.ok) throw new Error(`CLOSURE_CANCEL_FAILED: ${cancelled.error}`);
			}
		}
		if (opts.actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId: opts.actorId,
				kind: 'closure_created',
				params: {
					instalacion: (await getFacilityRow(tx, municipalityId, facilityId))!.name,
					desde: localDateOf(input.startsAt),
					ata: localDateOf(input.endsAt),
					motivo: reason || CLOSURE_DEFAULT_REASON
				}
			});
		return ok(row);
	});
}

export async function deleteClosure(
	db: Db,
	municipalityId: string,
	closureId: string,
	actorId?: string
): Promise<AdminResult<{ id: string }>> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ id: closures.id, name: facilities.name })
			.from(closures)
			.innerJoin(facilities, eq(facilities.id, closures.facilityId))
			.where(and(eq(closures.id, closureId), eq(facilities.municipalityId, municipalityId)));
		if (!row) return notFound();
		await tx.delete(closures).where(eq(closures.id, closureId));
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'closure_deleted',
				params: { instalacion: row.name }
			});
		return ok({ id: closureId });
	});
}

/**
 * Cancela como personal, con `reason` (1–200 caracteres), cada reserva `confirmed` que cae en el
 * cierre (mismo predicado que el aviso del cierre: futuras o en curso) y avisa a cada dueño.
 * Una transacción bajo el bloqueo de la instalación. Devuelve cuántas canceló.
 */
export async function cancelBookingsInClosure(
	db: Db,
	municipalityId: string,
	closureId: string,
	reason: string,
	now: Date
): Promise<Result<number, 'NOT_FOUND' | 'VALIDATION_FAILED'>> {
	return db.transaction((tx) =>
		cancelBookingsInClosureTx(tx, municipalityId, closureId, reason, now)
	);
}

/** Variante para operacións compostas que xa teñen a transacción e o bloqueo da instalación. */
export async function cancelBookingsInClosureTx(
	tx: Tx,
	municipalityId: string,
	closureId: string,
	reason: string,
	now: Date
): Promise<Result<number, 'NOT_FOUND' | 'VALIDATION_FAILED'>> {
	const trimmed = reason.trim();
	if (trimmed.length < 1 || trimmed.length > STAFF_CANCEL_REASON_MAX) {
		return err('VALIDATION_FAILED');
	}
	const [closure] = await tx
		.select({
			facilityId: closures.facilityId,
			startsAt: closures.startsAt,
			endsAt: closures.endsAt
		})
		.from(closures)
		.innerJoin(facilities, eq(facilities.id, closures.facilityId))
		.where(and(eq(closures.id, closureId), eq(facilities.municipalityId, municipalityId)));
	if (!closure) return err('NOT_FOUND');
	await facilityLockQuery(tx, municipalityId, closure.facilityId);
	const affected = await findBookingsInClosure(
		tx,
		municipalityId,
		closure.facilityId,
		{ from: closure.startsAt, to: closure.endsAt },
		now
	);
	for (const booking of affected) {
		const r = await cancelBookingTx(tx, {
			municipalityId,
			bookingId: booking.id,
			byStaff: true,
			reason: trimmed,
			closureId,
			now
		});
		if (!r.ok) throw new Error(`CLOSURE_CANCEL_FAILED: ${r.error}`);
	}
	return okResult(affected.length);
}

// ── Empadronamiento ──────────────────────────────────────────────────────

/**
 * Empadronamiento desde administración. Marcarlo es una comprobación del personal: registra
 * cuándo y quién y avisa como `verifyResidency`. Quitarlo limpia la verificación.
 */
export async function setResidency(
	db: Db,
	municipalityId: string,
	profileId: string,
	isResident: boolean,
	by: { userId: string; now: Date }
): Promise<AdminResult<{ id: string; isResident: boolean }>> {
	if (isResident) {
		const r = await verifyResidency(db, municipalityId, profileId, by.userId, by.now);
		return r.ok ? ok({ id: r.value.id, isResident: r.value.isResident }) : notFound();
	}
	const [row] = await db
		.update(municipalityProfiles)
		.set({ isResident: false, residencyVerifiedAt: null, residencyVerifiedBy: null })
		.where(
			and(
				eq(municipalityProfiles.id, profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		)
		.returning({
			id: municipalityProfiles.id,
			isResident: municipalityProfiles.isResident
		});
	return row ? ok(row) : notFound();
}
