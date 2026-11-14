// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../lib/server/http/openapi';

const Catalog = z.object({
	'@context': z.record(z.string(), z.string()),
	'@type': z.literal('dcat:Catalog'),
	'dcat:dataset': z.array(z.object({ '@id': z.string(), '@type': z.literal('dcat:Dataset') }))
});

registerRoute({
	method: 'get',
	path: '/api/v1/open-data/catalog.jsonld',
	summary: 'DCAT-AP-ES open-data catalog in JSON-LD. Public and free of personal data.',
	auth: 'public',
	response: Catalog,
	contentType: 'application/ld+json',
	errors: []
});

registerRoute({
	method: 'get',
	path: '/api/v1/open-data/catalog.ttl',
	summary: 'DCAT-AP-ES open-data catalog in Turtle. Public and free of personal data.',
	auth: 'public',
	response: z.string(),
	contentType: 'text/turtle',
	errors: []
});
