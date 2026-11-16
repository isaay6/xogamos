// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { safeRedirect } from './safe-redirect';
import type { Db } from '../db/client';
import { staffRoles } from '../db/schema';
import type { UserRow } from '../services/identity';

async function hasStaffRole(db: Db, userId: string): Promise<boolean> {
	const [row] = await db.select({ id: staffRoles.id }).from(staffRoles).where(eq(staffRoles.userId, userId)).limit(1);
	return row !== undefined;
}

/** Remate común: a benvida só é para veciñanza que aínda non a completou. */
export async function redirectAfterLogin(locals: App.Locals, user: UserRow, redirectTo: string): Promise<never> {
	const target = safeRedirect(redirectTo);
	const welcome = !user.onboardedAt && !(await hasStaffRole(locals.db, user.id));
	redirect(303, welcome ? `/benvida?redirectTo=${encodeURIComponent(target)}` : target);
}
