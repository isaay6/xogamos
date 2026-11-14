// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, gte, inArray, like } from 'drizzle-orm';
import type { Db } from './client';
import {
	DEMO_DEPUTACION,
	DEMO_FACILITIES,
	DEMO_MUNICIPALITIES,
	DEMO_SLUGS,
	DEMO_SPORTS,
	DEMO_STAFF,
	DEMO_SUBJECT_PREFIX,
	LEGACY_DEMO_SLUGS,
	MASCOT_COLORS,
	demoLegal
} from './seed-data';
import {
	DEMO_DECLARATIONS,
	DEMO_PEOPLE,
	DEMO_TARIFF_OF,
	demoAvatarKey,
	generateDemoDnis
} from './seed-people';
import { hashDni } from '../domain/dni';
import { DEMO_POLICY, DEMO_TOURNAMENT, DEMO_WEEKS_BACK, planDemoWorld } from './seed-bookings';
import { addLocalDays, localDateOf, localDateTimeToUtc, localTimeOf } from '../domain/time';
import { pickPassPin } from '../services/passes';
import {
	bookings,
	closures,
	entities,
	entityFacilities,
	entityMembers,
	facilities,
	facilityTypes,
	holidays,
	municipalities,
	municipalityNotices,
	municipalityProfiles,
	passTypes,
	passes,
	requests,
	tournamentEntries,
	tournaments,
	notifications,
	openingHours,
	seasonBookings,
	staffRoles,
	users,
	wallets,
	walletMovements
} from './schema';

// Centros aproximados dos concellos da demo; son datos ficticios para probar mapas abertos.
const DEMO_COORDINATES: Record<string, [number, number]> = {
	'viana-do-bolo': [42.179, -7.113], 'a-rua': [42.392, -7.121],
	'o-barco-de-valdeorras': [42.416, -6.99], 'a-pobra-de-trives': [42.339, -7.254],
	manzaneda: [42.309, -7.232], 'vilarino-de-conso': [42.166, -7.183],
	'a-veiga': [42.241, -7.028], 'o-bolo': [42.289, -7.098], petin: [42.382, -7.126],
	larouco: [42.346, -7.164], verin: [41.94, -7.438]
};

/** Filas por INSERT: lonxe do límite de parámetros de Postgres (65 535). */
const CHUNK = 2000;

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
	for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/** Semanas de historia para unha escala (0–1]; mínimo 5 para que caiba a racha de Nerea. */
export const demoWeeksBack = (scale = 1) =>
	Math.max(5, Math.round(DEMO_WEEKS_BACK * Math.min(1, Math.max(0, scale))));

export type SeedCounts = {
	municipalities: number;
	facilities: number;
	people: number;
	bookings: number;
	holidays: number;
};

/**
 * Borra e volve crear só os datos de demostración (os concellos demo e os usuarios `DEMO-*`)
 * nunha transacción; non toca outros concellos. A historia (≈ 26 semanas atrás e 3 adiante)
 * colócase arredor de `now`. `scale` (0–1] acurta a historia para probas máis rápidas.
 * Con `dniSecret`, cada persoa leva o hash do seu DNI ficticio (`generateDemoDnis`); sen el, ningún.
 */
export async function seedDemo(
	db: Db,
	opts: { now?: Date; scale?: number; dniSecret?: string | null } = {}
): Promise<SeedCounts> {
	const now = opts.now ?? new Date();
	const dnis = opts.dniSecret ? generateDemoDnis() : null;
	const plan = planDemoWorld({ now, weeksBack: demoWeeksBack(opts.scale) });
	const allSlugs = [...DEMO_SLUGS, ...LEGACY_DEMO_SLUGS];

	return db.transaction(async (tx) => {
		// ── Limpeza ────────────────────────────────────────────────────────────
		const old = await tx
			.select({ id: municipalities.id })
			.from(municipalities)
			.where(inArray(municipalities.slug, allSlugs));
		if (old.length > 0) {
			// As reservas primeiro: as FK a perfís e usuarios son RESTRICT.
			await tx.delete(bookings).where(
				inArray(
					bookings.municipalityId,
					old.map((m) => m.id)
				)
			);
			// Os abonos tamén: as súas FK a perfís, tipos e usuarios son RESTRICT.
			const oldTypes = await tx
				.select({ id: passTypes.id })
				.from(passTypes)
				.where(
					inArray(
						passTypes.municipalityId,
						old.map((m) => m.id)
					)
				);
			if (oldTypes.length > 0) {
				await tx.delete(passes).where(
					inArray(
						passes.passTypeId,
						oldTypes.map((p) => p.id)
					)
				);
			}
		}
		await tx.delete(municipalities).where(inArray(municipalities.slug, allSlugs));
		// O libro maior non se borra en cascada: eliminar primeiro os monederos demo permite
		// volver executar a semente sen tocar ningún monedero alleo.
		const demoUsers = await tx
			.select({ id: users.id })
			.from(users)
			.where(like(users.subject, `${DEMO_SUBJECT_PREFIX}%`));
		if (demoUsers.length > 0) {
			const demoWallets = await tx
				.select({ id: wallets.id })
				.from(wallets)
				.where(
					inArray(
						wallets.userId,
						demoUsers.map((user) => user.id)
					)
				);
			if (demoWallets.length > 0) {
				await tx.delete(walletMovements).where(
					inArray(
						walletMovements.walletId,
						demoWallets.map((wallet) => wallet.id)
					)
				);
				await tx.delete(wallets).where(
					inArray(
						wallets.id,
						demoWallets.map((wallet) => wallet.id)
					)
				);
			}
		}
		// Por subject, en cualquier proveedor; las sesiones caen por cascade.
		await tx.delete(users).where(like(users.subject, `${DEMO_SUBJECT_PREFIX}%`));
		// Restos de la semilla antigua (provider 'local', subject en minúsculas).
		await tx.delete(users).where(and(eq(users.provider, 'local'), like(users.subject, 'demo-%')));

		// ── Concellos ──────────────────────────────────────────────────────────
		const munis = await tx
			.insert(municipalities)
			.values(
				DEMO_MUNICIPALITIES.map((m) => ({
					...m,
					...demoLegal(m.name),
					// A historia chega a +21 días: a ventá de reserva tamén.
					maxDaysAhead: DEMO_POLICY.maxDaysAhead
				}))
			)
			.returning({ id: municipalities.id, slug: municipalities.slug });
		const muniId = new Map(munis.map((m) => [m.slug, m.id]));
		const today = localDateOf(now);
		// Dous casos visibles na xanela da demo: peche completo e horario de domingo.
		await tx.insert(holidays).values([
			{
				municipalityId: muniId.get('viana-do-bolo')!,
				date: addLocalDays(today, 7),
				name: 'Festa de outono',
				mode: 'closed'
			},
			{
				municipalityId: muniId.get('viana-do-bolo')!,
				date: addLocalDays(today, 14),
				name: 'Día da veciñanza',
				mode: 'sunday_hours'
			}
		]);

		// ── Persoal e Deputación (tamén coa benvida feita: entran directos ao seu panel) ──
		const welcomed = new Date(now.getTime() - 30 * 86_400_000);
		const staffUsers = await tx
			.insert(users)
			.values([
				...DEMO_STAFF.map((s) => ({
					provider: s.provider,
					subject: s.subject,
					displayName: s.name,
					onboardedAt: welcomed
				})),
				{
					provider: DEMO_DEPUTACION.provider,
					subject: DEMO_DEPUTACION.subject,
					displayName: DEMO_DEPUTACION.name,
					onboardedAt: welcomed
				}
			])
			.returning({ id: users.id, subject: users.subject });
		const staffId = new Map(staffUsers.map((u) => [u.subject, u.id]));
		await tx.insert(staffRoles).values([
			...DEMO_STAFF.map((s) => ({
				userId: staffId.get(s.subject)!,
				municipalityId: muniId.get(s.municipality)!,
				role: s.role
			})),
			{
				userId: staffId.get(DEMO_DEPUTACION.subject)!,
				municipalityId: null,
				role: 'deputacion' as const
			}
		]);
		const deskOf = new Map(
			DEMO_STAFF.filter((s) => s.role === 'conserxe').map((s) => [
				s.municipality,
				staffId.get(s.subject)!
			])
		);

		// ── Veciños e perfís (contadores tirados das reservas finais) ──────────
		const personIds: string[] = [];
		await insertChunked(DEMO_PEOPLE, async (chunk) => {
			const start = personIds.length;
			const rows = await tx
				.insert(users)
				.values(
					chunk.map((p, k) => ({
						provider: p.provider,
						subject: p.subject,
						displayName: p.name,
						email: p.email,
						phone: p.phone,
						// Todos os veciños da demo xa fixeron a benvida.
						onboardedAt: welcomed,
						avatarKey: demoAvatarKey(start + k),
						textSize: p.accessibility?.textSize ?? 'normal',
						easyBooking: p.accessibility?.easyBooking ?? false,
						dniHash: dnis ? hashDni(dnis[start + k], opts.dniSecret!) : null
					}))
				)
				.returning({ id: users.id });
			personIds.push(...rows.map((r) => r.id));
		});
		// Algúns perfís non empadroados teñen a declaración feita pero sen verificar.
		let declarations = 0;
		const profileRows = DEMO_PEOPLE.flatMap((p, i) =>
			DEMO_SLUGS.filter((slug) => slug in p.profiles).map((slug) => {
				const state = plan.profiles.get(`${i}|${slug}`) ?? { noShowCount: 0, penaltyUntil: null };
				const declared = !p.profiles[slug] && i > 1 && declarations++ < DEMO_DECLARATIONS;
				return {
					rulesAcceptedAt: new Date(now.getTime() - 86_400_000),
					residencyDeclaredAt: declared ? new Date(now.getTime() - 2 * 86_400_000) : null,
					municipalityId: muniId.get(slug)!,
					userId: personIds[i],
					isResident: p.profiles[slug]!,
					socialTariff: DEMO_TARIFF_OF.get(`${i}|${slug}`) ?? null,
					noShowCount: state.noShowCount,
					penaltyUntil: state.penaltyUntil
				};
			})
		);
		const profileId = new Map<string, string>();
		await insertChunked(profileRows, async (chunk) => {
			const rows = await tx.insert(municipalityProfiles).values(chunk).returning({
				id: municipalityProfiles.id,
				municipalityId: municipalityProfiles.municipalityId,
				userId: municipalityProfiles.userId
			});
			for (const r of rows) profileId.set(`${r.userId}|${r.municipalityId}`, r.id);
		});
		// Cibrán é unha única identidade de demostración para probar as zonas de Viana e Deputación.
		const mestreIndex = DEMO_PEOPLE.findIndex((person) => person.name === 'Cibrán Ventosela');
		const mestreId = personIds[mestreIndex];
		// Pequenos saldos para probar o monedero nos dous perfís principais da demostración.
		const uxiaIndex = DEMO_PEOPLE.findIndex((person) => person.name === 'Nerea Cabaleiro');
		const [uxiaWallet, mestreWallet] = await tx
			.insert(wallets)
			.values([{ userId: personIds[uxiaIndex] }, { userId: mestreId }])
			.returning();
		await tx.insert(walletMovements).values([
			{
				walletId: uxiaWallet.id,
				amountCents: 2000,
				kind: 'recarga_tarxeta',
				municipalityId: muniId.get('viana-do-bolo')!,
				reference: 'demo-uxia-recarga',
				createdAt: welcomed
			},
			{
				walletId: uxiaWallet.id,
				amountCents: -300,
				kind: 'pago_reserva',
				municipalityId: muniId.get('viana-do-bolo')!,
				reference: 'demo-uxia-pago',
				createdAt: now
			},
			{
				walletId: mestreWallet.id,
				amountCents: 2000,
				kind: 'recarga_tarxeta',
				municipalityId: muniId.get('viana-do-bolo')!,
				reference: 'demo-mestre-recarga',
				createdAt: welcomed
			},
			{
				walletId: mestreWallet.id,
				amountCents: -1500,
				kind: 'pago_reserva',
				municipalityId: muniId.get('viana-do-bolo')!,
				reference: 'demo-mestre-reserva-pavillon',
				createdAt: now
			}
		]);
		await tx.insert(staffRoles).values([
			{ userId: mestreId, municipalityId: muniId.get('viana-do-bolo')!, role: 'admin' },
			{ userId: mestreId, municipalityId: muniId.get('viana-do-bolo')!, role: 'conserxe' },
			{
				userId:
					personIds[DEMO_PEOPLE.findIndex((person) => person.name === 'Policía Local de Viana')],
				municipalityId: muniId.get('viana-do-bolo')!,
				role: 'apertura'
			},
			{ userId: mestreId, municipalityId: null, role: 'deputacion' }
		]);

		// ── Tipos, instalacións, horarios e peches ─────────────────────────────
		const typeKey = (f: (typeof DEMO_FACILITIES)[number]) =>
			`${f.municipality}|${f.sport}|${f.bookingMode}`;
		const typeDefs = [...new Map(DEMO_FACILITIES.map((f) => [typeKey(f), f])).values()];
		const types = await tx
			.insert(facilityTypes)
			.values(
				typeDefs.map((f) => {
					const sport = DEMO_SPORTS[f.sport];
					return {
						municipalityId: muniId.get(f.municipality)!,
						nameGl: sport.nameGl,
						nameEs: sport.nameEs,
						mascot: sport.mascot,
						color: MASCOT_COLORS[sport.mascot] ?? MASCOT_COLORS.sala,
						bookingMode: f.bookingMode
					};
				})
			)
			.returning({ id: facilityTypes.id });
		const typeId = new Map(typeDefs.map((f, i) => [typeKey(f), types[i].id]));

		const facs = await tx
			.insert(facilities)
			.values(
				DEMO_FACILITIES.map((f) => ({
					latitude: DEMO_COORDINATES[f.municipality][0],
					longitude: DEMO_COORDINATES[f.municipality][1],
					municipalityId: muniId.get(f.municipality)!,
					typeId: typeId.get(typeKey(f))!,
					name: f.name,
					location: f.location,
					address: f.address,
					units: f.units,
					capacity: f.capacity,
					slotMinutes: f.slotMinutes,
					priceResidentCents: f.priceResidentCents,
					priceNonResidentCents: f.priceNonResidentCents,
					priceSocialCents: f.priceSocialCents ?? null,
					accessible: f.accessible,
					stepFreeAccess: f.stepFreeAccess ?? null,
					adaptedToilet: f.adaptedToilet ?? null,
					adaptedChangingRoom: f.adaptedChangingRoom ?? null,
					accessibleParkingNearby: f.accessibleParkingNearby ?? null,
					hearingLoop: f.hearingLoop ?? null,
					supportContact: f.supportContact ?? null,
					accessibilityNotes: f.accessibilityNotes ?? null,
					accessibilityCheckedAt: f.accessibilityCheckedAt ?? null,
					rules: f.rules,
					needsOpening: f.needsOpening ?? false,
					accessInfo: f.accessInfo ?? '',
					accessInfoEs: f.accessInfoEs ?? null
				}))
			)
			.returning({ id: facilities.id });
		const facId = new Map(DEMO_FACILITIES.map((f, i) => [f.key, facs[i].id]));
		// Entidades reais da demostración: os prezos e límites permiten probar a reserva de club.
		const seededEntities = await tx
			.insert(entities)
			.values([
				{
					municipalityId: muniId.get('viana-do-bolo')!,
					name: 'CD Viana',
					shortName: 'CDV',
					phone: '988 340 120',
					priceMode: 'free' as const,
					advanceDays: 30,
					maxActiveBookings: 6,
					noShowsCount: true
				},
				{
					municipalityId: muniId.get('viana-do-bolo')!,
					name: 'Escola de baloncesto de Viana',
					shortName: 'EBV',
					phone: '988 340 121',
					priceMode: 'normal' as const,
					noShowsCount: true
				},
				{
					municipalityId: muniId.get('a-rua')!,
					name: 'Club da Rúa',
					shortName: 'CDR',
					phone: '988 310 001',
					priceMode: 'normal' as const,
					noShowsCount: true
				},
				{
					municipalityId: muniId.get('verin')!,
					name: 'Escola Deportiva de Verín',
					shortName: 'EDV',
					phone: '988 410 001',
					priceMode: 'fixed' as const,
					fixedPriceCents: 500,
					noShowsCount: false
				}
			])
			.returning();
		const [cdViana, escola] = seededEntities;
		if (!cdViana || !escola) throw new Error('ENTITY_SEED_FAILED');
		await tx.insert(entityFacilities).values([
			{ entityId: cdViana.id, facilityId: facId.get('viana-futbol')! },
			{ entityId: cdViana.id, facilityId: facId.get('viana-futbol-7')! }
		]);
		await tx.insert(entityMembers).values({ entityId: cdViana.id, userId: mestreId });

		await tx.insert(openingHours).values(
			DEMO_FACILITIES.flatMap((f) =>
				Object.entries(f.hours).flatMap(([weekday, ranges]) =>
					ranges.map(([opens, closes]) => ({
						facilityId: facId.get(f.key)!,
						weekday: Number(weekday),
						opens,
						closes
					}))
				)
			)
		);
		await tx.insert(closures).values(
			plan.closures.map((c) => ({
				facilityId: facId.get(c.facility)!,
				startsAt: c.startsAt,
				endsAt: c.endsAt,
				reason: c.reason,
				kind: c.event ? ('evento' as const) : ('peche' as const),
				title: c.event?.title ?? null
			}))
		);

		// ── Tempadas dos clubs (as reservas xeradas non as pisan) ───────────────
		const adminOf = (slug: string) =>
			staffId.get(DEMO_STAFF.find((s) => s.municipality === slug && s.role === 'admin')!.subject)!;
		const facMuni = new Map(DEMO_FACILITIES.map((f) => [f.key, f.municipality]));
		if (plan.seasons.length > 0) {
			await tx.insert(seasonBookings).values(
				plan.seasons.map(({ facility, ...s }) => ({
					...s,
					entityId: s.entityName.startsWith('CD Viana')
						? cdViana.id
						: s.entityName.startsWith('Escola de baloncesto')
							? escola.id
							: null,
					municipalityId: muniId.get(facMuni.get(facility)!)!,
					facilityId: facId.get(facility)!,
					createdBy: adminOf(facMuni.get(facility)!),
					createdAt: welcomed
				}))
			);
		}

		// ── Reservas (inserción directa, xa coherentes coa configuración) ──────
		await insertChunked(plan.bookings, (chunk) =>
			tx.insert(bookings).values(
				chunk.map((b) => {
					const municipalityId = muniId.get(b.municipality)!;
					const userId = personIds[b.person];
					return {
						municipalityId,
						facilityId: facId.get(b.facility)!,
						profileId: profileId.get(`${userId}|${municipalityId}`)!,
						unitIndex: b.unitIndex,
						seats: b.seats,
						startsAt: b.startsAt,
						endsAt: b.endsAt,
						status: b.status,
						accessCode: b.accessCode,
						priceCents: b.priceCents,
						paymentMethod:
							userId === mestreId && b.facility === 'viana-pavillon' && b.accessCode === '9906'
								? ('wallet' as const)
								: ('facility' as const),
						channel: b.channel,
						createdByUserId: b.createdByStaff ? deskOf.get(b.municipality)! : userId,
						createdAt: b.createdAt,
						cancelledAt: b.cancelledAt
					};
				})
			)
		);
		// Reserva próxima de Cibrán como responsable do CD Viana no campo de fútbol 7.
		const clubSlot = Array.from({ length: 21 }, (_, day) => addLocalDays(today, day + 1))
			.map((date) => ({
				startsAt: localDateTimeToUtc(date, '21:00'),
				endsAt: localDateTimeToUtc(date, '22:00')
			}))
			.find(
				(slot) =>
					!plan.bookings.some(
						(booking) =>
							booking.facility === 'viana-futbol-7' &&
							booking.status !== 'cancelled' &&
							booking.startsAt < slot.endsAt &&
							slot.startsAt < booking.endsAt
					)
			);
		if (!clubSlot) throw new Error('CLUB_BOOKING_SLOT_NOT_FOUND');
		await tx.insert(bookings).values({
			municipalityId: muniId.get('viana-do-bolo')!,
			facilityId: facId.get('viana-futbol-7')!,
			profileId: profileId.get(`${mestreId}|${muniId.get('viana-do-bolo')!}`)!,
			entityId: cdViana.id,
			startsAt: clubSlot.startsAt,
			endsAt: clubSlot.endsAt,
			status: 'confirmed' as const,
			accessCode: '9910',
			priceCents: 0,
			paymentMethod: 'facility' as const,
			channel: 'online' as const,
			createdByUserId: mestreId,
			createdAt: now
		});

		// Abonos ficticios de Viana do Bolo, para un deporte aberto.
		const [vianaPassType] = await tx
			.insert(passTypes)
			.values({
				municipalityId: muniId.get('viana-do-bolo')!,
				facilityTypeId: typeId.get(
					typeKey(DEMO_FACILITIES.find((f) => f.key === 'viana-pavillon')!)
				)!,
				name: 'Abono mensual',
				days: 30,
				priceCents: 1800
			})
			.returning();
		const passStartsOn = localDateOf(now);
		const passEndsOn = addLocalDays(passStartsOn, 29);
		const vianaId = muniId.get('viana-do-bolo')!;
		const uxiaPassPin = await pickPassPin(tx, vianaId, passStartsOn, passEndsOn);
		await tx.insert(passes).values({
			passTypeId: vianaPassType.id,
			profileId: profileId.get(`${personIds[0]}|${vianaId}`)!,
			startsOn: passStartsOn,
			endsOn: passEndsOn,
			pin: uxiaPassPin,
			priceCents: 1800,
			createdBy: adminOf('viana-do-bolo')
		});
		const mestrePassPin = await pickPassPin(tx, vianaId, passStartsOn, passEndsOn);
		await tx.insert(passes).values({
			passTypeId: vianaPassType.id,
			profileId: profileId.get(`${mestreId}|${vianaId}`)!,
			startsOn: passStartsOn,
			endsOn: passEndsOn,
			pin: mestrePassPin,
			priceCents: 1800,
			createdBy: adminOf('viana-do-bolo')
		});

		// Solicitudes da historia de Viana: evento persoal e tempadas do CD Viana.
		const requestStart = addLocalDays(localDateOf(now), DEMO_TOURNAMENT.fromOffset);
		const requestEnd = addLocalDays(localDateOf(now), DEMO_TOURNAMENT.toOffset);
		const tennisDay = addLocalDays(localDateOf(now), 30);
		const seededRequests = await tx
			.insert(requests)
			.values([
				{
					municipalityId: vianaId,
					userId: mestreId,
					kind: 'evento',
					facilityId: facId.get('viana-padel')!,
					fromDate: requestStart,
					toDate: requestEnd,
					startsTime: '10:00',
					endsTime: '20:00',
					title: DEMO_TOURNAMENT.title,
					description: 'Evento aprobado para o torneo aberto.',
					people: 24,
					phone: '600 100 200',
					status: 'aprobada',
					response: 'Aprobada.',
					decidedBy: adminOf('viana-do-bolo'),
					decidedAt: now
				},
				{
					municipalityId: vianaId,
					userId: mestreId,
					kind: 'evento',
					facilityId: facId.get('viana-tenis')!,
					fromDate: tennisDay,
					toDate: tennisDay,
					startsTime: '10:00',
					endsTime: '14:00',
					title: 'Exhibición de tenis para a escola',
					description: 'Mañá de iniciación ao tenis para rapaces e rapazas.',
					people: 30,
					phone: '600 100 200'
				},
				{
					municipalityId: vianaId,
					userId: mestreId,
					entityId: cdViana.id,
					kind: 'tempada',
					facilityId: facId.get('viana-futbol-7')!,
					fromDate: addLocalDays(localDateOf(now), 20),
					toDate: addLocalDays(localDateOf(now), 90),
					weekdays: [1, 3],
					startsTime: '18:00',
					endsTime: '19:00',
					title: 'Adestramentos xuvenís',
					description: 'Cómpre indicar a categoría.',
					phone: '600 100 200',
					status: 'mais_datos',
					response: 'Indica a categoría e o número de xogadores.'
				},
				{
					municipalityId: vianaId,
					userId: mestreId,
					entityId: cdViana.id,
					kind: 'tempada',
					facilityId: facId.get('viana-futbol-7')!,
					fromDate: addLocalDays(localDateOf(now), 7),
					toDate: addLocalDays(localDateOf(now), 120),
					weekdays: [0, 2],
					startsTime: '19:00',
					endsTime: '20:00',
					title: 'Tempada CD Viana fútbol 7',
					description: 'Horario aprobado para a tempada.',
					phone: '600 100 200',
					status: 'aprobada',
					response: 'Aprobada.',
					decidedBy: adminOf('viana-do-bolo'),
					decidedAt: now
				}
			])
			.returning();
		const approvedEvent = seededRequests.find(
			(request) => request.title === DEMO_TOURNAMENT.title && request.status === 'aprobada'
		);
		if (!approvedEvent) throw new Error('TOURNAMENT_REQUEST_SEED_FAILED');
		// O bloque do torneo xa vén do plan (o xerador non pon reservas nel): só se liga á solicitude.
		await tx
			.update(closures)
			.set({ requestId: approvedEvent.id })
			.where(and(eq(closures.kind, 'evento'), eq(closures.title, DEMO_TOURNAMENT.title)));
		const [publishedTournament, pastTournament] = await tx
			.insert(tournaments)
			.values([
				{
					municipalityId: vianaId,
					requestId: approvedEvent.id,
					facilityId: facId.get('viana-padel')!,
					title: 'Torneo de pádel de Nadal',
					sportDescription: 'Pádel',
					startsOn: requestStart,
					endsOn: requestEnd,
					description: 'Torneo aberto de Nadal nas pistas municipais.',
					rules: 'Cada parella xoga co seu material.',
					format: 'parellas',
					maxEntries: 12,
					signupDeadline: localDateTimeToUtc(addLocalDays(requestStart, -1), '20:00'),
					feeCents: 0,
					createdBy: adminOf('viana-do-bolo'),
					createdAt: now
				},
				{
					municipalityId: vianaId,
					facilityId: facId.get('viana-padel')!,
					title: 'Torneo de verán de pádel',
					sportDescription: 'Pádel',
					startsOn: addLocalDays(today, -30),
					endsOn: addLocalDays(today, -29),
					description: 'Edición xa rematada.',
					rules: 'Partidos por parellas.',
					format: 'parellas',
					maxEntries: 8,
					signupDeadline: localDateTimeToUtc(addLocalDays(today, -32), '20:00'),
					feeCents: 0,
					createdBy: adminOf('viana-do-bolo'),
					createdAt: new Date(now.getTime() - 40 * 86_400_000)
				}
			])
			.returning();
		await tx.insert(tournamentEntries).values([
			{
				tournamentId: publishedTournament.id,
				userId: mestreId,
				members: 'Telmo Empadroado',
				createdAt: now
			},
			{
				tournamentId: publishedTournament.id,
				userId: personIds[0],
				members: 'Rebeca Souto',
				createdAt: now
			},
			{
				tournamentId: pastTournament.id,
				userId: personIds[1],
				members: 'Celestino Souto',
				createdAt: new Date(now.getTime() - 40 * 86_400_000)
			}
		]);

		// ── Avisos do concello e avisos persoais de Nerea ───────────────────────
		const day = 86_400_000;
		await tx.insert(municipalityNotices).values([
			{
				municipalityId: muniId.get('viana-do-bolo')!,
				title: 'Pechada ata xuño',
				body: 'A piscina municipal permanece pechada ata xuño. Seguen abertas as pistas de pádel, o tenis e o pavillón.',
				startsAt: new Date(now.getTime() - 14 * day),
				endsAt: null,
				createdByUserId: adminOf('viana-do-bolo'),
				createdAt: new Date(now.getTime() - 14 * day)
			},
			{
				municipalityId: muniId.get('a-rua')!,
				title: 'Nova iluminación na pista de pádel',
				body: 'Rematou a mellora da iluminación da pista de pádel: xa se pode xogar con luz ata o peche.',
				startsAt: new Date(now.getTime() - 3 * day),
				endsAt: new Date(now.getTime() + 30 * day),
				createdByUserId: adminOf('a-rua'),
				createdAt: new Date(now.getTime() - 3 * day)
			},
			{
				municipalityId: muniId.get('o-barco-de-valdeorras')!,
				title: 'Torneo comarcal de balonmán no pavillón',
				body: 'O pavillón municipal permanece pechado durante o torneo comarcal de balonmán.',
				startsAt: new Date(now.getTime() + 9 * day),
				endsAt: new Date(now.getTime() + 10 * day),
				createdByUserId: adminOf('o-barco-de-valdeorras'),
				createdAt: new Date(now.getTime() - day)
			}
		]);

		// Nerea (a primeira persoa): un aviso por cada reserva próxima en Viana do Bolo.
		const uxiaId = personIds[0];
		const upcoming = await tx
			.select({
				id: bookings.id,
				status: bookings.status,
				startsAt: bookings.startsAt,
				createdAt: bookings.createdAt,
				facilityName: facilities.name
			})
			.from(bookings)
			.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
			.where(
				and(
					eq(bookings.profileId, profileId.get(`${uxiaId}|${vianaId}`)!),
					eq(bookings.municipalityId, vianaId),
					gte(bookings.startsAt, now)
				)
			)
			.orderBy(asc(bookings.startsAt));
		const tomorrow = addLocalDays(localDateOf(now), 1);
		const personal: (typeof notifications.$inferInsert)[] = [];
		for (const b of upcoming) {
			const params = {
				facilityName: b.facilityName,
				date: localDateOf(b.startsAt),
				time: localTimeOf(b.startsAt)
			};
			const base = { userId: uxiaId, municipalityId: vianaId, bookingId: b.id };
			if (b.status === 'confirmed') {
				personal.push({
					...base,
					kind: 'confirmed',
					params,
					createdAt: b.createdAt,
					readAt: new Date(b.createdAt.getTime() + 3_600_000)
				});
				if (params.date === tomorrow) {
					personal.push({
						...base,
						kind: 'reminder',
						params,
						createdAt: new Date(now.getTime() - 2 * 3_600_000)
					});
				}
			} else if (b.status === 'cancelled') {
				personal.push({
					...base,
					kind: 'cancelled_by_staff',
					params: { ...params, reason: 'Mantemento da pista' },
					createdAt: new Date(now.getTime() - 3_600_000)
				});
			}
		}
		if (personal.length > 0) await tx.insert(notifications).values(personal);

		return {
			municipalities: munis.length,
			facilities: facs.length,
			people: DEMO_PEOPLE.length,
			// +1: a reserva de club de Cibrán (CD Viana), que non sae do plan xerado.
			bookings: plan.bookings.length + 1,
			holidays: 2
		};
	});
}
