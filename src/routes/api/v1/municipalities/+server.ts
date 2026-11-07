// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { json } from '../../../../lib/server/http/respond';
import { listMunicipalities } from '../../../../lib/server/services/municipalities';
import './municipalities.openapi';

export const GET: RequestHandler = async ({ locals }) => json(await listMunicipalities(locals.db));
