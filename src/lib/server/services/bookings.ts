// SPDX-License-Identifier: EUPL-1.2
import { TZDate } from '@date-fns/tz';
import { randomUUID } from 'node:crypto';
import { addDays, format } from 'date-fns';
import { and, asc, eq, gt, gte, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	entities,
	entityFacilities,
	entityMembers,
	facilities,
	facilityTypes,
	holidays,
	municipalities,
	municipalityProfiles,
	passes,
	passTypes,
	openingHours,
	seasonBookings,
	users,
	type BookingRow,
	type FacilityRow
} from '../db/schema';
import { ACCESS_WINDOW_BEFORE_MINUTES, generatePin, normalizePin } from '../domain/access-code';
import { extractQrToken, verifyBookingQr } from '../domain/booking-qr';
import { computeAvailability, type SlotAvailability } from '../domain/availability';
import {
	applyNoShow,
	canCancel,
	isPenalized,
	priceFor,
	withinBookingWindow
} from '../domain/policies';
import { seasonAsBookings, seasonOccurrence } from '../domain/seasons';
import { generateSlots } from '../domain/slots';
import { localDateOf, localDateTimeToUtc, TZ, weekdayOf } from '../domain/time';
import type { BookingMode } from '../domain/types';
import { notifyBooking, notifyOpeners } from './notifications';
import { err, ok, type Result } from './result';
import { writeActivity } from './activity-log';
import { payWalletTx, refundWalletTx } from './wallet';
import { claimWaitlistOffer, mayBookOfferedSlot, offerFreedSlot } from './waitlist';

export type BookingError =
	| 'NOT_FOUND'
	| 'IN_PAST'
	| 'TOO_FAR_AHEAD'
	| 'NOT_ALIGNED'
	| 'SLOT_UNAVAILABLE'
	| 'UNIT_REQUIRED'
	| 'UNIT_UNAVAILABLE'
	| 'CAPACITY_EXCEEDED'
	| 'PENALIZED'
	| 'FACILITY_INACTIVE'
	| 'INSUFFICIENT_WALLET_BALANCE'
	| 'ENTITY_NOT_ALLOWED'
	| 'ENTITY_FACILITY_NOT_ALLOWED'
	| 'ENTITY_MAX_ACTIVE_BOOKINGS'
	| 'ENTITY_MAX_CONSECUTIVE';

export type CreateBookingInput = {
	municipalityId: string;
	facilityId: string;
	profileId: string;
	/** Entidade para a que reserva unha persoa responsable. */
	entityId?: string;
	startsAt: Date;
	unitIndex?: number;
	seats?: number;
	channel: 'online' | 'phone' | 'desk';
	createdByUserId: string;
	paymentMethod?: 'facility' | 'wallet';
	now: Date;
};

/**
 * Dependencias inyectables (pruebas) y `excludeBookingId`: reserva que no cuenta
 * para la disponibilidad (la original al reprogramar).
 */
export type CreateBookingOptions = {
	generateCode?: () => string;
	excludeBookingId?: string;
	/** Aviso que se emite con la reserva (por defecto `confirmed`; al reprogramar, `changed`). */
	notice?: 'confirmed' | 'changed';
};

/** Transacción de drizzle sobre `Db`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const MAX_PIN_ATTEMPTS = 20;

/** Horas tras el fin de la reserva durante las que aún se puede marcar la ausencia. */
export const NO_SHOW_GRACE_HOURS = 48;

// ── Fechas locales (Europe/Madrid) ────────────────────────────────────────────

export { localDateOf };

/** [inicio, fin) del día local en UTC (23 h o 25 h en los cambios de hora). */
export function localDayBounds(date: string): { dayStart: Date; dayEnd: Date } {
	const [y, m, d] = date.split('-').map(Number);
	const next = format(addDays(new TZDate(y, m - 1, d, 12, 0, 0, 0, TZ), 1), 'yyyy-MM-dd');
	return { dayStart: localDateTimeToUtc(date, '00:00'), dayEnd: localDateTimeToUtc(next, '00:00') };
}

// ── Carga del día ─────────────────────────────────────────────────────────────

/**
 * Franjas del día local con su disponibilidad, contando las reservas `confirmed` y las
 * ocurrencias de las reservas de temporada de ese día (ocupan como una reserva más).
 * Se ejecuta con `db` o dentro de una transacción (tras bloquear la instalación).
 */
export async function loadDayAvailability(
	q: Db | Tx,
	facility: FacilityRow,
	bookingMode: BookingMode,
	date: string,
	excludeBookingId?: string
): Promise<SlotAvailability[]> {
	const { dayStart, dayEnd } = localDayBounds(date);
	const [hours, dayClosures, dayBookings, seasons, holiday] = await Promise.all([
		q
			.select({
				weekday: openingHours.weekday,
				opens: openingHours.opens,
				closes: openingHours.closes
			})
			.from(openingHours)
			.where(eq(openingHours.facilityId, facility.id)),
		q
			.select({ startsAt: closures.startsAt, endsAt: closures.endsAt })
			.from(closures)
			.where(
				and(
					eq(closures.facilityId, facility.id),
					lt(closures.startsAt, dayEnd),
					gt(closures.endsAt, dayStart)
				)
			),
		q
			.select({
				startsAt: bookings.startsAt,
				endsAt: bookings.endsAt,
				unitIndex: bookings.unitIndex,
				seats: bookings.seats
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, facility.municipalityId),
					eq(bookings.facilityId, facility.id),
					eq(bookings.status, 'confirmed'),
					lt(bookings.startsAt, dayEnd),
					gt(bookings.endsAt, dayStart),
					excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined
				)
			),
		daySeasons(q, facility, date),
		q
			.select({ mode: holidays.mode })
			.from(holidays)
			.where(and(eq(holidays.municipalityId, facility.municipalityId), eq(holidays.date, date)))
	]);
	// Un festivo pechado non xera franxas. O outro modo reutiliza exactamente o domingo.
	if (holiday[0]?.mode === 'closed') return [];
	const effectiveHours =
		holiday[0]?.mode === 'sunday_hours'
			? // As franxas do domingo, pasadas ao día da semana desta data para que `generateSlots` as use.
				hours
					.filter((hour) => hour.weekday === 6)
					.map((hour) => ({ ...hour, weekday: weekdayOf(date) }))
			: hours;
	const slots = generateSlots({
		date,
		slotMinutes: facility.slotMinutes,
		hours: effectiveHours,
		closures: dayClosures,
		bookingMode
	});
	const seasonBlocks = seasons.flatMap((season) => {
		const occurrence = seasonOccurrence(season, date);
		return occurrence
			? seasonAsBookings(occurrence, season, {
					bookingMode,
					units: facility.units,
					capacity: facility.capacity
				})
			: [];
	});
	return computeAvailability({
		slots,
		bookings: [...dayBookings, ...seasonBlocks],
		bookingMode,
		units: facility.units,
		capacity: facility.capacity
	});
}

/** Temporadas de la instalación vigentes en la fecha local y con su día de la semana. */
export function daySeasons(q: Db | Tx, facility: FacilityRow, date: string) {
	return q
		.select({
			id: seasonBookings.id,
			entityName: seasonBookings.entityName,
			weekday: seasonBookings.weekday,
			startsTime: seasonBookings.startsTime,
			endsTime: seasonBookings.endsTime,
			fromDate: seasonBookings.fromDate,
			toDate: seasonBookings.toDate,
			unitIndex: seasonBookings.unitIndex
		})
		.from(seasonBookings)
		.where(
			and(
				eq(seasonBookings.municipalityId, facility.municipalityId),
				eq(seasonBookings.facilityId, facility.id),
				eq(seasonBookings.weekday, weekdayOf(date)),
				lte(seasonBookings.fromDate, date),
				gte(seasonBookings.toDate, date)
			)
		);
}

/**
 * SELECT … FOR UPDATE de la instalación del concello. Todo escritor de reservas
 * bloquea antes esta fila: serializa disponibilidad y unicidad de códigos.
 */
export function facilityLockQuery(q: Db | Tx, municipalityId: string, facilityId: string) {
	return q
		.select()
		.from(facilities)
		.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)))
		.for('update');
}

/** Instalación del concello con el modo de reserva de su tipo; `lock` = FOR UPDATE (solo en transacción). */
async function findFacility(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	lock = false
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
	if (!type) return null;
	return { facility, bookingMode: type.bookingMode };
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function getAvailability(
	db: Db,
	municipalityId: string,
	facilityId: string,
	date: string
): Promise<Result<SlotAvailability[], 'NOT_FOUND'>> {
	const found = await findFacility(db, municipalityId, facilityId);
	if (!found) return err('NOT_FOUND');
	return ok(await loadDayAvailability(db, found.facility, found.bookingMode, date));
}

export function createBooking(
	db: Db,
	input: CreateBookingInput,
	opts: CreateBookingOptions = {}
): Promise<Result<BookingRow, BookingError>> {
	return db.transaction((tx) => createBookingTx(tx, input, opts));
}

/**
 * Crea una reserva dentro de una transacción existente. Bloquea la fila de la
 * instalación (SELECT … FOR UPDATE) y recalcula la disponibilidad antes de insertar,
 * de modo que dos reservas de la misma instalación se serializan.
 */
export async function createBookingTx(
	tx: Tx,
	input: CreateBookingInput,
	opts: CreateBookingOptions = {}
): Promise<Result<BookingRow, BookingError>> {
	const { municipalityId, startsAt, now } = input;
	assertValidInput(input);

	// 1. Instalación del concello, activa; perfil del mismo concello.
	const found = await findFacility(tx, municipalityId, input.facilityId, true);
	if (!found) return err('NOT_FOUND');
	const { facility, bookingMode } = found;
	if (!facility.active) return err('FACILITY_INACTIVE');

	const [profile] = await tx
		.select()
		.from(municipalityProfiles)
		.where(
			and(
				eq(municipalityProfiles.id, input.profileId),
				eq(municipalityProfiles.municipalityId, municipalityId)
			)
		);
	if (!profile) return err('NOT_FOUND');

	// A entidade nunca se acepta polo que di o formulario: pertence ao concello e a persoa é responsable.
	let entity: typeof entities.$inferSelect | null = null;
	if (input.entityId) {
		const [foundEntity] = await tx
			.select()
			.from(entities)
			.where(
				and(
					eq(entities.id, input.entityId),
					eq(entities.municipalityId, municipalityId),
					eq(entities.active, true)
				)
			)
			.for('update');
		const [member] = foundEntity
			? await tx
					.select({ userId: entityMembers.userId })
					.from(entityMembers)
					.where(
						and(
							eq(entityMembers.entityId, foundEntity.id),
							eq(entityMembers.userId, profile.userId)
						)
					)
			: [];
		entity = member ? foundEntity : null;
		if (!entity) return err('ENTITY_NOT_ALLOWED');
		const allowed = await tx
			.select({ facilityId: entityFacilities.facilityId })
			.from(entityFacilities)
			.where(eq(entityFacilities.entityId, entity.id));
		if (allowed.length > 0 && !allowed.some((row) => row.facilityId === facility.id))
			return err('ENTITY_FACILITY_NOT_ALLOWED');
		if (entity.maxActiveBookings !== null) {
			const active = await tx
				.select({ id: bookings.id })
				.from(bookings)
				.where(
					and(
						eq(bookings.entityId, entity.id),
						eq(bookings.status, 'confirmed'),
						gt(bookings.endsAt, now),
						opts.excludeBookingId ? ne(bookings.id, opts.excludeBookingId) : undefined
					)
				);
			if (active.length >= entity.maxActiveBookings) return err('ENTITY_MAX_ACTIVE_BOOKINGS');
		}
	}

	const [policy] = await tx
		.select()
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!policy) return err('NOT_FOUND');

	// 2. Ventana de reserva.
	const windowError = withinBookingWindow(
		startsAt,
		now,
		entity?.advanceDays === null || entity?.advanceDays === undefined
			? policy
			: { ...policy, maxDaysAhead: entity.advanceDays }
	);
	if (windowError) return err(windowError);

	// 3. Sanción.
	if (isPenalized(profile.penaltyUntil, now)) return err('PENALIZED');

	// 4. Alineación con una franja generada.
	const date = localDateOf(startsAt);
	const availability = await loadDayAvailability(
		tx,
		facility,
		bookingMode,
		date,
		opts.excludeBookingId
	);
	const slot = availability.find((s) => s.startsAt.getTime() === startsAt.getTime());
	if (!slot) return err('NOT_ALIGNED');
	// Una oferta vigente aparta una plaza para quien estaba en la cola. Si hay varias
	// plazas, las restantes siguen disponibles para el resto de vecinas.
	const waitlist = await mayBookOfferedSlot(tx, {
		facilityId: facility.id,
		startsAt,
		profileId: profile.id,
		now
	});

	// 5. Disponibilidad según el modo.
	let seats = 1;
	let unitIndex: number | null = null;
	if (bookingMode === 'unit') {
		if (input.unitIndex === undefined) return err('UNIT_REQUIRED');
		if (!slot.freeUnits.includes(input.unitIndex)) return err('UNIT_UNAVAILABLE');
		unitIndex = input.unitIndex;
	} else if (bookingMode === 'capacity') {
		seats = input.seats ?? 1;
		if (seats > slot.remainingSeats) return err('CAPACITY_EXCEEDED');
	} else if (!slot.free) {
		return err('SLOT_UNAVAILABLE');
	}
	if (!waitlist.mine && waitlist.offered.length > 0) {
		const available =
			bookingMode === 'unit'
				? slot.freeUnits.length
				: bookingMode === 'capacity'
					? slot.remainingSeats
					: slot.free
						? 1
						: 0;
		const requested = bookingMode === 'capacity' ? seats : 1;
		if (available - waitlist.offered.length < requested) return err('SLOT_UNAVAILABLE');
	}
	// Só nas reservas dun club con límite de franxas seguidas.
	if (entity && entity.maxConsecutiveSlots !== null) {
		const clubBookings = await tx
			.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
			.from(bookings)
			.where(
				and(
					eq(bookings.entityId, entity.id),
					eq(bookings.facilityId, facility.id),
					eq(bookings.status, 'confirmed'),
					opts.excludeBookingId ? ne(bookings.id, opts.excludeBookingId) : undefined,
					bookingMode === 'unit' && unitIndex !== null
						? eq(bookings.unitIndex, unitIndex)
						: undefined
				)
			);
		let runStart = slot.startsAt;
		let runEnd = slot.endsAt;
		let consecutive = 1;
		for (;;) {
			const previous = clubBookings.find(
				(booking) => booking.endsAt.getTime() === runStart.getTime()
			);
			if (!previous) break;
			runStart = previous.startsAt;
			consecutive += 1;
		}
		for (;;) {
			const next = clubBookings.find((booking) => booking.startsAt.getTime() === runEnd.getTime());
			if (!next) break;
			runEnd = next.endsAt;
			consecutive += 1;
		}
		if (consecutive > entity.maxConsecutiveSlots) return err('ENTITY_MAX_CONSECUTIVE');
	}

	const accessCode = await pickPin(tx, facility, date, slot, opts.generateCode);
	const normalPrice = priceFor(facility, profile, seats);
	const priceCents =
		entity?.priceMode === 'free'
			? 0
			: entity?.priceMode === 'fixed'
				? entity.fixedPriceCents!
				: normalPrice;
	const bookingId = randomUUID();
	if (input.paymentMethod === 'wallet' && priceCents > 0) {
		const paid = await payWalletTx(tx, {
			userId: profile.userId,
			municipalityId,
			amountCents: priceCents,
			reference: `booking:${bookingId}`,
			now
		});
		if (!paid.ok) return paid;
	}
	const [row] = await tx
		.insert(bookings)
		.values({
			id: bookingId,
			municipalityId,
			facilityId: facility.id,
			profileId: profile.id,
			entityId: entity?.id ?? null,
			unitIndex,
			seats,
			startsAt: slot.startsAt,
			endsAt: slot.endsAt,
			status: 'confirmed',
			accessCode,
			priceCents,
			paymentMethod: input.paymentMethod ?? 'facility',
			channel: input.channel,
			createdByUserId: input.createdByUserId,
			createdAt: now
		})
		.returning();
	await notifyBooking(
		tx,
		row,
		opts.notice ?? 'confirmed',
		undefined,
		{},
		input.channel === 'online'
	);
	await notifyOpeners(tx, row, 'created', now);
	if (waitlist.mine) await claimWaitlistOffer(tx, profile.id, facility.id, slot.startsAt);
	return ok(row);
}

/** Longitud máxima del motivo de una cancelación del personal. */
export const STAFF_CANCEL_REASON_MAX = 200;

/**
 * Cancela una reserva. El personal puede hacerlo fuera de plazo, pero siempre con un motivo
 * (1–200 caracteres tras recortar; si no, `VALIDATION_FAILED`). El motivo va solo en los `params`
 * del aviso, nunca en el correo, y la cancelación no cuenta como ausencia.
 */
export async function cancelBooking(
	db: Db,
	input: CancelInput
): Promise<Result<BookingRow, CancelError>> {
	// Sin motivo válido no se abre la transacción.
	if (!validStaffReason(input)) return err('VALIDATION_FAILED');
	return db.transaction(async (tx) => {
		const result = await cancelBookingTx(tx, input);
		if (result.ok && input.byStaff && input.actorId)
			await writeActivity(tx, {
				municipalityId: input.municipalityId,
				actorId: input.actorId,
				kind: 'booking_cancelled',
				params: { detalle: input.bookingId }
			});
		return result;
	});
}

export type CancelInput = {
	municipalityId: string;
	bookingId: string;
	byStaff: boolean;
	/** Motivo de la cancelación del personal (obligatorio si `byStaff`, salvo con `season`). */
	reason?: string;
	/**
	 * Cancelación por una reserva de temporada: nombre de la entidad. Sustituye al motivo escrito;
	 * el aviso lo redacta en el idioma de quien lo lee.
	 */
	season?: string;
	/** Identifica un peche para empregar o aviso específico desa cancelación. */
	closureId?: string;
	/** Cancelación automática por festivo pechado. */
	holiday?: boolean;
	now: Date;
	actorId?: string;
};
export type CancelError =
	'NOT_FOUND' | 'ALREADY_FINAL' | 'TOO_LATE_TO_CANCEL' | 'VALIDATION_FAILED';

const validStaffReason = (input: CancelInput) => {
	if (!input.byStaff) return true;
	const length = (input.season ?? input.reason)?.trim().length ?? 0;
	return length >= 1 && length <= STAFF_CANCEL_REASON_MAX;
};

/** `cancelBooking` dentro de una transacción existente (temporadas, cierres). Mismas reglas. */
export async function cancelBookingTx(
	tx: Tx,
	input: CancelInput
): Promise<Result<BookingRow, CancelError>> {
	if (!validStaffReason(input)) return err('VALIDATION_FAILED');
	const reason = input.reason?.trim() ?? '';
	const found = await lockBooking(tx, input.municipalityId, input.bookingId);
	if (!found) return err('NOT_FOUND');
	const { booking, policy } = found;
	if (booking.status !== 'confirmed') return err('ALREADY_FINAL');
	// El personal puede cancelar fuera de plazo.
	if (!input.byStaff && !canCancel(booking.startsAt, input.now, policy)) {
		return err('TOO_LATE_TO_CANCEL');
	}
	const row = await markCancelled(tx, booking, input.now);
	// O persoal devolve sempre; a persoa só recupera o pago se aínda estaba no prazo.
	if (
		booking.paymentMethod === 'wallet' &&
		(input.byStaff || (!input.byStaff && canCancel(booking.startsAt, input.now, policy)))
	) {
		const [profile] = await tx
			.select({ userId: municipalityProfiles.userId })
			.from(municipalityProfiles)
			.where(eq(municipalityProfiles.id, booking.profileId));
		if (profile)
			await refundWalletTx(tx, {
				userId: profile.userId,
				municipalityId: booking.municipalityId,
				amountCents: booking.priceCents,
				reference: `booking:${booking.id}`,
				now: input.now
			});
	}
	const season = input.byStaff ? input.season?.trim() : undefined;
	await notifyBooking(
		tx,
		row,
		input.byStaff ? 'cancelled_by_staff' : 'cancelled',
		input.byStaff && !season ? reason : undefined,
		season ? { season } : input.closureId ? { closureId: input.closureId } : {},
		!input.byStaff
	);
	await notifyOpeners(tx, row, 'cancelled', input.now);
	await offerFreedSlot(tx, row, input.now);
	return ok(row);
}

/**
 * Mueve una reserva a otra franja de la misma instalación en una sola transacción:
 * crea la nueva (sin contar la original) y después cancela la original. Si la nueva
 * falla, no se escribe nada y la original queda intacta.
 */
export async function rescheduleBooking(
	db: Db,
	input: {
		municipalityId: string;
		bookingId: string;
		startsAt: Date;
		unitIndex?: number;
		now: Date;
	},
	opts: Pick<CreateBookingOptions, 'generateCode'> = {}
): Promise<Result<BookingRow, BookingError | 'ALREADY_FINAL' | 'TOO_LATE_TO_CANCEL'>> {
	return db.transaction(async (tx) => {
		const found = await lockBooking(tx, input.municipalityId, input.bookingId);
		if (!found) return err('NOT_FOUND');
		const { booking, policy } = found;
		if (booking.status !== 'confirmed') return err('ALREADY_FINAL');
		if (!canCancel(booking.startsAt, input.now, policy)) return err('TOO_LATE_TO_CANCEL');

		const created = await createBookingTx(
			tx,
			{
				municipalityId: booking.municipalityId,
				facilityId: booking.facilityId,
				profileId: booking.profileId,
				entityId: booking.entityId ?? undefined,
				startsAt: input.startsAt,
				unitIndex: input.unitIndex ?? booking.unitIndex ?? undefined,
				seats: booking.seats,
				channel: booking.channel,
				createdByUserId: booking.createdByUserId,
				// O pago móvese abaixo: non se pode cobrar de novo a reserva completa.
				paymentMethod: 'facility',
				now: input.now
			},
			{ ...opts, excludeBookingId: booking.id, notice: 'changed' }
		);
		if (!created.ok) return created;
		if (booking.paymentMethod === 'wallet') {
			const difference = created.value.priceCents - booking.priceCents;
			const [profile] = await tx
				.select({ userId: municipalityProfiles.userId })
				.from(municipalityProfiles)
				.where(eq(municipalityProfiles.id, booking.profileId));
			if (!profile) return err('NOT_FOUND');
			if (difference > 0) {
				const paid = await payWalletTx(tx, {
					userId: profile.userId,
					municipalityId: booking.municipalityId,
					amountCents: difference,
					reference: `booking:${created.value.id}`,
					now: input.now
				});
				if (!paid.ok) return paid;
			} else if (difference < 0) {
				await refundWalletTx(tx, {
					userId: profile.userId,
					municipalityId: booking.municipalityId,
					amountCents: -difference,
					reference: `booking:${booking.id}`,
					now: input.now
				});
			}
			const [paidBooking] = await tx
				.update(bookings)
				.set({ paymentMethod: 'wallet' })
				.where(eq(bookings.id, created.value.id))
				.returning();
			created.value = paidBooking;
		}
		await markCancelled(tx, booking, input.now);
		await offerFreedSlot(tx, booking, input.now);
		return created;
	});
}

/** Ausencia: solo reservas confirmadas ya empezadas; actualiza el perfil con `applyNoShow`. */
export async function markNoShow(
	db: Db,
	input: { municipalityId: string; bookingId: string; now: Date }
): Promise<
	Result<BookingRow, 'NOT_FOUND' | 'ALREADY_FINAL' | 'NOT_STARTED' | 'TOO_LATE_FOR_NO_SHOW'>
> {
	return db.transaction(async (tx) => {
		const found = await lockBooking(tx, input.municipalityId, input.bookingId);
		if (!found) return err('NOT_FOUND');
		const { booking, policy } = found;
		if (booking.status !== 'confirmed') return err('ALREADY_FINAL');
		if (input.now.getTime() < booking.startsAt.getTime()) return err('NOT_STARTED');
		if (input.now.getTime() > booking.endsAt.getTime() + NO_SHOW_GRACE_HOURS * 3_600_000) {
			return err('TOO_LATE_FOR_NO_SHOW');
		}

		const profileScope = and(
			eq(municipalityProfiles.id, booking.profileId),
			eq(municipalityProfiles.municipalityId, booking.municipalityId)
		);
		const [entity] = booking.entityId
			? await tx
					.select({ noShowsCount: entities.noShowsCount })
					.from(entities)
					.where(eq(entities.id, booking.entityId))
			: [];
		const [profile] = await tx
			.select()
			.from(municipalityProfiles)
			.where(profileScope)
			.for('update');
		if (!profile) return err('NOT_FOUND');
		if (entity?.noShowsCount !== false)
			await tx
				.update(municipalityProfiles)
				.set(applyNoShow(profile, input.now, policy))
				.where(profileScope);

		const [row] = await tx
			.update(bookings)
			.set({ status: 'no_show' })
			.where(and(eq(bookings.id, booking.id), eq(bookings.municipalityId, booking.municipalityId)))
			.returning();
		return ok(row);
	});
}

export type LookupMatch = {
	bookingId: string;
	facilityName: string;
	mascot: string;
	startsAt: Date;
	endsAt: Date;
	unitIndex: number | null;
	displayName: string;
	priceCents: number;
};

export type LookupError = 'NOT_FOUND' | 'NOT_TODAY' | 'ALREADY_USED' | 'CANCELLED';

/**
 * Busca un PIN de 4 cifras o un token QR firmado (solo o dentro de la URL del QR) en todo el
 * concello, sin cambiar ningún estado. Prioridad: `confirmed` de hoy (pueden ser varias)
 * → `attended` de hoy (`ALREADY_USED`) → `cancelled` de hoy (`CANCELLED`) → solo con QR, la
 * `confirmed` futura (`NOT_TODAY` con su fecha local) → `NOT_FOUND`. Un PIN solo es único
 * dentro del día: fuera de hoy sería la reserva de otra persona. «Hoy» es el día local de `now`.
 */
export async function lookupAccessCode(
	db: Db,
	input: { municipalityId: string; code: string; now: Date; qrSecret?: string | null }
): Promise<Result<LookupMatch[], LookupError> & { date?: string }> {
	// Un token QR («<uuid>.<firma>») identifica la reserva; un PIN, las del día con ese PIN.
	const raw = extractQrToken(input.code) ?? input.code.trim();
	const byQr = raw.includes('.');
	let which;
	if (byQr) {
		const bookingId = input.qrSecret ? verifyBookingQr(raw, input.qrSecret) : null;
		if (!bookingId) return err('NOT_FOUND');
		which = eq(bookings.id, bookingId);
	} else {
		const pin = normalizePin(raw);
		if (!pin) return err('NOT_FOUND');
		which = eq(bookings.accessCode, pin);
	}
	const { dayStart, dayEnd } = localDayBounds(localDateOf(input.now));
	const rows = await db
		.select({
			bookingId: bookings.id,
			status: bookings.status,
			facilityName: facilities.name,
			mascot: facilityTypes.mascot,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			unitIndex: bookings.unitIndex,
			displayName: users.displayName,
			priceCents: bookings.priceCents
		})
		.from(bookings)
		.innerJoin(
			facilities,
			and(
				eq(facilities.id, bookings.facilityId),
				eq(facilities.municipalityId, input.municipalityId)
			)
		)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, facilities.typeId),
				eq(facilityTypes.municipalityId, input.municipalityId)
			)
		)
		.innerJoin(
			municipalityProfiles,
			and(
				eq(municipalityProfiles.id, bookings.profileId),
				eq(municipalityProfiles.municipalityId, input.municipalityId)
			)
		)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(
			and(
				eq(bookings.municipalityId, input.municipalityId),
				which,
				gte(bookings.startsAt, dayStart)
			)
		)
		.orderBy(asc(bookings.startsAt), asc(facilities.name), asc(bookings.id));

	const today = rows.filter((r) => r.startsAt < dayEnd);
	const confirmed = today.filter((r) => r.status === 'confirmed');
	if (confirmed.length > 0) return ok(confirmed.map(({ status: _status, ...match }) => match));
	if (today.some((r) => r.status === 'attended')) return err('ALREADY_USED');
	if (today.some((r) => r.status === 'cancelled')) return err('CANCELLED');
	const next = byQr && rows.find((r) => r.startsAt >= dayEnd && r.status === 'confirmed');
	if (next) return { ...err('NOT_TODAY'), date: localDateOf(next.startsAt) };
	return err('NOT_FOUND');
}

/**
 * Llegada («Chegou»): solo reservas `confirmed`, desde 15 min antes del inicio hasta
 * `NO_SHOW_GRACE_HOURS` después del fin (ambos incluidos).
 */
export async function markAttended(
	db: Db,
	input: { municipalityId: string; bookingId: string; now: Date }
): Promise<Result<BookingRow, 'NOT_FOUND' | 'ALREADY_FINAL' | 'OUTSIDE_WINDOW'>> {
	return db.transaction(async (tx) => {
		const found = await lockBooking(tx, input.municipalityId, input.bookingId);
		if (!found) return err('NOT_FOUND');
		const { booking } = found;
		if (booking.status !== 'confirmed') return err('ALREADY_FINAL');
		const t = input.now.getTime();
		const opensAt = booking.startsAt.getTime() - ACCESS_WINDOW_BEFORE_MINUTES * 60_000;
		const closesAt = booking.endsAt.getTime() + NO_SHOW_GRACE_HOURS * 3_600_000;
		if (t < opensAt || t > closesAt) return err('OUTSIDE_WINDOW');
		const [row] = await tx
			.update(bookings)
			.set({ status: 'attended' })
			.where(and(eq(bookings.id, booking.id), eq(bookings.municipalityId, booking.municipalityId)))
			.returning();
		return ok(row);
	});
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

/**
 * Carga una reserva del concello tras bloquear su instalación (mismo orden de
 * bloqueo que `createBookingTx`, sin interbloqueos), con la política del concello.
 */
async function lockBooking(
	tx: Tx,
	municipalityId: string,
	bookingId: string
): Promise<{
	booking: BookingRow;
	policy: typeof municipalities.$inferSelect;
} | null> {
	const scope = and(eq(bookings.id, bookingId), eq(bookings.municipalityId, municipalityId));
	const [ref] = await tx.select({ facilityId: bookings.facilityId }).from(bookings).where(scope);
	if (!ref) return null;
	await facilityLockQuery(tx, municipalityId, ref.facilityId);
	// Relectura tras el bloqueo: otro escritor pudo cambiar el estado mientras esperábamos.
	const [booking] = await tx.select().from(bookings).where(scope);
	const [policy] = await tx
		.select()
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!booking || !policy) return null;
	return { booking, policy };
}

async function markCancelled(tx: Tx, booking: BookingRow, now: Date): Promise<BookingRow> {
	const [row] = await tx
		.update(bookings)
		.set({ status: 'cancelled', cancelledAt: now })
		.where(and(eq(bookings.id, booking.id), eq(bookings.municipalityId, booking.municipalityId)))
		.returning();
	return row;
}

/** Errores de programación (no de dominio): valores numéricos imposibles. */
function assertValidInput(input: CreateBookingInput): void {
	if (input.seats !== undefined && (!Number.isInteger(input.seats) || input.seats < 1)) {
		throw new RangeError(`seats must be an integer >= 1, got ${input.seats}`);
	}
	if (input.unitIndex !== undefined && !Number.isInteger(input.unitIndex)) {
		throw new RangeError(`unitIndex must be an integer, got ${input.unitIndex}`);
	}
}

/** Bloquea la asignación de PIN del concello y día local hasta terminar la transacción. */
export async function lockPinDay(tx: Tx, municipalityId: string, date: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`pin|${municipalityId}|${date}`}, 0))`
	);
}

/**
 * PIN único entre las reservas confirmadas del concello cuyo inicio cae en ese día local
 * y entre las que solapan la ventana de acceso (inicio − 15 min, fin) de la nueva, lo que
 * cubre las reservas que cruzan la medianoche. Como el PIN es del concello y no de la
 * instalación, el bloqueo de la fila de la instalación no basta: se toma además un
 * bloqueo consultivo por concello y día que se libera con el commit. Limitación: la clave
 * del bloqueo es el día local del inicio de la reserva nueva; dos reservas de días vecinos
 * que cruzan la medianoche y solapan sus ventanas de acceso toman claves distintas y no se
 * serializan entre sí (la comprobación de solape las ve, pero no hay exclusión mutua).
 */
async function pickPin(
	tx: Tx,
	facility: FacilityRow,
	date: string,
	slot: { startsAt: Date; endsAt: Date },
	generate: () => string = generatePin
): Promise<string> {
	const { dayStart, dayEnd } = localDayBounds(date);
	const lead = ACCESS_WINDOW_BEFORE_MINUTES * 60_000;
	await lockPinDay(tx, facility.municipalityId, date);
	const rows = await tx
		.select({ accessCode: bookings.accessCode })
		.from(bookings)
		.where(
			and(
				eq(bookings.municipalityId, facility.municipalityId),
				eq(bookings.status, 'confirmed'),
				or(
					and(gte(bookings.startsAt, dayStart), lt(bookings.startsAt, dayEnd)),
					// Ventana de acceso existente [startsAt − 15 min, endsAt) vs la nueva.
					and(
						lt(bookings.startsAt, new Date(slot.endsAt.getTime() + lead)),
						gt(bookings.endsAt, new Date(slot.startsAt.getTime() - lead))
					)
				)
			)
		);
	const taken = new Set(rows.map((r) => r.accessCode));
	// Un abono vigente ese día comparte el mismo teclado del mostrador: tampoco puede repetir PIN.
	const passRows = await tx
		.select({ pin: passes.pin })
		.from(passes)
		.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
		.where(
			and(
				eq(passTypes.municipalityId, facility.municipalityId),
				lte(passes.startsOn, date),
				gte(passes.endsOn, date)
			)
		);
	for (const row of passRows) taken.add(row.pin);
	for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt++) {
		const code = generate();
		if (!taken.has(code)) return code;
	}
	throw new Error(
		`CODE_EXHAUSTED: no free PIN after ${MAX_PIN_ATTEMPTS} attempts (municipality ${facility.municipalityId}, ${date})`
	);
}
