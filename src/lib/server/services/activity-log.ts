// SPDX-License-Identifier: EUPL-1.2
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '../db/client';
import { activityLogs, users } from '../db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Query = Db | Tx;

export type ActivityKind =
	| 'facility_saved'
	| 'facility_closed'
	| 'facility_reopened'
	| 'hours_saved'
	| 'closure_created'
	| 'closure_deleted'
	| 'holiday_saved'
	| 'holiday_deleted'
	| 'rules_saved'
	| 'staff_added'
	| 'staff_removed'
	| 'notice_saved'
	| 'notice_deleted'
	| 'season_saved'
	| 'season_deleted'
	| 'pass_sold'
	| 'booking_cancelled'
	| 'entity_saved'
	| 'request_decided'
	| 'tournament_saved';

export async function writeActivity(
	db: Query,
	input: {
		municipalityId: string;
		actorId: string;
		kind: ActivityKind;
		params: Record<string, string>;
	}
) {
	await db.insert(activityLogs).values(input);
}

export function listActivity(
	db: Db,
	municipalityId: string,
	filters: { kind?: string; from?: Date; to?: Date } = {}
) {
	const where = [eq(activityLogs.municipalityId, municipalityId)];
	if (filters.kind) where.push(eq(activityLogs.kind, filters.kind));
	if (filters.from) where.push(gte(activityLogs.createdAt, filters.from));
	if (filters.to) where.push(lte(activityLogs.createdAt, filters.to));
	return db
		.select({
			id: activityLogs.id,
			kind: activityLogs.kind,
			params: activityLogs.params,
			createdAt: activityLogs.createdAt,
			actorName: users.displayName
		})
		.from(activityLogs)
		.innerJoin(users, eq(users.id, activityLogs.actorId))
		.where(and(...where))
		.orderBy(desc(activityLogs.createdAt));
}
