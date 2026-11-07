// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { json } from '../../../../lib/server/http/respond';
import { buildOpenApiDocument } from '../../../../lib/server/http/openapi';

// Cada ruta registra su definición en un fichero *.openapi.ts hermano.
import.meta.glob('/src/routes/api/v1/**/*.openapi.ts', { eager: true });

export const GET: RequestHandler = () => json(buildOpenApiDocument());
