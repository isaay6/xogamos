// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { entities, entityFacilities, entityMembers, facilities, users } from '../db/schema';
import { writeActivity } from './activity-log';

export type EntityInput = {
	name: string;
	shortName: string;
	phone: string;
	priceMode: 'normal' | 'free' | 'fixed' | null;
	fixedPriceCents: number | null;
	advanceDays: number | null;
	maxActiveBookings: number | null;
	maxConsecutiveSlots: number | null;
	noShowsCount: boolean;
	facilityIds: string[];
	memberIds: string[];
};

const valid = (v: EntityInput) =>
	v.name.trim().length > 0 &&
	v.name.trim().length <= 120 &&
	/^[\p{L}0-9]{2,3}$/u.test(v.shortName) &&
	(v.priceMode !== 'fixed' || (v.fixedPriceCents !== null && v.fixedPriceCents >= 0)) &&
	(v.advanceDays === null || (Number.isInteger(v.advanceDays) && v.advanceDays >= 0)) &&
	[v.maxActiveBookings, v.maxConsecutiveSlots].every(
		(n) => n === null || (Number.isInteger(n) && n >= 1)
	);

export async function listEntities(db: Db, municipalityId: string) {
	const rows = await db
		.select()
		.from(entities)
		.where(eq(entities.municipalityId, municipalityId))
		.orderBy(asc(entities.name));
	const ids = rows.map((r) => r.id);
	const [allowed, members] = await Promise.all([
		ids.length
			? db.select().from(entityFacilities).where(inArray(entityFacilities.entityId, ids))
			: [],
		ids.length
			? db
					.select({ entityId: entityMembers.entityId, userId: users.id, name: users.displayName })
					.from(entityMembers)
					.innerJoin(users, eq(users.id, entityMembers.userId))
					.where(inArray(entityMembers.entityId, ids))
					.orderBy(asc(users.displayName))
			: []
	]);
	return rows.map((row) => ({
		...row,
		facilityIds: allowed.filter((x) => x.entityId === row.id).map((x) => x.facilityId),
		members: members.filter((x) => x.entityId === row.id)
	}));
}

export async function saveEntity(
	db: Db,
	municipalityId: string,
	actorId: string,
	input: EntityInput,
	id?: string
) {
	if (!valid(input)) return null;
	return db.transaction(async (tx) => {
		const facilityIds = [...new Set(input.facilityIds)];
		const memberIds = [...new Set(input.memberIds)];
		if (facilityIds.length) {
			const found = await tx
				.select({ id: facilities.id })
				.from(facilities)
				.where(
					and(eq(facilities.municipalityId, municipalityId), inArray(facilities.id, facilityIds))
				);
			if (found.length !== facilityIds.length) return null;
		}
		if (memberIds.length) {
			const found = await tx
				.select({ id: users.id })
				.from(users)
				.where(inArray(users.id, memberIds));
			if (found.length !== memberIds.length) return null;
		}
		const values = {
			municipalityId,
			name: input.name.trim(),
			shortName: input.shortName.toUpperCase(),
			phone: input.phone.trim(),
			priceMode: input.priceMode,
			fixedPriceCents: input.priceMode === 'fixed' ? input.fixedPriceCents : null,
			advanceDays: input.advanceDays,
			maxActiveBookings: input.maxActiveBookings,
			maxConsecutiveSlots: input.maxConsecutiveSlots,
			noShowsCount: input.noShowsCount
		};
		const [row] = id
			? await tx
					.update(entities)
					.set(values)
					.where(and(eq(entities.id, id), eq(entities.municipalityId, municipalityId)))
					.returning()
			: await tx.insert(entities).values(values).returning();
		if (!row) return null;
		await tx.delete(entityFacilities).where(eq(entityFacilities.entityId, row.id));
		await tx.delete(entityMembers).where(eq(entityMembers.entityId, row.id));
		if (facilityIds.length)
			await tx
				.insert(entityFacilities)
				.values(facilityIds.map((facilityId) => ({ entityId: row.id, facilityId })));
		if (memberIds.length)
			await tx
				.insert(entityMembers)
				.values(memberIds.map((userId) => ({ entityId: row.id, userId })));
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'entity_saved',
			params: { detalle: row.name }
		});
		return row;
	});
}

export async function setEntityActive(
	db: Db,
	municipalityId: string,
	actorId: string,
	id: string,
	active: boolean
) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(entities)
			.set({ active })
			.where(and(eq(entities.id, id), eq(entities.municipalityId, municipalityId)))
			.returning();
		if (!row) return null;
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'entity_saved',
			params: { detalle: row.name }
		});
		return row;
	});
}

export async function responsibleEntities(
	db: Db,
	municipalityId: string,
	userId: string,
	facilityId?: string
) {
	const rows = await db
		.select({
			id: entities.id,
			name: entities.name,
			advanceDays: entities.advanceDays,
			priceMode: entities.priceMode,
			fixedPriceCents: entities.fixedPriceCents,
			maxActiveBookings: entities.maxActiveBookings,
			maxConsecutiveSlots: entities.maxConsecutiveSlots,
			noShowsCount: entities.noShowsCount
		})
		.from(entityMembers)
		.innerJoin(entities, eq(entities.id, entityMembers.entityId))
		.where(
			and(
				eq(entityMembers.userId, userId),
				eq(entities.municipalityId, municipalityId),
				eq(entities.active, true)
			)
		)
		.orderBy(asc(entities.name));
	if (!facilityId) return rows;
	const allowed = await db
		.select({ entityId: entityFacilities.entityId })
		.from(entityFacilities)
		.where(eq(entityFacilities.facilityId, facilityId));
	const ids = new Set(allowed.map((row) => row.entityId));
	return rows.filter((row) => ids.has(row.id));
}

export async function addEntityMember(
	db: Db,
	municipalityId: string,
	entityId: string,
	userId: string,
	actorId: string
) {
	return db.transaction(async (tx) => {
		const [entity] = await tx
			.select({ id: entities.id, name: entities.name })
			.from(entities)
			.where(and(eq(entities.id, entityId), eq(entities.municipalityId, municipalityId)));
		if (!entity) return null;
		const [person] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
		if (!person) return null;
		await tx.insert(entityMembers).values({ entityId, userId }).onConflictDoNothing();
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'entity_saved',
			params: { detalle: entity.name }
		});
		return entity;
	});
}

export async function removeEntityMember(
	db: Db,
	municipalityId: string,
	entityId: string,
	userId: string,
	actorId: string
) {
	return db.transaction(async (tx) => {
		const [entity] = await tx
			.select({ id: entities.id, name: entities.name })
			.from(entities)
			.where(and(eq(entities.id, entityId), eq(entities.municipalityId, municipalityId)));
		if (!entity) return null;
		await tx
			.delete(entityMembers)
			.where(and(eq(entityMembers.entityId, entity.id), eq(entityMembers.userId, userId)));
		await writeActivity(tx, {
			municipalityId,
			actorId,
			kind: 'entity_saved',
			params: { detalle: entity.name }
		});
		return entity;
	});
}
