// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, gte, inArray, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
	bookings,
	closures,
	entities,
	facilities,
	facilityTypes,
	holidays,
	passes,
	passTypes,
	seasonBookings,
	municipalities,
	municipalityProfiles,
	notifications,
	openingHours,
	staffRoles,
	users,
	walletMovements,
	wallets
} from '../db/schema';
import { toIcs } from '../export/ics';
import { facilityLabel, nounFor } from '../../ui/booking-text';
import type { Locale } from '../../i18n';
import { getLogo } from './logo';
import { municipalityColumns } from './municipalities';

/**
 * Volcado completo de un concello en formato abierto. Solo filas de ese concello;
 * de `users` solo salen nombre, correo, teléfono y proveedor (nunca `subject`) y no
 * se toca `sessions`.
 */
export async function exportMunicipality(db: Db, municipalityId: string, now = new Date()) {
	// Sin los bytes del escudo en la fila: van aparte como base64 (`logoBase64` y `logoMime`).
	const [row] = await db
		.select(municipalityColumns)
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!row) throw new Error('MUNICIPALITY_NOT_FOUND');
	const logo = await getLogo(db, municipalityId);
	const municipality = {
		...row,
		logoMime: logo?.mime ?? null,
		logoBase64: logo ? Buffer.from(logo.bytes).toString('base64') : null
	};
	const facs = await db
		.select()
		.from(facilities)
		.where(eq(facilities.municipalityId, municipalityId))
		.orderBy(asc(facilities.name), asc(facilities.id));
	const facilityIds = facs.map((f) => f.id);
	const [types, hours, closed, holidayRows, profiles, roles, books, entityRows] = await Promise.all(
		[
			db
				.select()
				.from(facilityTypes)
				.where(eq(facilityTypes.municipalityId, municipalityId))
				.orderBy(asc(facilityTypes.nameGl), asc(facilityTypes.id)),
			facilityIds.length
				? db.select().from(openingHours).where(inArray(openingHours.facilityId, facilityIds))
				: [],
			facilityIds.length
				? db.select().from(closures).where(inArray(closures.facilityId, facilityIds))
				: [],
			db.select().from(holidays).where(eq(holidays.municipalityId, municipalityId)),
			db
				.select({
					id: municipalityProfiles.id,
					municipalityId: municipalityProfiles.municipalityId,
					userId: municipalityProfiles.userId,
					isResident: municipalityProfiles.isResident,
					noShowCount: municipalityProfiles.noShowCount,
					penaltyUntil: municipalityProfiles.penaltyUntil,
					displayName: users.displayName,
					email: users.email,
					phone: users.phone,
					provider: users.provider
				})
				.from(municipalityProfiles)
				.innerJoin(users, eq(users.id, municipalityProfiles.userId))
				.where(eq(municipalityProfiles.municipalityId, municipalityId))
				.orderBy(asc(users.displayName), asc(municipalityProfiles.id)),
			db
				.select({ id: staffRoles.id, userId: staffRoles.userId, role: staffRoles.role })
				.from(staffRoles)
				.where(eq(staffRoles.municipalityId, municipalityId)),
			db
				.select()
				.from(bookings)
				.where(eq(bookings.municipalityId, municipalityId))
				.orderBy(asc(bookings.startsAt), asc(bookings.id)),
			db
				.select({ id: entities.id, name: entities.name })
				.from(entities)
				.where(eq(entities.municipalityId, municipalityId))
		]
	);
	return {
		format: 'plataforma-reservas/export' as const,
		version: 1 as const,
		exportedAt: now.toISOString(),
		municipality,
		facilityTypes: types,
		facilities: facs,
		openingHours: hours,
		closures: closed,
		holidays: holidayRows,
		profiles,
		staffRoles: roles,
		bookings: books.map((booking) => ({
			...booking,
			entityName: entityRows.find((entity) => entity.id === booking.entityId)?.name ?? null
		}))
	};
}

export type MunicipalityExport = Awaited<ReturnType<typeof exportMunicipality>>;

/** Todos os datos persoais que a persoa pode descargar, sen datos doutras persoas. */
export async function exportMyData(db: Db, userId: string, now = new Date()) {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	if (!user) throw new Error('USER_NOT_FOUND');
	const [profiles, myBookings, myPasses, myNotices, walletRows] = await Promise.all([
		db
			.select({
				id: municipalityProfiles.id,
				municipality: municipalities.name,
				municipalitySlug: municipalities.slug,
				isResident: municipalityProfiles.isResident,
				followed: municipalityProfiles.followed,
				socialTariff: municipalityProfiles.socialTariff,
				noShowCount: municipalityProfiles.noShowCount,
				penaltyUntil: municipalityProfiles.penaltyUntil,
				rulesAcceptedAt: municipalityProfiles.rulesAcceptedAt
			})
			.from(municipalityProfiles)
			.innerJoin(municipalities, eq(municipalities.id, municipalityProfiles.municipalityId))
			.where(eq(municipalityProfiles.userId, userId))
			.orderBy(asc(municipalities.name)),
		db
			.select({
				id: bookings.id,
				municipality: municipalities.name,
				facility: facilities.name,
				startsAt: bookings.startsAt,
				endsAt: bookings.endsAt,
				status: bookings.status,
				accessCode: bookings.accessCode,
				priceCents: bookings.priceCents,
				channel: bookings.channel,
				createdAt: bookings.createdAt,
				cancelledAt: bookings.cancelledAt
			})
			.from(bookings)
			.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, bookings.profileId))
			.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
			.innerJoin(municipalities, eq(municipalities.id, bookings.municipalityId))
			.where(eq(municipalityProfiles.userId, userId))
			.orderBy(asc(bookings.startsAt)),
		db
			.select({
				id: passes.id,
				municipality: municipalities.name,
				type: passTypes.name,
				startsOn: passes.startsOn,
				endsOn: passes.endsOn,
				pin: passes.pin,
				priceCents: passes.priceCents,
				createdAt: passes.createdAt
			})
			.from(passes)
			.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, passes.profileId))
			.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
			.innerJoin(municipalities, eq(municipalities.id, passTypes.municipalityId))
			.where(eq(municipalityProfiles.userId, userId))
			.orderBy(asc(passes.startsOn)),
		db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(asc(notifications.createdAt)),
		db
			.select({
				id: walletMovements.id,
				amountCents: walletMovements.amountCents,
				kind: walletMovements.kind,
				municipalityId: walletMovements.municipalityId,
				reference: walletMovements.reference,
				createdAt: walletMovements.createdAt
			})
			.from(walletMovements)
			.innerJoin(wallets, eq(wallets.id, walletMovements.walletId))
			.where(eq(wallets.userId, userId))
			.orderBy(asc(walletMovements.createdAt), asc(walletMovements.id))
	]);
	return {
		format: 'plataforma-reservas/my-data' as const,
		version: 1 as const,
		exportedAt: now.toISOString(),
		identity: {
			displayName: user.displayName,
			email: user.email,
			phone: user.phone,
			provider: user.provider
		},
		settings: {
			textSize: user.textSize,
			highContrast: user.highContrast,
			reduceMotion: user.reduceMotion,
			easyBooking: user.easyBooking
		},
		profiles,
		bookings: myBookings,
		passes: myPasses,
		notices: myNotices,
		wallet: {
			balanceCents: walletRows.reduce((sum, movement) => sum + movement.amountCents, 0),
			movements: walletRows
		}
	};
}

export type MyDataExport = Awaited<ReturnType<typeof exportMyData>>;

/** Follas pensadas para abrir directamente no pleno, sen identificadores internos nin DNI. */
export async function exportMunicipalityWorkbook(db: Db, municipalityId: string, now = new Date()) {
	const data = await exportMunicipality(db, municipalityId, now);
	const date = (value: string) => new Date(`${value}T00:00:00`);
	const facilityIds = data.facilities.map((f) => f.id);
	const [passRows, seasonRows] = await Promise.all([
		facilityIds.length
			? db
					.select({
						name: passTypes.name,
						startsOn: passes.startsOn,
						endsOn: passes.endsOn,
						price: passes.priceCents
					})
					.from(passes)
					.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
					.where(eq(passTypes.municipalityId, municipalityId))
					.orderBy(asc(passes.startsOn))
			: [],
		facilityIds.length
			? db.select().from(seasonBookings).where(eq(seasonBookings.municipalityId, municipalityId))
			: []
	]);
	const nameOf = new Map(data.facilities.map((f) => [f.id, f.name]));
	return [
		{
			name: 'Reservas',
			headers: ['Instalación', 'Entidade', 'Comeza', 'Remata', 'Estado', 'Prezo (€)'],
			currencyColumns: [5],
			rows: data.bookings.map((b) => [
				nameOf.get(b.facilityId) ?? '',
				b.entityName ?? '',
				b.startsAt,
				b.endsAt,
				b.status,
				b.priceCents / 100
			])
		},
		{
			name: 'Persoas',
			headers: ['Nome', 'Correo', 'Teléfono', 'Empadroada', 'Faltas'],
			rows: data.profiles.map((p) => [
				p.displayName,
				p.email,
				p.phone,
				p.isResident ? 'Si' : 'Non',
				p.noShowCount
			])
		},
		{
			name: 'Instalacións',
			headers: [
				'Instalación',
				'Tipo',
				'Unidades',
				'Aforo',
				'Duración (min)',
				'Prezo empadroada (€)',
				'Prezo non empadroada (€)',
				'Accesible',
				'Activa'
			],
			currencyColumns: [5, 6],
			rows: data.facilities.map((f) => [
				f.name,
				data.facilityTypes.find((t) => t.id === f.typeId)?.nameGl ?? '',
				f.units,
				f.capacity,
				f.slotMinutes,
				f.priceResidentCents / 100,
				f.priceNonResidentCents / 100,
				f.accessible ? 'Si' : 'Non',
				f.active ? 'Si' : 'Non'
			])
		},
		{
			name: 'Horarios',
			headers: ['Instalación', 'Día', 'Abre', 'Pecha'],
			rows: data.openingHours.map((h) => [
				nameOf.get(h.facilityId) ?? '',
				h.weekday,
				h.opens,
				h.closes
			])
		},
		{
			name: 'Peches',
			headers: ['Instalación', 'Comeza', 'Remata', 'Motivo'],
			rows: data.closures.map((c) => [
				nameOf.get(c.facilityId) ?? '',
				c.startsAt,
				c.endsAt,
				c.reason
			])
		},
		{
			name: 'Abonos',
			headers: ['Tipo', 'Inicio', 'Fin', 'Prezo (€)'],
			currencyColumns: [3],
			rows: passRows.map((p) => [p.name, date(p.startsOn), date(p.endsOn), p.price / 100])
		},
		{
			name: 'Tempadas',
			headers: ['Instalación', 'Entidade', 'Día', 'Comeza', 'Remata', 'Desde', 'Ata'],
			rows: seasonRows.map((s) => [
				nameOf.get(s.facilityId) ?? '',
				s.entityName,
				s.weekday,
				s.startsTime,
				s.endsTime,
				date(s.fromDate),
				date(s.toDate)
			])
		}
	];
}

/** Calendario iCalendar con las reservas no canceladas de un perfil. */
export async function myBookingsIcs(
	db: Db,
	municipalityId: string,
	profileId: string,
	calendarName = 'Reservas',
	// Opcional: só esta reserva (botón «Engadir ao calendario» do detalle).
	bookingId?: string
): Promise<string> {
	const rows = await db
		.select({
			id: bookings.id,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			accessCode: bookings.accessCode,
			facilityName: facilities.name,
			municipalityName: municipalities.name
		})
		.from(bookings)
		.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
		.innerJoin(municipalities, eq(municipalities.id, bookings.municipalityId))
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				eq(bookings.profileId, profileId),
				ne(bookings.status, 'cancelled'),
				bookingId ? eq(bookings.id, bookingId) : undefined
			)
		)
		.orderBy(asc(bookings.startsAt), asc(bookings.id));
	return toIcs(
		calendarName,
		rows.map((r) => ({
			uid: `${r.id}@plataforma-reservas`,
			start: r.startsAt,
			end: r.endsAt,
			summary: r.facilityName,
			location: `${r.facilityName}, ${r.municipalityName}`,
			description: `Código de acceso: ${r.accessCode}`,
			status: 'CONFIRMED' as const
		}))
	);
}

/**
 * Calendario iCalendar del concello: reservas no canceladas desde 30 días antes de `now`.
 * Minimización de datos: solo instalación, unidad y horas; sin nombres ni contacto ni código.
 */
export async function municipalityCalendarIcs(
	db: Db,
	municipalityId: string,
	now: Date,
	calendarName = 'Reservas',
	locale: Locale = 'gl'
): Promise<string> {
	const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const rows = await db
		.select({
			id: bookings.id,
			startsAt: bookings.startsAt,
			endsAt: bookings.endsAt,
			unitIndex: bookings.unitIndex,
			facilityName: facilities.name,
			bookingMode: facilityTypes.bookingMode,
			mascot: facilityTypes.mascot
		})
		.from(bookings)
		.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
		.innerJoin(facilityTypes, eq(facilityTypes.id, facilities.typeId))
		.where(
			and(
				eq(bookings.municipalityId, municipalityId),
				ne(bookings.status, 'cancelled'),
				gte(bookings.startsAt, since)
			)
		)
		.orderBy(asc(bookings.startsAt), asc(bookings.id));
	return toIcs(
		calendarName,
		rows.map((r) => {
			// Ruling 8: «Pista 2», «Sala 2», «Rúa 2»… según el personaje (el índice cuenta desde 0).
			const summary = facilityLabel(
				locale,
				r.facilityName,
				r.unitIndex,
				nounFor(r.bookingMode, r.mascot)
			);
			return {
				uid: `${r.id}@plataforma-reservas`,
				start: r.startsAt,
				end: r.endsAt,
				summary,
				location: r.facilityName,
				description: '',
				status: 'CONFIRMED' as const
			};
		})
	);
}
