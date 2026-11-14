// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { catalogTurtle, openDataCatalog } from '../../../../../lib/server/open-data/catalog';
export const GET: RequestHandler = async ({ locals, url }) =>
	new Response(catalogTurtle(await openDataCatalog(locals.db, url.origin)), {
		headers: { 'content-type': 'text/turtle; charset=utf-8' }
	});
