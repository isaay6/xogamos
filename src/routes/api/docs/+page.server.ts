// SPDX-License-Identifier: EUPL-1.2
import { buildOpenApiDocument } from '../../../lib/server/http/openapi';
import type { PageServerLoad } from './$types';

// A documentación usa exactamente o mesmo rexistro que /openapi.json, sen JavaScript de terceiros.
import.meta.glob('/src/routes/api/v1/**/*.openapi.ts', { eager: true });

export const load: PageServerLoad = () => {
	const document = buildOpenApiDocument() as { paths: Record<string, Record<string, any>> };
	const endpoints = Object.entries(document.paths).flatMap(([path, methods]) =>
		Object.entries(methods).map(([method, value]) => ({
			path,
			method: method.toUpperCase(),
			...(value as any)
		}))
	);
	return { endpoints };
};
