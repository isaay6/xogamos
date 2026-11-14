// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { MASCOTS } from '../../mascots';
import type { Db } from '../db/client';
import {
	closures,
	facilities,
	facilityTypes,
	holidays,
	municipalities,
	openingHours
} from '../db/schema';

const Input = z.object({
	format: z.literal('plataforma-reservas/export'),
	version: z.literal(1),
	municipality: z.object({
		province: z.string(),
		primaryColor: z.string(),
		cancellationDeadlineMinutes: z.number().int(),
		maxDaysAhead: z.number().int(),
		noShowThreshold: z.number().int(),
		penaltyDays: z.number().int(),
		legalNotice: z.string(),
		privacyPolicy: z.string(),
		usageRules: z.string(),
		seasonPriorityCriteria: z.string().optional()
	}),
	facilityTypes: z.array(
		z.object({
			id: z.string(),
			nameGl: z.string(),
			nameEs: z.string(),
			mascot: z.enum(MASCOTS),
			color: z.string(),
			bookingMode: z.enum(['slot', 'unit', 'capacity', 'day'])
		})
	),
	facilities: z.array(
		z.object({
			id: z.string(),
			typeId: z.string(),
			name: z.string(),
			location: z.string(),
			address: z.string(),
			latitude: z.number().nullable().optional(),
			longitude: z.number().nullable().optional(),
			units: z.number().int(),
			capacity: z.number().int(),
			slotMinutes: z.number().int(),
			priceResidentCents: z.number().int(),
			priceNonResidentCents: z.number().int(),
			priceSocialCents: z.number().int().nullable().optional(),
			accessible: z.boolean(),
			rules: z.string(),
			needsOpening: z.boolean().optional(),
			accessInfo: z.string().optional(),
			accessInfoEs: z.string().nullable().optional(),
			active: z.boolean().optional()
		})
	),
	openingHours: z.array(
		z.object({
			facilityId: z.string(),
			weekday: z.number().int().min(0).max(6),
			opens: z.string(),
			closes: z.string()
		})
	),
	closures: z
		.array(
			z.object({
				facilityId: z.string(),
				startsAt: z.coerce.date(),
				endsAt: z.coerce.date(),
				reason: z.string()
			})
		)
		.default([]),
	holidays: z
		.array(
			z.object({ date: z.string(), name: z.string(), mode: z.enum(['closed', 'sunday_hours']) })
		)
		.default([])
});

const Options = z.object({
	slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
	name: z.string().trim().min(1).max(200),
	now: z.date()
});

/** Importa só configuración. As persoas, perfís, persoal e reservas do ficheiro ignóranse expresamente. */
export async function importMunicipalityConfig(
	db: Db,
	exportJson: unknown,
	options: { slug: string; name: string; now: Date }
) {
	const data = Input.parse(exportJson);
	const parsedOptions = Options.parse(options);
	return db.transaction(async (tx) => {
		const [municipality] = await tx
			.insert(municipalities)
			.values({
				slug: parsedOptions.slug,
				name: parsedOptions.name,
				province: data.municipality.province,
				primaryColor: data.municipality.primaryColor,
				cancellationDeadlineMinutes: data.municipality.cancellationDeadlineMinutes,
				maxDaysAhead: data.municipality.maxDaysAhead,
				noShowThreshold: data.municipality.noShowThreshold,
				penaltyDays: data.municipality.penaltyDays,
				legalNotice: data.municipality.legalNotice,
				privacyPolicy: data.municipality.privacyPolicy,
				usageRules: data.municipality.usageRules,
				seasonPriorityCriteria: data.municipality.seasonPriorityCriteria ?? ''
			})
			.returning();
		const typeIds = new Map<string, string>();
		for (const item of data.facilityTypes) {
			const [created] = await tx
				.insert(facilityTypes)
				.values({
					municipalityId: municipality.id,
					nameGl: item.nameGl,
					nameEs: item.nameEs,
					mascot: item.mascot,
					color: item.color,
					bookingMode: item.bookingMode
				})
				.returning();
			typeIds.set(item.id, created.id);
		}
		const facilityIds = new Map<string, string>();
		for (const item of data.facilities) {
			const typeId = typeIds.get(item.typeId);
			if (!typeId) throw new Error('INVALID_FACILITY_TYPE_REFERENCE');
			const { id: oldId, ...facility } = item;
			const [created] = await tx
				.insert(facilities)
				.values({
					...facility,
					typeId,
					municipalityId: municipality.id,
					active: item.active ?? true,
					needsOpening: item.needsOpening ?? false,
					accessInfo: item.accessInfo ?? '',
					accessInfoEs: item.accessInfoEs ?? null
				})
				.returning();
			facilityIds.set(oldId, created.id);
		}
		const hours = data.openingHours.flatMap((item) => {
			const facilityId = facilityIds.get(item.facilityId);
			return facilityId ? [{ ...item, facilityId }] : [];
		});
		if (hours.length) await tx.insert(openingHours).values(hours);
		const future = data.closures.flatMap((item) => {
			const facilityId = facilityIds.get(item.facilityId);
			return facilityId && item.endsAt > parsedOptions.now
				? [{ facilityId, startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason }]
				: [];
		});
		if (future.length) await tx.insert(closures).values(future);
		if (data.holidays.length)
			await tx
				.insert(holidays)
				.values(data.holidays.map((item) => ({ ...item, municipalityId: municipality.id })));
		return municipality;
	});
}
