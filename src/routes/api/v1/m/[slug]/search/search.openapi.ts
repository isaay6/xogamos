// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../lib/server/http/openapi';
import { LocalDate, Slug, Uuid } from '../../../../../../lib/server/http/schemas';

export const SearchParams = z.object({ slug: Slug });
export const SearchQuery = z.object({
	type: Uuid,
	date: LocalDate,
	time: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM')
		.optional()
});

// Solo presente cuando un peche tapa el día o la hora, con el motivo del concello.
const ClosedOut = z
	.object({ reason: z.string(), startsOn: LocalDate, endsOn: LocalDate })
	.optional();
const DayOut = z.object({ date: z.string(), full: z.boolean(), closed: ClosedOut });
const HourOut = z.object({
	time: z.string(),
	free: z.boolean(),
	remainingSeats: z.number().int().nullable(),
	closed: ClosedOut,
	past: z.boolean().optional()
});
const OptionOut = z.object({
	facilityId: z.uuid(),
	facilityName: z.string(),
	location: z.string(),
	address: z.string(),
	unitIndex: z.number().int().nullable(),
	remainingSeats: z.number().int().nullable(),
	startsAt: z.string(),
	endsAt: z.string(),
	priceResidentCents: z.number().int(),
	priceNonResidentCents: z.number().int(),
	priceSocialCents: z.number().int().nullable()
});
const AlternativeOut = z.object({
	kind: z.enum(['same_day', 'other_day', 'similar_sport']),
	typeId: z.uuid(),
	date: z.string(),
	time: z.string().nullable(),
	count: z.number().int()
});

export const SearchOut = z.object({
	days: z.array(DayOut),
	hours: z.array(HourOut),
	options: z.array(OptionOut),
	alternatives: z.array(AlternativeOut)
});

registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/search',
	summary:
		'Search a sport: day strip, hours of a day, free options and (only when there are none) alternatives',
	auth: 'public',
	params: SearchParams,
	query: SearchQuery,
	response: SearchOut,
	errors: ['VALIDATION_FAILED', 'NOT_FOUND']
});
