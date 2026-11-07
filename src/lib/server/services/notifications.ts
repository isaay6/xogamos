// SPDX-License-Identifier: EUPL-1.2
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { t, type Locale } from '../../i18n';
import {
	noticeKey,
	type BookingNoticeParams,
	type NoticeKind,
	type NoticeParams,
	type PersonalParams
} from '../../avisos';
import type { Db } from '../db/client';
import {
	bookings,
	facilities,
	municipalities,
	municipalityNotices,
	municipalityProfiles,
	notifications,
	outboxEmails,
	staffRoles,
	users
} from '../db/schema';
import { addLocalDays, localDateOf, localTimeOf } from '../domain/time';
import type { Hours } from '../domain/types';
import { findBookingsInClosure, findBookingsOutsideHours } from './affected';
import { err, ok, type Result } from './result';

/** Transacción de drizzle sobre `Db` (mismo tipo que `Tx` de bookings.ts, sin importarlo). */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type NotifyInput = {
	userId: string;
	municipalityId: string | null;
	kind: NoticeKind;
	bookingId?: string;
	tournamentId?: string;
	params: PersonalParams;
	/** A acción da propia persoa xa está na pantalla: non debe engadir un aviso sen ler. */
	read?: boolean;
};

export type NotificationView = {
	id: string;
	kind: NoticeKind;
	municipalityId: string | null;
	municipalitySlug: string | null;
	municipalityName: string | null;
	bookingId: string | null;
	tournamentId: string | null;
	params: Partial<NoticeParams>;
	createdAt: Date;
	readAt: Date | null;
};

export type NoticeView = {
	id: string;
	municipalityId: string;
	municipalityName: string;
	/** Para o escudo do propio concello do aviso. */
	municipalitySlug: string;
	municipalityColor: string;
	municipalityHasLogo: boolean;
	municipalityLogoVersion: number;
	title: string;
	body: string;
	startsAt: Date;
	endsAt: Date | null;
	createdAt: Date;
};

const EMAIL_LOCALES: Locale[] = ['gl', 'es'];

/** 'YYYY-MM-DD' → 'dd/MM/yyyy' para el correo. */
const spanishDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Texto del correo: solo instalación, día y hora locales y el nombre del concello, en gallego y
 * castellano. Nunca el motivo (texto libre del personal), ni nombre, teléfono, PIN o QR. Los
 * avisos que no son de una reserva no llevan parámetros.
 */
export function emailContent(
	kind: NoticeKind,
	params: Partial<BookingNoticeParams> & {
		tournamentTitle?: string;
		requestTitle?: string;
		requestStatus?: 'aprobada' | 'rexeitada' | 'mais_datos' | 'retirada';
		response?: string;
	},
	municipalityName: string
): { subject: string; body: string } {
	const safe = {
		facilityName: params.facilityName ?? '',
		date: params.date ? spanishDate(params.date) : '',
		time: params.time ?? '',
		// Avisos de torneo e de solicitude: o título vai na frase.
		tournamentTitle: params.tournamentTitle ?? '',
		requestTitle: params.requestTitle ?? '',
		requestStatus: params.requestStatus ?? '',
		response: params.response ?? '',
		personName: params.personName ?? ''
	};
	const lines = EMAIL_LOCALES.map((l) => t(l, noticeKey(kind, false, params), safe));
	const sign = t('gl', 'vec.aviso.sinatura', { concello: municipalityName });
	return {
		subject: t('gl', 'vec.aviso.asunto', { concello: municipalityName }),
		body: `${lines.join('\n')}\n\n${sign}`
	};
}

/**
 * Inserta el aviso y, si la persona activó el correo y tiene dirección, una fila en el buzón.
 * Devuelve false si ya existía (la «lembranza» es única por reserva).
 */
export async function notifyOnce(q: Db | Tx, input: NotifyInput): Promise<boolean> {
	const inserted = await q
		.insert(notifications)
		.values({
			userId: input.userId,
			municipalityId: input.municipalityId,
			kind: input.kind,
			bookingId: input.bookingId ?? null,
			tournamentId: input.tournamentId ?? null,
			params: input.params,
			readAt: input.read ? new Date() : null
		})
		.onConflictDoNothing()
		.returning({ id: notifications.id });
	if (inserted.length === 0) return false;

	const [user] = await q
		.select({ email: users.email, notifyEmail: users.notifyEmail })
		.from(users)
		.where(eq(users.id, input.userId));
	if (user?.notifyEmail && user.email && input.municipalityId) {
		const [muni] = await q
			.select({ name: municipalities.name })
			.from(municipalities)
			.where(eq(municipalities.id, input.municipalityId));
		if (muni) {
			const mail = emailContent(input.kind, input.params, muni.name);
			await q.insert(outboxEmails).values({ toAddress: user.email, ...mail });
		}
	}
	return true;
}

export async function notify(q: Db | Tx, input: NotifyInput): Promise<void> {
	await notifyOnce(q, input);
}

/** Aviso de una reserva: instalación y día/hora locales de su inicio. */
export async function notifyBooking(
	q: Db | Tx,
	booking: typeof bookings.$inferSelect,
	kind: NoticeKind,
	reason?: string,
	extra: { closureId?: string; season?: string } = {},
	read = false
): Promise<boolean> {
	const [row] = await q
		.select({ userId: municipalityProfiles.userId, facilityName: facilities.name })
		.from(municipalityProfiles)
		.innerJoin(
			facilities,
			and(
				eq(facilities.id, booking.facilityId),
				eq(facilities.municipalityId, booking.municipalityId)
			)
		)
		.where(
			and(
				eq(municipalityProfiles.id, booking.profileId),
				eq(municipalityProfiles.municipalityId, booking.municipalityId)
			)
		);
	if (!row) return false;
	const trimmed = reason?.trim();
	return notifyOnce(q, {
		userId: row.userId,
		municipalityId: booking.municipalityId,
		kind,
		bookingId: booking.id,
		params: {
			facilityName: row.facilityName,
			date: localDateOf(booking.startsAt),
			time: localTimeOf(booking.startsAt),
			...(trimmed ? { reason: trimmed } : {}),
			...(extra.closureId ? { closureId: extra.closureId } : {}),
			...(extra.season ? { season: extra.season } : {})
		},
		read
	});
}

/** Avisa ao persoal de apertura dunha reserva de hoxe ou mañá que require abrir a instalación. */
export async function notifyOpeners(
	q: Db | Tx,
	booking: typeof bookings.$inferSelect,
	action: 'created' | 'cancelled',
	now: Date
): Promise<number> {
	const date = localDateOf(booking.startsAt);
	const today = localDateOf(now);
	const tomorrow = addLocalDays(today, 1);
	if (date !== today && date !== tomorrow) return 0;
	const [facility] = await q
		.select({ name: facilities.name, needsOpening: facilities.needsOpening })
		.from(facilities)
		.where(
			and(
				eq(facilities.id, booking.facilityId),
				eq(facilities.municipalityId, booking.municipalityId)
			)
		);
	if (!facility?.needsOpening) return 0;
	// Quen reservou, en curto («Celestino R.»): abonda para recoñecelo na porta.
	const [person] = await q
		.select({ name: users.displayName })
		.from(municipalityProfiles)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(eq(municipalityProfiles.id, booking.profileId));
	const [first = '', second = ''] = (person?.name ?? '').trim().split(/\s+/);
	const personName = second ? `${first} ${second[0]}.` : first;
	const openers = await q
		.select({ userId: staffRoles.userId })
		.from(staffRoles)
		.where(
			and(eq(staffRoles.municipalityId, booking.municipalityId), eq(staffRoles.role, 'apertura'))
		);
	let sent = 0;
	for (const opener of openers) {
		if (
			await notifyOnce(q, {
				userId: opener.userId,
				municipalityId: booking.municipalityId,
				kind: 'opening',
				bookingId: booking.id,
				params: {
					facilityName: facility.name,
					date,
					time: localTimeOf(booking.startsAt),
					openingAction: action,
					personName
				}
			})
		)
			sent++;
	}
	return sent;
}

/**
 * Avisa (`closure`) a quien tiene una reserva confirmada que cae en el cierre `[from, to)` de la
 * instalación. No cancela nada. Un aviso por reserva y por cierre (`closureId` en `params`): repetir
 * el mismo cierre no duplica, pero otro cierre sobre la misma reserva avisa de nuevo.
 * Devuelve cuántos avisos creó.
 */
export async function notifyClosureAffected(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	closure: { from: Date; to: Date },
	now: Date,
	opts: { closureId: string; reason?: string }
): Promise<number> {
	const affected = await findBookingsInClosure(q, municipalityId, facilityId, closure, now);
	if (affected.length === 0) return 0;
	const already = await q
		.select({ bookingId: notifications.bookingId })
		.from(notifications)
		.where(
			and(
				eq(notifications.kind, 'closure'),
				sql`${notifications.params}->>'closureId' = ${opts.closureId}`,
				inArray(
					notifications.bookingId,
					affected.map((b) => b.id)
				)
			)
		);
	const done = new Set(already.map((r) => r.bookingId));
	let created = 0;
	for (const booking of affected) {
		if (done.has(booking.id)) continue;
		if (await notifyBooking(q, booking, 'closure', opts.reason, { closureId: opts.closureId })) {
			created++;
		}
	}
	return created;
}

/**
 * Avisa (`hours_changed`) a quien tiene una reserva confirmada futura que queda fuera del horario
 * nuevo (mismo predicado que el recuento previo). No cancela nada. Devuelve cuántos avisos creó.
 */
export async function notifyHoursChanged(
	q: Db | Tx,
	municipalityId: string,
	facilityId: string,
	hours: Hours[],
	now: Date
): Promise<number> {
	const affected = await findBookingsOutsideHours(q, municipalityId, facilityId, hours, now);
	let created = 0;
	for (const booking of affected) {
		if (await notifyBooking(q, booking, 'hours_changed')) created++;
	}
	return created;
}

export async function listNotifications(
	db: Db,
	userId: string,
	opts: { limit?: number } = {}
): Promise<NotificationView[]> {
	const rows = await db
		.select({
			id: notifications.id,
			kind: notifications.kind,
			municipalityId: notifications.municipalityId,
			municipalitySlug: municipalities.slug,
			municipalityName: municipalities.name,
			bookingId: notifications.bookingId,
			tournamentId: notifications.tournamentId,
			params: notifications.params,
			createdAt: notifications.createdAt,
			readAt: notifications.readAt
		})
		.from(notifications)
		.leftJoin(municipalities, eq(municipalities.id, notifications.municipalityId))
		.where(eq(notifications.userId, userId))
		.orderBy(desc(notifications.createdAt), desc(notifications.id))
		.limit(opts.limit ?? 50);
	return rows;
}

export async function countUnread(db: Db, userId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(notifications)
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
	return row?.n ?? 0;
}

/** Marca como leído un aviso propio. false si no existe o es de otra persona. */
export async function markRead(db: Db, userId: string, id: string): Promise<boolean> {
	const rows = await db
		.update(notifications)
		.set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
		.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
		.returning({ id: notifications.id });
	return rows.length > 0;
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
	await db
		.update(notifications)
		.set({ readAt: sql`now()` })
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Avisos vigentes (`starts_at <= now` y sin fin o fin posterior) de los concellos dados. */
export async function listMunicipalityNotices(
	db: Db,
	municipalityIds: string[],
	now: Date
): Promise<NoticeView[]> {
	if (municipalityIds.length === 0) return [];
	return db
		.select({
			id: municipalityNotices.id,
			municipalityId: municipalityNotices.municipalityId,
			municipalityName: municipalities.name,
			municipalitySlug: municipalities.slug,
			municipalityColor: municipalities.primaryColor,
			municipalityHasLogo: sql<boolean>`${municipalities.logo} is not null`,
			municipalityLogoVersion: municipalities.logoVersion,
			title: municipalityNotices.title,
			body: municipalityNotices.body,
			startsAt: municipalityNotices.startsAt,
			endsAt: municipalityNotices.endsAt,
			createdAt: municipalityNotices.createdAt
		})
		.from(municipalityNotices)
		.innerJoin(municipalities, eq(municipalities.id, municipalityNotices.municipalityId))
		.where(
			and(
				inArray(municipalityNotices.municipalityId, municipalityIds),
				lte(municipalityNotices.startsAt, now),
				or(isNull(municipalityNotices.endsAt), gt(municipalityNotices.endsAt, now))
			)
		)
		.orderBy(desc(municipalityNotices.startsAt), desc(municipalityNotices.id));
}

// ── Avisos del concello: alta, edición y baja desde administración ─────────

export type MunicipalityNoticeInput = {
	title: string;
	body: string;
	startsAt: Date;
	/** Sin fin: vigente hasta que se borre. */
	endsAt?: Date | null;
};

export type MunicipalityNoticeRow = typeof municipalityNotices.$inferSelect;

export const NOTICE_TITLE_MAX = 200;
export const NOTICE_BODY_MAX = 5000;

/** Entrada recortada o null si no es válida (título 1–200, cuerpo ≤ 5000, fin posterior al inicio). */
function noticeValues(input: MunicipalityNoticeInput) {
	const title = input.title.trim();
	const body = input.body.trim();
	const endsAt = input.endsAt ?? null;
	if (title.length < 1 || title.length > NOTICE_TITLE_MAX) return null;
	if (body.length > NOTICE_BODY_MAX) return null;
	if (Number.isNaN(input.startsAt.getTime())) return null;
	if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= input.startsAt)) return null;
	return { title, body, startsAt: input.startsAt, endsAt };
}

const noticeScope = (municipalityId: string, id: string) =>
	and(eq(municipalityNotices.id, id), eq(municipalityNotices.municipalityId, municipalityId));

export async function createMunicipalityNotice(
	db: Db,
	municipalityId: string,
	input: MunicipalityNoticeInput,
	userId: string
): Promise<Result<MunicipalityNoticeRow, 'VALIDATION_FAILED'>> {
	const values = noticeValues(input);
	if (!values) return err('VALIDATION_FAILED');
	const [row] = await db
		.insert(municipalityNotices)
		.values({ ...values, municipalityId, createdByUserId: userId })
		.returning();
	return ok(row);
}

/** Edita un aviso del concello; el de otro concello es NOT_FOUND. */
export async function updateMunicipalityNotice(
	db: Db,
	municipalityId: string,
	id: string,
	input: MunicipalityNoticeInput
): Promise<Result<MunicipalityNoticeRow, 'NOT_FOUND' | 'VALIDATION_FAILED'>> {
	const values = noticeValues(input);
	if (!values) return err('VALIDATION_FAILED');
	const [row] = await db
		.update(municipalityNotices)
		.set(values)
		.where(noticeScope(municipalityId, id))
		.returning();
	return row ? ok(row) : err('NOT_FOUND');
}

export async function deleteMunicipalityNotice(
	db: Db,
	municipalityId: string,
	id: string
): Promise<Result<{ id: string }, 'NOT_FOUND'>> {
	const rows = await db
		.delete(municipalityNotices)
		.where(noticeScope(municipalityId, id))
		.returning({ id: municipalityNotices.id });
	return rows.length > 0 ? ok(rows[0]) : err('NOT_FOUND');
}

/** Todos los avisos del concello para administración: vigentes, futuros y caducados. */
export function listMunicipalityNoticesAdmin(
	db: Db,
	municipalityId: string
): Promise<MunicipalityNoticeRow[]> {
	return db
		.select()
		.from(municipalityNotices)
		.where(eq(municipalityNotices.municipalityId, municipalityId))
		.orderBy(desc(municipalityNotices.startsAt), desc(municipalityNotices.id));
}

/** Correo opt-in: al activarlo se anota el consentimiento; al desactivarlo se retira. */
export async function setNotifyPrefs(
	db: Db,
	userId: string,
	prefs: { email: boolean },
	now: Date
): Promise<void> {
	await db
		.update(users)
		.set({
			notifyEmail: prefs.email,
			notifyConsentAt: prefs.email ? now : null
		})
		.where(eq(users.id, userId));
}
