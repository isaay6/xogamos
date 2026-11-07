// SPDX-License-Identifier: EUPL-1.2
// Solicitudes ao concello e as súas decisións. As aprobacións conservan as mesmas garantías que
// tempadas e peches: instalación do concello, bloqueo e cancelación co monedero cando procede.
import { and, asc, eq, gt, inArray, lt, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	entities,
	entityMembers,
	facilities,
	requests,
	users,
	type BookingRow
} from '../db/schema';
import { isLocalDate, localDateTimeToUtc } from '../domain/time';
import { cancelBookingsInClosureTx } from './admin';
import { writeActivity } from './activity-log';
import { notify } from './notifications';
import { createSeasons, seasonConflicts, type SeasonInput } from './seasons';
import { err, ok, type Result } from './result';
import { facilityLockQuery } from './bookings';

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const STATUSES = ['pendente', 'mais_datos', 'aprobada', 'rexeitada', 'retirada'] as const;
const KINDS = ['tempada', 'evento', 'outro'] as const;
type Status = (typeof STATUSES)[number];
type Kind = (typeof KINDS)[number];
type Request = typeof requests.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type RequestInput = {
	kind: Kind;
	facilityId?: string | null;
	unitIndex?: number | null;
	fromDate: string;
	toDate: string;
	weekdays?: number[] | null;
	startsTime: string;
	endsTime: string;
	title: string;
	description?: string;
	people?: number | null;
	phone: string;
	entityId?: string | null;
};

export type RequestFailure =
	'NOT_FOUND' | 'VALIDATION_FAILED' | 'FORBIDDEN' | 'INVALID_STATUS' | 'CONFLICTS';

function valid(input: RequestInput) {
	if (!KINDS.includes(input.kind)) return false;
	if (!isLocalDate(input.fromDate) || !isLocalDate(input.toDate) || input.toDate < input.fromDate)
		return false;
	if (
		!HHMM.test(input.startsTime) ||
		!HHMM.test(input.endsTime) ||
		input.endsTime <= input.startsTime
	)
		return false;
	if (!input.title.trim() || input.title.trim().length > 160 || input.phone.trim().length > 80)
		return false;
	if (
		input.people !== null &&
		input.people !== undefined &&
		(!Number.isInteger(input.people) || input.people < 1)
	)
		return false;
	if (
		input.unitIndex !== null &&
		input.unitIndex !== undefined &&
		(!Number.isInteger(input.unitIndex) || input.unitIndex < 0)
	)
		return false;
	return (
		input.kind !== 'tempada' ||
		(!!input.weekdays?.length &&
			input.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
	);
}

async function ownEntity(db: Db | Tx, municipalityId: string, userId: string, entityId: string) {
	const [row] = await db
		.select({ id: entities.id })
		.from(entityMembers)
		.innerJoin(entities, eq(entities.id, entityMembers.entityId))
		.where(
			and(
				eq(entityMembers.userId, userId),
				eq(entities.id, entityId),
				eq(entities.municipalityId, municipalityId),
				eq(entities.active, true)
			)
		);
	return row;
}

async function facilityExists(
	db: Db | Tx,
	municipalityId: string,
	facilityId: string | null | undefined
) {
	if (!facilityId) return false;
	const [row] = await db
		.select({ id: facilities.id })
		.from(facilities)
		.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)));
	return !!row;
}

export async function createRequest(
	db: Db,
	municipalityId: string,
	userId: string,
	input: RequestInput
): Promise<Result<Request, RequestFailure>> {
	if (!valid(input)) return err('VALIDATION_FAILED');
	if (input.kind === 'outro' ? input.facilityId : !input.facilityId)
		return err('VALIDATION_FAILED');
	if (input.facilityId && !(await facilityExists(db, municipalityId, input.facilityId)))
		return err('NOT_FOUND');
	if (input.entityId && !(await ownEntity(db, municipalityId, userId, input.entityId)))
		return err('NOT_FOUND');
	const [row] = await db
		.insert(requests)
		.values({
			municipalityId,
			userId,
			entityId: input.entityId ?? null,
			kind: input.kind,
			facilityId: input.facilityId ?? null,
			unitIndex: input.unitIndex ?? null,
			fromDate: input.fromDate,
			toDate: input.toDate,
			weekdays: input.kind === 'tempada' ? [...new Set(input.weekdays)].sort() : null,
			startsTime: input.startsTime,
			endsTime: input.endsTime,
			title: input.title.trim(),
			description: input.description?.trim() ?? '',
			people: input.people ?? null,
			phone: input.phone.trim()
		})
		.returning();
	return ok(row);
}

async function statusChange(
	db: Db,
	municipalityId: string,
	userId: string,
	id: string,
	from: Status[],
	status: Status,
	response: string | null,
	actorId?: string,
	now = new Date()
): Promise<Result<Request, RequestFailure>> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(requests)
			.where(
				and(
					eq(requests.id, id),
					eq(requests.municipalityId, municipalityId),
					eq(requests.userId, userId),
					inArray(requests.status, from)
				)
			);
		if (!row) return err('NOT_FOUND');
		const [saved] = await tx
			.update(requests)
			.set({
				status,
				response,
				decidedBy: actorId ?? null,
				decidedAt: actorId ? now : null,
				updatedAt: now
			})
			.where(eq(requests.id, row.id))
			.returning();
		if (status !== 'pendente') {
			await notify(tx, {
				userId: row.userId,
				municipalityId,
				kind: 'request_status',
				params: {
					requestTitle: row.title,
					requestStatus: status,
					...(response ? { response } : {})
				},
				read: !actorId
			});
		}
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'request_decided',
				params: { detalle: `${row.title}: ${status}` }
			});
		return ok(saved);
	});
}

export function withdrawRequest(db: Db, municipalityId: string, userId: string, id: string) {
	return statusChange(db, municipalityId, userId, id, ['pendente', 'mais_datos'], 'retirada', null);
}

export async function resendRequest(
	db: Db,
	municipalityId: string,
	userId: string,
	id: string,
	input: RequestInput
) {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ id: requests.id })
			.from(requests)
			.where(
				and(
					eq(requests.id, id),
					eq(requests.municipalityId, municipalityId),
					eq(requests.userId, userId),
					eq(requests.status, 'mais_datos')
				)
			)
			.for('update');
		if (!current) return err('NOT_FOUND' as const);
		if (!valid(input)) return err('VALIDATION_FAILED' as const);
		if (input.kind === 'outro' ? input.facilityId : !input.facilityId)
			return err('VALIDATION_FAILED' as const);
		if (input.facilityId && !(await facilityExists(tx, municipalityId, input.facilityId)))
			return err('NOT_FOUND' as const);
		if (input.entityId && !(await ownEntity(tx, municipalityId, userId, input.entityId)))
			return err('NOT_FOUND' as const);
		const [saved] = await tx
			.update(requests)
			.set({
				entityId: input.entityId ?? null,
				kind: input.kind,
				facilityId: input.facilityId ?? null,
				unitIndex: input.unitIndex ?? null,
				fromDate: input.fromDate,
				toDate: input.toDate,
				weekdays: input.kind === 'tempada' ? [...new Set(input.weekdays)].sort() : null,
				startsTime: input.startsTime,
				endsTime: input.endsTime,
				title: input.title.trim(),
				description: input.description?.trim() ?? '',
				people: input.people ?? null,
				phone: input.phone.trim(),
				status: 'pendente',
				response: null,
				decidedBy: null,
				decidedAt: null,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(requests.id, id),
					eq(requests.municipalityId, municipalityId),
					eq(requests.userId, userId),
					eq(requests.status, 'mais_datos')
				)
			)
			.returning();
		if (!saved) return err('NOT_FOUND' as const);
		return ok(saved);
	});
}

export function listOwnRequests(db: Db, municipalityId: string, userId: string) {
	return db
		.select()
		.from(requests)
		.where(and(eq(requests.municipalityId, municipalityId), eq(requests.userId, userId)))
		.orderBy(asc(requests.createdAt));
}

export function listRequests(
	db: Db,
	municipalityId: string,
	filters: { status?: Status; kind?: Kind } = {}
) {
	const where = [eq(requests.municipalityId, municipalityId)];
	if (filters.status) where.push(eq(requests.status, filters.status));
	if (filters.kind) where.push(eq(requests.kind, filters.kind));
	return db
		.select({
			request: requests,
			facilityName: facilities.name,
			entityName: entities.name,
			requesterName: users.displayName
		})
		.from(requests)
		.innerJoin(users, eq(users.id, requests.userId))
		.leftJoin(facilities, eq(facilities.id, requests.facilityId))
		.leftJoin(entities, eq(entities.id, requests.entityId))
		.where(and(...where))
		.orderBy(asc(requests.createdAt));
}

export async function requestConflicts(
	db: Db,
	municipalityId: string,
	request: Request,
	now: Date
): Promise<Result<BookingRow[], RequestFailure>> {
	if (!request.facilityId) return ok([]);
	if (request.kind === 'tempada') {
		const all: BookingRow[] = [];
		for (const weekday of request.weekdays ?? []) {
			const r = await seasonConflicts(
				db,
				municipalityId,
				{
					facilityId: request.facilityId,
					unitIndex: request.unitIndex,
					entityName: request.title,
					entityId: request.entityId,
					weekday,
					startsTime: request.startsTime,
					endsTime: request.endsTime,
					fromDate: request.fromDate,
					toDate: request.toDate,
					createdBy: request.userId
				},
				now
			);
			if (!r.ok) return r;
			all.push(...r.value);
		}
		return ok([...new Map(all.map((b) => [b.id, b])).values()]);
	}
	const from = localDateTimeToUtc(request.fromDate, request.startsTime);
	const to = localDateTimeToUtc(request.toDate, request.endsTime);
	return ok(
		await db
			.select()
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, municipalityId),
					eq(bookings.facilityId, request.facilityId),
					eq(bookings.status, 'confirmed'),
					lt(bookings.startsAt, to),
					gt(bookings.endsAt, from)
				)
			)
	);
}

export async function approveRequest(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	opts: { response?: string; cancelAffected?: boolean; now: Date }
): Promise<Result<Request, RequestFailure>> {
	return db.transaction(async (tx) => {
		const [initial] = await tx
			.select()
			.from(requests)
			.where(and(eq(requests.id, id), eq(requests.municipalityId, municipalityId)));
		if (!initial || (!initial.facilityId && initial.kind !== 'outro')) return err('NOT_FOUND');
		if (initial.facilityId) await facilityLockQuery(tx, municipalityId, initial.facilityId);
		const [request] = await tx
			.select()
			.from(requests)
			.where(
				and(
					eq(requests.id, id),
					eq(requests.municipalityId, municipalityId),
					or(eq(requests.status, 'pendente'), eq(requests.status, 'mais_datos'))
				)
			);
		if (!request) return err('NOT_FOUND');
		if (request.kind === 'evento') {
			const from = localDateTimeToUtc(request.fromDate, request.startsTime);
			const to = localDateTimeToUtc(request.toDate, request.endsTime);
			const conflicts = await tx
				.select({ id: bookings.id })
				.from(bookings)
				.where(
					and(
						eq(bookings.municipalityId, municipalityId),
						eq(bookings.facilityId, request.facilityId!),
						eq(bookings.status, 'confirmed'),
						lt(bookings.startsAt, to),
						gt(bookings.endsAt, from)
					)
				);
			if (conflicts.length && !opts.cancelAffected) return err('CONFLICTS');
			const [closure] = await tx
				.insert(closures)
				.values({
					facilityId: request.facilityId!,
					startsAt: from,
					endsAt: to,
					kind: 'evento',
					title: request.title,
					requestId: request.id,
					reason: ''
				})
				.returning({ id: closures.id });
			if (opts.cancelAffected) {
				const cancelled = await cancelBookingsInClosureTx(
					tx,
					municipalityId,
					closure.id,
					`Evento: ${request.title}`,
					opts.now
				);
				if (!cancelled.ok) throw new Error(`REQUEST_EVENT_CANCEL_FAILED: ${cancelled.error}`);
			}
		}
		if (request.kind === 'tempada') {
			const inputs: SeasonInput[] = (request.weekdays ?? []).map((weekday) => ({
				facilityId: request.facilityId!,
				unitIndex: request.unitIndex,
				entityName: request.title,
				entityId: request.entityId,
				weekday,
				startsTime: request.startsTime,
				endsTime: request.endsTime,
				fromDate: request.fromDate,
				toDate: request.toDate,
				createdBy: actorId
			}));
			const made = await createSeasons(tx as unknown as Db, municipalityId, inputs, {
				confirm: true,
				now: opts.now,
				actorId
			});
			if (!made.ok) {
				if (made.error === 'CONFLICTS') return err('CONFLICTS');
				if (made.error === 'SEASON_OVERLAP') return err('CONFLICTS');
				return err(made.error);
			}
		}
		const response = opts.response?.trim() || null;
		const [saved] = await tx
			.update(requests)
			.set({
				status: 'aprobada',
				response,
				decidedBy: actorId,
				decidedAt: opts.now,
				updatedAt: opts.now
			})
			.where(eq(requests.id, request.id))
			.returning();
		await notify(tx, {
			userId: request.userId,
			municipalityId,
			kind: 'request_status',
			params: {
				requestTitle: request.title,
				requestStatus: 'aprobada',
				...(response ? { response } : {})
			}
		});
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'request_decided',
			params: { detalle: `${request.title}: aprobada` }
		});
		return ok(saved);
	});
}

export async function rejectRequest(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	reason: string,
	now: Date
) {
	if (!reason.trim()) return err('VALIDATION_FAILED' as const);
	const [row] = await db
		.select({ userId: requests.userId })
		.from(requests)
		.where(and(eq(requests.id, id), eq(requests.municipalityId, municipalityId)));
	return row
		? statusChange(
				db,
				municipalityId,
				row.userId,
				id,
				['pendente', 'mais_datos'],
				'rexeitada',
				reason.trim(),
				actorId,
				now
			)
		: err('NOT_FOUND' as const);
}

export async function askMoreInfo(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	message: string,
	now: Date
) {
	if (!message.trim()) return err('VALIDATION_FAILED' as const);
	const [row] = await db
		.select({ userId: requests.userId })
		.from(requests)
		.where(and(eq(requests.id, id), eq(requests.municipalityId, municipalityId)));
	return row
		? statusChange(
				db,
				municipalityId,
				row.userId,
				id,
				['pendente'],
				'mais_datos',
				message.trim(),
				actorId,
				now
			)
		: err('NOT_FOUND' as const);
}
