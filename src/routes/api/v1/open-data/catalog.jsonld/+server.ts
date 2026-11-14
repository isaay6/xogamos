// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { openDataCatalog } from '../../../../../lib/server/open-data/catalog';
export const GET: RequestHandler = async ({ locals, url }) => new Response(JSON.stringify(await openDataCatalog(locals.db, url.origin)), { headers: { 'content-type': 'application/ld+json; charset=utf-8' } });
