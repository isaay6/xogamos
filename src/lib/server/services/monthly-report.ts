// SPDX-License-Identifier: EUPL-1.2
import { and, eq, gte, lt } from 'drizzle-orm';
import type { Locale } from '../../i18n/index';
import { t } from '../../i18n/index';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	facilities,
	municipalityProfiles,
	passes,
	passTypes,
	walletMovements
} from '../db/schema';
import { addLocalDays, addLocalMonths, localMonthStart, localTimeOf } from '../domain/time';
import { loadIndicatorInput, municipalityIndicators, summarize } from './indicators';

export type MonthlyReport = {
	figures: {
		bookings: number;
		people: number;
		occupancy: number;
		noShows: number;
		cancellations: number;
		residents: number;
		nonResidents: number;
		passes: number;
		socialTariffBookings: number;
	};
	facilities: { name: string; occupancy: number }[];
	busiestHour: number | null;
	quietestHour: number | null;
	closures: { name: string; reason: string }[];
	comparison: { bookings: number | null; occupancy: number | null };
	summary: string;
	wallet: { topUpsCents: number; paymentsCents: number };
};

const monthName = (locale: Locale, month: string) =>
	new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'gl-ES', {
		month: 'long',
		timeZone: 'UTC'
	}).format(new Date(`${month}-01T12:00:00Z`));

const change = (current: number, previous: number) =>
	previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

/** Datos agregados del informe mensual, siempre acotados al concello indicado. */
export async function monthlyReport(
	db: Db,
	municipalityId: string,
	month: string,
	locale: Locale
): Promise<MonthlyReport> {
	const from = localMonthStart(month);
	const to = localMonthStart(addLocalMonths(month, 1));
	const previousMonth = addLocalMonths(month, -1);
	const lastDay = addLocalDays(`${addLocalMonths(month, 1)}-01`, -1);
	const previousLastDay = addLocalDays(`${month}-01`, -1);
	const [indicators, previousIndicators, input, rows, closureRows, passRows, walletRows] =
		await Promise.all([
			municipalityIndicators(db, municipalityId, `${month}-01`, lastDay),
			municipalityIndicators(db, municipalityId, `${previousMonth}-01`, previousLastDay),
			loadIndicatorInput(db, municipalityId, `${month}-01`, lastDay),
			db
				.select({
					id: bookings.id,
					status: bookings.status,
					profileId: bookings.profileId,
					startsAt: bookings.startsAt,
					isResident: municipalityProfiles.isResident,
					socialTariff: municipalityProfiles.socialTariff
				})
				.from(bookings)
				.innerJoin(
					municipalityProfiles,
					and(
						eq(municipalityProfiles.id, bookings.profileId),
						eq(municipalityProfiles.municipalityId, bookings.municipalityId)
					)
				)
				.where(
					and(
						eq(bookings.municipalityId, municipalityId),
						gte(bookings.startsAt, from),
						lt(bookings.startsAt, to)
					)
				),
			db
				.select({ name: facilities.name, reason: closures.reason })
				.from(closures)
				.innerJoin(facilities, eq(facilities.id, closures.facilityId))
				.where(
					and(
						eq(facilities.municipalityId, municipalityId),
						lt(closures.startsAt, to),
						gte(closures.endsAt, from)
					)
				),
			db
				.select({ id: passes.id })
				.from(passes)
				.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
				.where(
					and(
						eq(passTypes.municipalityId, municipalityId),
						gte(passes.createdAt, from),
						lt(passes.createdAt, to)
					)
				),
			db
				.select({ amountCents: walletMovements.amountCents, kind: walletMovements.kind })
				.from(walletMovements)
				.where(
					and(
						eq(walletMovements.municipalityId, municipalityId),
						gte(walletMovements.createdAt, from),
						lt(walletMovements.createdAt, to)
					)
				)
		]);
	const current = summarize(indicators);
	const previous = summarize(previousIndicators);
	const live = rows.filter((row) => row.status !== 'cancelled');
	const noShows = live.filter((row) => row.status === 'no_show').length;
	const residents = live.filter((row) => row.isResident).length;
	const nonResidents = live.length - residents;
	const offeredHours = [
		...new Set(
			input.facilities.flatMap((facility) =>
				facility.openSlots.map((slot) => Number(localTimeOf(slot.startsAt).slice(0, 2)))
			)
		)
	].sort((a, b) => a - b);
	const byHour = new Map<number, number>();
	for (const row of live) {
		const hour = Number(localTimeOf(row.startsAt).slice(0, 2));
		byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
	}
	const rankedHours = offeredHours
		.map((hour) => ({ hour, bookings: byHour.get(hour) ?? 0 }))
		.sort((a, b) => b.bookings - a.bookings || a.hour - b.hour);
	const busy = rankedHours[0]?.bookings ? rankedHours[0].hour : null;
	const quietest = rankedHours.length > 0 ? rankedHours[rankedHours.length - 1].hour : null;
	const bookingChange = change(current.bookings, previous.bookings);
	const summary = t(locale, 'adm.informe.resumo', {
		mes: monthName(locale, month),
		reservas: current.bookings,
		variacion:
			bookingChange === null
				? t(locale, 'adm.informe.sen_comparacion')
				: t(locale, bookingChange >= 0 ? 'adm.informe.máis' : 'adm.informe.menos', {
						valor: Math.abs(bookingChange),
						mes: monthName(locale, previousMonth)
					})
	});
	return {
		figures: {
			bookings: current.bookings,
			people: new Set(live.map((row) => row.profileId)).size,
			occupancy: current.occupancy,
			noShows,
			cancellations: rows.filter((row) => row.status === 'cancelled').length,
			residents,
			nonResidents,
			passes: passRows.length,
			socialTariffBookings: live.filter((row) => row.socialTariff !== null).length
		},
		facilities: indicators.byFacility.map((facility) => ({
			name: facility.name,
			occupancy: facility.occupancy
		})),
		busiestHour: busy,
		quietestHour: quietest,
		closures: closureRows,
		comparison: {
			bookings: bookingChange,
			occupancy: change(current.occupancy, previous.occupancy)
		},
		wallet: {
			topUpsCents: walletRows
				.filter(
					(row) =>
						row.amountCents > 0 && (row.kind === 'recarga_tarxeta' || row.kind === 'recarga_mobil')
				)
				.reduce((sum, row) => sum + row.amountCents, 0),
			paymentsCents: walletRows
				.filter((row) => row.amountCents < 0)
				.reduce((sum, row) => sum + -row.amountCents, 0)
		},
		summary
	};
}
