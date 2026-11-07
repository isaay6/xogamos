// SPDX-License-Identifier: EUPL-1.2
import { and, asc, desc, eq, gt, gte, lt, lte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	municipalityProfiles,
	passTypes,
	passes,
	users
} from '../db/schema';
import { generatePin, normalizePin } from '../domain/access-code';
import { verifyBookingQr, extractQrToken } from '../domain/booking-qr';
import { addLocalDays, localDateOf } from '../domain/time';
import { localDayBounds } from './bookings';
import { lockPinDay, type Tx } from './bookings';
import { GENERAL, priceFor } from '../domain/policies';
import { err, ok, type Result } from './result';
import { payWalletTx } from './wallet';

const passPrice = (priceCents: number) => ({
	priceResidentCents: priceCents,
	priceNonResidentCents: priceCents,
	priceSocialCents: priceCents
});

/** Tipos de abono del concello, con el precio siempre pasado por la política común. */
export async function listPassTypes(db: Db, municipalityId: string) {
	const rows = await db
		.select({
			id: passTypes.id,
			name: passTypes.name,
			days: passTypes.days,
			priceCents: passTypes.priceCents,
			facilityTypeId: passTypes.facilityTypeId,
			nameGl: facilityTypes.nameGl,
			nameEs: facilityTypes.nameEs
		})
		.from(passTypes)
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, passTypes.facilityTypeId),
				eq(facilityTypes.municipalityId, municipalityId)
			)
		)
		.where(eq(passTypes.municipalityId, municipalityId))
		.orderBy(asc(passTypes.name));
	return rows.map((r) => ({ ...r, priceCents: priceFor(passPrice(r.priceCents), GENERAL, 1) }));
}

/** Tipos de abono cuyas instalaciones no se pueden usar hoy por estar todas cerradas. */
export async function closedPassTypeIds(db: Db, municipalityId: string, now: Date) {
	const today = localDateOf(now);
	const { dayStart, dayEnd } = localDayBounds(today);
	const rows = await db
		.select({ typeId: facilities.typeId, active: facilities.active, closureId: closures.id })
		.from(facilities)
		.leftJoin(
			closures,
			and(
				eq(closures.facilityId, facilities.id),
				lt(closures.startsAt, dayEnd),
				gt(closures.endsAt, dayStart)
			)
		)
		.where(eq(facilities.municipalityId, municipalityId));
	const byType = new Map<string, { any: boolean; open: boolean }>();
	for (const row of rows) {
		const current = byType.get(row.typeId) ?? { any: false, open: false };
		current.any = true;
		current.open ||= row.active && row.closureId === null;
		byType.set(row.typeId, current);
	}
	return new Set([...byType].filter(([, value]) => value.any && !value.open).map(([id]) => id));
}

export async function createPassType(
	db: Db,
	municipalityId: string,
	input: { facilityTypeId: string; name: string; days: number; priceCents: number }
): Promise<Result<typeof passTypes.$inferSelect, 'NOT_FOUND' | 'INVALID'>> {
	if (
		!input.name.trim() ||
		!Number.isInteger(input.days) ||
		input.days < 1 ||
		!Number.isInteger(input.priceCents) ||
		input.priceCents < 0
	)
		return err('INVALID');
	const [type] = await db
		.select({ id: facilityTypes.id })
		.from(facilityTypes)
		.where(
			and(
				eq(facilityTypes.id, input.facilityTypeId),
				eq(facilityTypes.municipalityId, municipalityId)
			)
		);
	if (!type) return err('NOT_FOUND');
	const [row] = await db
		.insert(passTypes)
		.values({ ...input, name: input.name.trim(), municipalityId })
		.returning();
	return ok(row);
}

/** Vende un abono desde hoy: sus `days` incluyen el día de compra. */
export async function sellPass(
	db: Db,
	input: {
		municipalityId: string;
		passTypeId: string;
		profileId: string;
		createdBy: string;
		startsOn?: string;
		paymentMethod?: 'facility' | 'wallet';
		now: Date;
	}
): Promise<Result<typeof passes.$inferSelect, 'NOT_FOUND' | 'INSUFFICIENT_WALLET_BALANCE'>> {
	return db.transaction(async (tx) => {
		const [type] = await tx
			.select()
			.from(passTypes)
			.where(
				and(eq(passTypes.id, input.passTypeId), eq(passTypes.municipalityId, input.municipalityId))
			);
		const [profile] = await tx
			.select({ id: municipalityProfiles.id, userId: municipalityProfiles.userId })
			.from(municipalityProfiles)
			.where(
				and(
					eq(municipalityProfiles.id, input.profileId),
					eq(municipalityProfiles.municipalityId, input.municipalityId)
				)
			);
		if (!type || !profile) return err('NOT_FOUND');
		const startsOn = input.startsOn ?? localDateOf(input.now);
		if (startsOn < localDateOf(input.now)) return err('NOT_FOUND');
		const endsOn = addLocalDays(startsOn, type.days - 1);
		const pin = await pickPassPin(tx, input.municipalityId, startsOn, endsOn);
		const id = randomUUID();
		const priceCents = priceFor(passPrice(type.priceCents), GENERAL, 1);
		if (input.paymentMethod === 'wallet' && priceCents > 0) {
			const paid = await payWalletTx(tx, {
				userId: profile.userId,
				municipalityId: input.municipalityId,
				amountCents: priceCents,
				reference: `pass:${id}`,
				now: input.now
			});
			if (!paid.ok) return paid;
		}
		const [row] = await tx
			.insert(passes)
			.values({
				id,
				passTypeId: type.id,
				profileId: profile.id,
				startsOn,
				endsOn,
				pin,
				priceCents,
				createdBy: input.createdBy
			})
			.returning();
		return ok(row);
	});
}

export async function pickPassPin(
	tx: Tx,
	municipalityId: string,
	startsOn: string,
	endsOn: string
): Promise<string> {
	const days: string[] = [];
	for (let day = startsOn; day <= endsOn; day = addLocalDays(day, 1)) days.push(day);
	// El orden evita esperas circulares cuando dos abonos cubren días en común.
	for (const day of days) await lockPinDay(tx, municipalityId, day);

	const existing = await tx
		.select({ pin: passes.pin })
		.from(passes)
		.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
		.where(
			and(
				eq(passTypes.municipalityId, municipalityId),
				lte(passes.startsOn, endsOn),
				gte(passes.endsOn, startsOn)
			)
		);
	const taken = new Set(existing.map((r) => r.pin));
	for (const day of days) {
		const { dayStart, dayEnd } = localDayBounds(day);
		const rows = await tx
			.select({ pin: bookings.accessCode })
			.from(bookings)
			.where(
				and(
					eq(bookings.municipalityId, municipalityId),
					eq(bookings.status, 'confirmed'),
					gte(bookings.startsAt, dayStart),
					lt(bookings.startsAt, dayEnd)
				)
			);
		for (const row of rows) taken.add(row.pin);
	}
	for (let attempt = 0; attempt < 100; attempt++) {
		const pin = generatePin();
		if (!taken.has(pin)) return pin;
	}
	throw new Error(`CODE_EXHAUSTED: no free pass PIN for municipality ${municipalityId}`);
}

export async function listMyPasses(db: Db, municipalityId: string, profileId: string, now: Date) {
	const today = localDateOf(now);
	const rows = await db
		.select({
			id: passes.id,
			name: passTypes.name,
			startsOn: passes.startsOn,
			endsOn: passes.endsOn,
			pin: passes.pin,
			priceCents: passes.priceCents,
			sportGl: facilityTypes.nameGl,
			sportEs: facilityTypes.nameEs,
			mascot: facilityTypes.mascot
		})
		.from(passes)
		.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
		.innerJoin(
			facilityTypes,
			and(
				eq(facilityTypes.id, passTypes.facilityTypeId),
				eq(facilityTypes.municipalityId, passTypes.municipalityId)
			)
		)
		.where(
			and(
				eq(passTypes.municipalityId, municipalityId),
				eq(passes.profileId, profileId),
				gte(passes.endsOn, today)
			)
		)
		.orderBy(asc(passes.startsOn));
	return rows.map((r) => ({ ...r, priceCents: priceFor(passPrice(r.priceCents), GENERAL, 1) }));
}

export type PassLookup = {
	passId: string;
	name: string;
	displayName: string;
	startsOn: string;
	endsOn: string;
	priceCents: number;
};

/** Busca un abono vigente hoy por PIN o QR; un abono no se consume al validarlo. */
export async function lookupPassAccess(
	db: Db,
	input: { municipalityId: string; code: string; now: Date; qrSecret?: string | null }
): Promise<Result<PassLookup, 'NOT_FOUND'>> {
	const raw = extractQrToken(input.code) ?? input.code.trim();
	const byQr = raw.includes('.');
	const id = byQr && input.qrSecret ? verifyBookingQr(raw, input.qrSecret) : null;
	const pin = byQr ? null : normalizePin(raw);
	if ((byQr && !id) || (!byQr && !pin)) return err('NOT_FOUND');
	const today = localDateOf(input.now);
	const [row] = await db
		.select({
			passId: passes.id,
			name: passTypes.name,
			displayName: users.displayName,
			startsOn: passes.startsOn,
			endsOn: passes.endsOn,
			priceCents: passes.priceCents
		})
		.from(passes)
		.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
		.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, passes.profileId))
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(
			and(
				eq(passTypes.municipalityId, input.municipalityId),
				eq(municipalityProfiles.municipalityId, input.municipalityId),
				byQr ? eq(passes.id, id!) : eq(passes.pin, pin!),
				lte(passes.startsOn, today),
				gte(passes.endsOn, today)
			)
		);
	return row
		? ok({ ...row, priceCents: priceFor(passPrice(row.priceCents), GENERAL, 1) })
		: err('NOT_FOUND');
}

export async function listPassPeople(db: Db, municipalityId: string) {
	return db
		.select({ profileId: municipalityProfiles.id, displayName: users.displayName })
		.from(municipalityProfiles)
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(eq(municipalityProfiles.municipalityId, municipalityId))
		.orderBy(asc(users.displayName));
}

/** Abonos que se pueden usar hoy, los últimos vendidos primero. */
export async function listCurrentPasses(db: Db, municipalityId: string, now: Date, limit = 50) {
	const today = localDateOf(now);
	return db
		.select({
			id: passes.id,
			displayName: users.displayName,
			name: passTypes.name,
			endsOn: passes.endsOn,
			createdAt: passes.createdAt
		})
		.from(passes)
		.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
		.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, passes.profileId))
		.innerJoin(users, eq(users.id, municipalityProfiles.userId))
		.where(
			and(
				eq(passTypes.municipalityId, municipalityId),
				eq(municipalityProfiles.municipalityId, municipalityId),
				lte(passes.startsOn, today),
				gte(passes.endsOn, today)
			)
		)
		.orderBy(desc(passes.createdAt))
		.limit(limit);
}
