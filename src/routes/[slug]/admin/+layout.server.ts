// SPDX-License-Identifier: EUPL-1.2
import { requireAdminPage } from './guard';
import { and, count, eq } from 'drizzle-orm';
import { requests } from '../../../lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { user, municipality } = await requireAdminPage(event);
	const [pending] = await event.locals.db
		.select({ n: count() })
		.from(requests)
		.where(and(eq(requests.municipalityId, municipality.id), eq(requests.status, 'pendente')));
	return { staffName: user.displayName, pendingRequests: pending?.n ?? 0 };
};
