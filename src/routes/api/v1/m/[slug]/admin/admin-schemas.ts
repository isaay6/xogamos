// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { MASCOTS } from '../../../../../../lib/mascots';
import { IsoInstant, Slug, Uuid } from '../../../../../../lib/server/http/schemas';

export const SlugParams = z.object({ slug: Slug });
export const IdParams = z.object({ slug: Slug, id: Uuid });

const Mode = z.enum(['slot', 'unit', 'capacity', 'day']);
const Hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be HH:MM');

export const SettingsBody = z.object({
	name: z.string().trim().min(1).max(200),
	primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB'),
	cancellationDeadlineMinutes: z.number().int().min(0).max(10080),
	maxDaysAhead: z.number().int().min(1).max(90),
	noShowThreshold: z.number().int().min(1).max(10),
	penaltyDays: z.number().int().min(0).max(90),
	legalNotice: z.string().max(20_000),
	privacyPolicy: z.string().max(20_000),
	usageRules: z.string().max(20_000)
});

export const FacilityTypeBody = z.object({
	nameGl: z.string().trim().min(1).max(200),
	nameEs: z.string().trim().min(1).max(200),
	mascot: z.enum(MASCOTS),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB'),
	bookingMode: Mode
});
export const FacilityTypeOut = FacilityTypeBody.extend({
	id: z.uuid(),
	municipalityId: z.uuid()
});

export const HoursItem = z.object({
	weekday: z.number().int().min(0).max(6),
	opens: Hhmm,
	closes: Hhmm
});
export const HoursBody = z.object({ hours: z.array(HoursItem).max(70) });

export const FacilityBody = z.object({
	typeId: Uuid,
	name: z.string().trim().min(1).max(200),
	location: z.string().trim().max(120).default(''),
	address: z.string().trim().max(200).default(''),
	units: z.number().int().min(1).max(1000).default(1),
	capacity: z.number().int().min(1).max(100000).default(1),
	slotMinutes: z.number().int(),
	priceResidentCents: z.number().int(),
	priceNonResidentCents: z.number().int(),
	accessible: z.boolean().default(false),
	rules: z.string().max(5000).default('')
});
export const CreateFacilityBody = FacilityBody.extend({
	hours: z.array(HoursItem).max(70).optional()
});

export const FacilityOut = z.object({
	id: z.uuid(),
	municipalityId: z.uuid(),
	typeId: z.uuid(),
	name: z.string(),
	location: z.string(),
	address: z.string(),
	units: z.number().int(),
	capacity: z.number().int(),
	slotMinutes: z.number().int(),
	priceResidentCents: z.number().int(),
	priceNonResidentCents: z.number().int(),
	accessible: z.boolean(),
	rules: z.string(),
	active: z.boolean()
});
export const FacilityAdminOut = FacilityOut.extend({
	bookingMode: Mode,
	hours: z.array(HoursItem)
});

export const ClosureBody = z
	.object({
		startsAt: IsoInstant,
		endsAt: IsoInstant,
		reason: z.string().trim().max(200).default('')
	})
	.refine((v) => v.endsAt > v.startsAt, {
		message: 'endsAt must be after startsAt',
		path: ['endsAt']
	});
export const ClosureOut = z.object({
	id: z.uuid(),
	facilityId: z.uuid(),
	startsAt: z.string(),
	endsAt: z.string(),
	reason: z.string()
});
export const ResidencyBody = z.object({ isResident: z.boolean() });
