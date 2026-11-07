// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireUser } from '../../../../../../../lib/server/http/guards';
import { fail, json } from '../../../../../../../lib/server/http/respond';
import { getSummary } from '../../../../../../../lib/server/services/me';

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (user instanceof Response) return user;
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const { db, now } = event.locals;
	const summary = await getSummary(db, municipality.id, user.id, now());
	return summary ? json(summary) : fail('NOT_FOUND');
};
