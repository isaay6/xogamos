// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../lib/server/http/openapi';
import { DateRangeQuery, Slug } from '../../../../../lib/server/http/schemas';

export const CreateMunicipalityBody = z.object({
	slug: Slug.max(80),
	name: z.string().trim().min(1).max(200),
	province: z.enum(['A Coruña', 'Lugo', 'Ourense', 'Pontevedra']),
	primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB'),
	firstAdmin: z.object({
		provider: z.enum(['clave', 'chave365']),
		subject: z.string().trim().min(1).max(64),
		displayName: z.string().trim().min(1).max(200)
	})
});

const Created = z.object({
	id: z.uuid(),
	slug: z.string(),
	name: z.string(),
	province: z.string(),
	primaryColor: z.string()
});

registerRoute({
	method: 'get',
	path: '/api/v1/deputacion/municipalities',
	summary:
		'Province-level comparison, aggregates only (no personal data): facilities, bookings, mean occupancy of facilities open in the period and no-show rate per municipality. `from` and `to` both inclusive, at most 92 days',
	auth: 'deputacion',
	query: DateRangeQuery,
	response: z.array(
		Created.omit({ primaryColor: true }).extend({
			facilities: z.number().int(),
			openFacilities: z.number().int(),
			bookings: z.number().int(),
			avgOccupancy: z.number(),
			noShowRate: z.number()
		})
	),
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN']
});

registerRoute({
	method: 'post',
	path: '/api/v1/deputacion/municipalities',
	summary:
		'Create a municipality with default policies and its first admin (identity created only if new, existing people are left untouched; role admin)',
	auth: 'deputacion',
	status: 201,
	body: CreateMunicipalityBody,
	response: Created,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'SLUG_TAKEN']
});
