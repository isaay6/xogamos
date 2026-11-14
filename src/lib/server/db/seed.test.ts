// SPDX-License-Identifier: EUPL-1.2
import { createHash } from 'node:crypto';
import { eq, inArray, isNotNull, like } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '../../ui/format';
import { generateSlots } from '../domain/slots';
import { addLocalDays, localDateOf, localDateTimeToUtc } from '../domain/time';
import type { Db } from './client';
import { createTestDb } from './test-db';
import { listMunicipalityNotices, listNotifications } from '../services/notifications';
import { listFollowed } from '../services/profiles';
import { demoWeeksBack, seedDemo } from './seed';
import { DEMO_DAYS_AHEAD, DEMO_POLICY, planDemoWorld } from './seed-bookings';
import { DEMO_MUNICIPALITIES, DEMO_SLUGS, DEMO_STAFF } from './seed-data';
import { AVATARS } from '../../avatars';
import { DEMO_DNIS, DEMO_PEOPLE } from './seed-people';
import { findPersonByDni } from '../services/staff';
import { getAvailability } from '../services/bookings';
import { listSeasons } from '../services/seasons';
import {
	bookings,
	closures,
	facilities,
	facilityTypes,
	holidays,
	municipalities,
	municipalityNotices,
	municipalityProfiles,
	notifications,
	openingHours,
	passes,
	passTypes,
	staffRoles,
	users,
	wallets,
	walletMovements
} from './schema';

// Xoves 22 out 2026, 18:30 en Madrid.
const NOW = new Date('2026-10-22T16:30:00Z');
const SMALL = { now: NOW, scale: 0.2 };

const VIANA_FACILITIES = [
	'Campo de fútbol As Carrelas',
	'Campo de fútbol 7',
	'Pavillón polideportivo',
	'Piscina municipal · vaso de adultos',
	'Piscina municipal · vaso infantil',
	'Pistas de pádel',
	'Pista de tenis'
];

// Cada proba sementa o mundo da demo enteiro: coa suite completa en paralelo pasa dos 30 s xerais.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe('concellos da demo', () => {
	it('once concellos reais de Ourense, con cor lexible en branco', () => {
		expect(DEMO_MUNICIPALITIES.map((m) => m.slug)).toEqual([...DEMO_SLUGS]);
		expect(DEMO_MUNICIPALITIES.map((m) => m.name)).toEqual([
			'Viana do Bolo',
			'A Rúa',
			'O Barco de Valdeorras',
			'A Pobra de Trives',
			'Manzaneda',
			'Vilariño de Conso',
			'A Veiga',
			'O Bolo',
			'Petín',
			'Larouco',
			'Verín'
		]);
		const colors = new Set<string>();
		for (const m of DEMO_MUNICIPALITIES) {
			expect(m.province).toBe('Ourense');
			expect(contrastRatio(m.primaryColor, '#FFFFFF')!, m.slug).toBeGreaterThanOrEqual(4.5);
			colors.add(m.primaryColor);
		}
		expect(colors.size).toBe(DEMO_MUNICIPALITIES.length);
	});

	it('unha administradora e un conserxe por concello', () => {
		for (const slug of DEMO_SLUGS) {
			expect(DEMO_STAFF.filter((s) => s.municipality === slug && s.role === 'admin')).toHaveLength(
				1
			);
			expect(
				DEMO_STAFF.filter((s) => s.municipality === slug && s.role === 'conserxe')
			).toHaveLength(1);
		}
	});
});

/** Filas de reservas sen ids aleatorios, para comparar dúas sementes. */
async function bookingDigest(db: Db): Promise<string> {
	const rows = await db
		.select({
			b: bookings,
			facility: facilities.name,
			slug: municipalities.slug,
			subject: users.subject
		})
		.from(bookings)
		.innerJoin(facilities, eq(facilities.id, bookings.facilityId))
		.innerJoin(municipalities, eq(municipalities.id, bookings.municipalityId))
		.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, bookings.profileId))
		.innerJoin(users, eq(users.id, municipalityProfiles.userId));
	const creators = new Map(
		(await db.select({ id: users.id, subject: users.subject }).from(users)).map((u) => [
			u.id,
			u.subject
		])
	);
	const lines = rows
		.map(({ b, facility, slug, subject }) =>
			[
				slug,
				facility,
				subject,
				b.unitIndex,
				b.seats,
				b.startsAt.toISOString(),
				b.endsAt.toISOString(),
				b.status,
				b.accessCode,
				b.priceCents,
				b.channel,
				creators.get(b.createdByUserId),
				b.createdAt.toISOString(),
				b.cancelledAt?.toISOString() ?? ''
			].join('|')
		)
		.sort();
	return createHash('sha256').update(lines.join('\n')).digest('hex');
}

describe('seedDemo', () => {
	it('mundo completo: contas, ventá de −26 a +3 semanas e tempo', async () => {
		const db = await createTestDb();
		const t0 = performance.now();
		const counts = await seedDemo(db, { now: NOW });
		const ms = performance.now() - t0;
		console.info(`seedDemo (completo): ${Math.round(ms)} ms, ${JSON.stringify(counts)}`);
		expect(counts.municipalities).toBe(11);
		expect(counts.facilities).toBe(49);
		expect(counts.people).toBeGreaterThanOrEqual(900);
		expect(counts.people).toBeLessThanOrEqual(1200);
		expect(counts.bookings).toBeGreaterThan(10_000);
		expect(counts.holidays).toBe(2);
		expect(await db.$count(bookings)).toBe(counts.bookings);
		expect(await db.$count(wallets)).toBe(2);
		expect(await db.$count(walletMovements)).toBe(4);
		const today = localDateOf(NOW);
		const all = await db.select({ s: bookings.startsAt }).from(bookings);
		const dates = all.map((b) => localDateOf(b.s)).sort();
		expect(dates[0] <= addLocalDays(today, -175)).toBe(true);
		expect(dates[0] >= addLocalDays(today, -182)).toBe(true);
		expect(dates.at(-1)! >= addLocalDays(today, 18)).toBe(true);
		expect(dates.at(-1)! <= addLocalDays(today, 21)).toBe(true);
		// Sen límite de tempo: coa suite completa en paralelo o tempo varía moito (ver o informe).
	}, 120_000);

	it('idempotente, e borra a semente antiga e os usuarios demo locais', async () => {
		const db = await createTestDb();
		await db.insert(municipalities).values({
			slug: 'ribadavila',
			name: 'Ribadávila',
			province: 'Ourense',
			primaryColor: '#000'
		});
		await db.insert(users).values({ provider: 'local', subject: 'demo-3', displayName: 'Vella' });
		const first = await seedDemo(db, SMALL);
		const again = await seedDemo(db, SMALL);
		expect(again).toEqual(first);
		expect(await db.$count(municipalities)).toBe(11);
		expect(await db.$count(facilities)).toBe(49);
		expect(await db.$count(bookings)).toBe(first.bookings);
		// +1 da Deputación, +3 dos papeis de Cibrán e +1 da Policía Local de Viana.
		expect(await db.$count(staffRoles)).toBe(DEMO_STAFF.length + 5);
		expect(await db.$count(users)).toBe(DEMO_PEOPLE.length + DEMO_STAFF.length + 1);
		expect(await db.select().from(users).where(eq(users.subject, 'demo-3'))).toHaveLength(0);
		expect(
			await db.select().from(municipalities).where(eq(municipalities.slug, 'ribadavila'))
		).toHaveLength(0);
	});

	it('avisos: 2 vixentes do concello e os persoais de Nerea, sen duplicar ao repetir', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		await seedDemo(db, SMALL);
		expect(await db.$count(municipalityNotices)).toBe(3);
		const munis = await db.select().from(municipalities);
		const all = await listMunicipalityNotices(
			db,
			munis.map((m) => m.id),
			NOW
		);
		expect(all.map((n) => `${n.municipalityName}: ${n.title}`).sort()).toEqual([
			'A Rúa: Nova iluminación na pista de pádel',
			'Viana do Bolo: Pechada ata xuño'
		]);
		const [uxia] = await db.select().from(users).where(eq(users.displayName, 'Nerea Cabaleiro'));
		const mine = await listNotifications(db, uxia.id);
		const kinds = mine.map((n) => n.kind);
		expect(kinds).toContain('confirmed');
		expect(kinds).toContain('reminder');
		expect(kinds).toContain('cancelled_by_staff');
		expect(mine.every((n) => n.municipalitySlug === 'viana-do-bolo')).toBe(true);
		expect(mine.some((n) => n.readAt === null)).toBe(true);
		// Só avisos de Nerea: ninguén máis os ten.
		expect(await db.$count(notifications)).toBe(mine.length);
	});

	it('non toca outros concellos', async () => {
		const db = await createTestDb();
		const [other] = await db
			.insert(municipalities)
			.values({ slug: 'outro', name: 'Outro', province: 'Pontevedra', primaryColor: '#000000' })
			.returning();
		await seedDemo(db, SMALL);
		await seedDemo(db, SMALL);
		const rows = await db.select().from(municipalities).where(eq(municipalities.id, other.id));
		expect(rows).toHaveLength(1);
		expect(await db.$count(municipalities)).toBe(12);
	});

	it('concellos, instalacións de Viana, modos e perfís de Nerea', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const munis = await db.select().from(municipalities);
		for (const m of munis) {
			expect(m.province).toBe('Ourense');
			expect(m.logo).toBeNull();
			expect(m.legalNotice).toContain(m.name);
		}
		const [viana] = munis.filter((m) => m.slug === 'viana-do-bolo');
		const vianaFacs = await db
			.select({
				name: facilities.name,
				needsOpening: facilities.needsOpening,
				accessInfo: facilities.accessInfo,
				accessInfoEs: facilities.accessInfoEs,
				units: facilities.units,
				priceResidentCents: facilities.priceResidentCents,
				priceNonResidentCents: facilities.priceNonResidentCents,
				priceSocialCents: facilities.priceSocialCents,
				stepFreeAccess: facilities.stepFreeAccess,
				bookingMode: facilityTypes.bookingMode
			})
			.from(facilities)
			.innerJoin(facilityTypes, eq(facilityTypes.id, facilities.typeId))
			.where(eq(facilities.municipalityId, viana.id));
		expect(vianaFacs.map((f) => f.name).sort()).toEqual([...VIANA_FACILITIES].sort());
		expect(vianaFacs.some((f) => f.stepFreeAccess === 'yes')).toBe(true);
		expect(vianaFacs.some((f) => f.stepFreeAccess === null)).toBe(true);
		expect(vianaFacs.find((f) => f.name === 'Pistas de pádel')).toMatchObject({
			bookingMode: 'unit',
			units: 2,
			priceResidentCents: 0,
			priceNonResidentCents: 0,
			priceSocialCents: 0,
			needsOpening: true,
			accessInfo: 'En inverno ábrea a Policía Local á hora da túa reserva. Amosa o teu PIN.',
			accessInfoEs: 'En invierno la abre la Policía Local a la hora de tu reserva. Enseña tu PIN.'
		});
		expect(vianaFacs.find((f) => f.name === 'Pista de tenis')).toMatchObject({
			priceResidentCents: 0,
			priceNonResidentCents: 0,
			priceSocialCents: 0,
			needsOpening: true
		});
		for (const slug of DEMO_SLUGS) {
			const m = munis.find((x) => x.slug === slug)!;
			const n = await db.$count(facilities, eq(facilities.municipalityId, m.id));
			expect(n, slug).toBeGreaterThanOrEqual(3);
			expect(n, slug).toBeLessThanOrEqual(8);
		}
		const modes = new Set(
			(await db.select({ mode: facilityTypes.bookingMode }).from(facilityTypes)).map((r) => r.mode)
		);
		expect([...modes].sort()).toEqual(['capacity', 'day', 'slot', 'unit']);
		const mascots = new Set(
			(await db.select({ m: facilityTypes.mascot }).from(facilityTypes)).map((r) => r.m)
		);
		expect(mascots.size).toBeGreaterThanOrEqual(10);

		const [uxia] = await db.select().from(users).where(eq(users.displayName, 'Nerea Cabaleiro'));
		const profiles = await db
			.select({ slug: municipalities.slug, isResident: municipalityProfiles.isResident })
			.from(municipalityProfiles)
			.innerJoin(municipalities, eq(municipalities.id, municipalityProfiles.municipalityId))
			.where(eq(municipalityProfiles.userId, uxia.id));
		expect(profiles.sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
			{ slug: 'a-rua', isResident: false },
			{ slug: 'viana-do-bolo', isResident: true }
		]);
		const staff = await db
			.select({ name: users.displayName, role: staffRoles.role, slug: municipalities.slug })
			.from(staffRoles)
			.innerJoin(users, eq(users.id, staffRoles.userId))
			.leftJoin(municipalities, eq(municipalities.id, staffRoles.municipalityId));
		expect(staff).toContainEqual({
			name: 'Baltasar Gesto',
			role: 'conserxe',
			slug: 'viana-do-bolo'
		});
		expect(staff).toContainEqual({
			name: 'Policía Local de Viana',
			role: 'apertura',
			slug: 'viana-do-bolo'
		});
		expect(staff).toContainEqual({
			name: 'Amalia Carballal',
			role: 'admin',
			slug: 'viana-do-bolo'
		});
		expect(staff).toContainEqual({ name: 'Celia Rivas', role: 'deputacion', slug: null });
		expect(staff).toEqual(
			expect.arrayContaining([
				{ name: 'Cibrán Ventosela', role: 'admin', slug: 'viana-do-bolo' },
				{ name: 'Cibrán Ventosela', role: 'conserxe', slug: 'viana-do-bolo' },
				{ name: 'Cibrán Ventosela', role: 'deputacion', slug: null }
			])
		);
		const seededPasses = await db
			.select({ name: users.displayName, sport: facilityTypes.nameGl, pin: passes.pin })
			.from(passes)
			.innerJoin(passTypes, eq(passTypes.id, passes.passTypeId))
			.innerJoin(facilityTypes, eq(facilityTypes.id, passTypes.facilityTypeId))
			.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, passes.profileId))
			.innerJoin(users, eq(users.id, municipalityProfiles.userId))
			.where(eq(passTypes.municipalityId, viana.id));
		expect(seededPasses.map((p) => p.name).sort()).toEqual(['Cibrán Ventosela', 'Nerea Cabaleiro']);
		expect(seededPasses.every((p) => p.sport === 'Pavillón')).toBe(true);
		expect(new Set(seededPasses.map((p) => p.pin)).size).toBe(2);
	});

	it('perfil v1: benvida feita, avatares, Nerea segue dous concellos e hai declaracións', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const people = await db.select().from(users).where(like(users.subject, 'DEMO-%'));
		const names = new Set(DEMO_PEOPLE.map((p) => p.name));
		const residents = people.filter((u) => names.has(u.displayName));
		expect(residents.every((u) => u.onboardedAt !== null)).toBe(true);
		const withAvatar = residents.filter((u) => u.avatarKey !== null);
		const share = withAvatar.length / residents.length;
		expect(share).toBeGreaterThan(0.3);
		expect(share).toBeLessThan(0.5);
		expect(withAvatar.every((u) => (AVATARS as readonly string[]).includes(u.avatarKey!))).toBe(
			true
		);
		const keys = withAvatar.map((u) => u.avatarKey!);
		expect(keys.some((k) => k.startsWith('deporte-'))).toBe(true);
		expect(keys.some((k) => k.startsWith('neno-') || k.startsWith('nena-'))).toBe(true);
		expect(keys.some((k) => !k.startsWith('deporte-') && !k.startsWith('ne'))).toBe(true);
		expect(people.every((u) => u.avatarPhoto === null)).toBe(true);

		const uxia = people.find((u) => u.displayName === 'Nerea Cabaleiro')!;
		expect(uxia.avatarKey).toBe('muller-lentes');
		const followed = await listFollowed(db, uxia.id);
		expect(followed.map((f) => [f.slug, f.isResident])).toEqual([
			['a-rua', false],
			['viana-do-bolo', true]
		]);

		const declared = await db
			.select()
			.from(municipalityProfiles)
			.where(isNotNull(municipalityProfiles.residencyDeclaredAt));
		expect(declared.length).toBeGreaterThanOrEqual(2);
		expect(declared.length).toBeLessThanOrEqual(3);
		expect(declared.every((p) => !p.isResident)).toBe(true);
	});

	it('acepta as normas nos perfís con reservas e dálle a Cibrán unha racha recente', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const bookedProfiles = await db
			.select({ accepted: municipalityProfiles.rulesAcceptedAt })
			.from(bookings)
			.innerJoin(municipalityProfiles, eq(municipalityProfiles.id, bookings.profileId));
		expect(bookedProfiles.every((profile) => profile.accepted !== null)).toBe(true);
		const mestre = DEMO_PEOPLE.findIndex((person) => person.name === 'Cibrán Ventosela');
		const plan = planDemoWorld(SMALL);
		const recentWeeks = new Set(
			plan.bookings
				.filter((booking) => booking.person === mestre && booking.status === 'attended')
				.map((booking) =>
					Math.floor((NOW.getTime() - booking.startsAt.getTime()) / (7 * 86_400_000))
				)
				.filter((week) => week >= 1 && week <= 3)
		);
		expect(recentWeeks.size).toBeGreaterThanOrEqual(2);
	});

	it('usuarios demo: Cl@ve e Chave365, sen provider local, con contacto ficticio', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const all = await db.select().from(users);
		expect(all.every((u) => u.provider !== 'local' && u.subject.startsWith('DEMO-'))).toBe(true);
		expect(all.some((u) => u.provider === 'chave365')).toBe(true);
		expect(all.some((u) => u.provider === 'clave')).toBe(true);
		expect(all.some((u) => u.email?.endsWith('@example.org'))).toBe(true);
		expect(all.some((u) => u.phone?.startsWith('600 00'))).toBe(true);
	});

	it.each([
		NOW,
		new Date('2027-03-24T10:00:00Z'), // semana do cambio a verán
		new Date('2026-10-25T23:30:00Z') // luns 00:30 en Madrid
	])('cada reserva cae nunha franxa da base de datos, sen solapes (%s)', async (now) => {
		const db = await createTestDb();
		await seedDemo(db, { now, scale: 0.2 });
		const facs = await db
			.select({ f: facilities, mode: facilityTypes.bookingMode })
			.from(facilities)
			.innerJoin(facilityTypes, eq(facilities.typeId, facilityTypes.id));
		const hours = await db.select().from(openingHours);
		const shut = await db.select().from(closures);
		const all = await db.select().from(bookings);
		const profiles = await db.select().from(municipalityProfiles);
		const profileMuni = new Map(profiles.map((p) => [p.id, p.municipalityId]));
		const statuses = new Set(all.map((b) => b.status));
		expect([...statuses].sort()).toEqual(['attended', 'cancelled', 'confirmed', 'no_show']);

		for (const { f, mode } of facs) {
			const mine = all.filter((b) => b.facilityId === f.id);
			const slotCache = new Map<string, Set<number>>();
			const perSlot = new Map<string, number>();
			for (const b of mine) {
				expect(b.municipalityId).toBe(f.municipalityId);
				expect(profileMuni.get(b.profileId)).toBe(f.municipalityId);
				const date = localDateOf(b.startsAt);
				if (!slotCache.has(date)) {
					const slots = generateSlots({
						date,
						slotMinutes: f.slotMinutes,
						hours: hours.filter((h) => h.facilityId === f.id),
						closures: shut.filter((c) => c.facilityId === f.id),
						bookingMode: mode
					});
					slotCache.set(date, new Set(slots.map((s) => s.startsAt.getTime())));
				}
				expect(slotCache.get(date)!.has(b.startsAt.getTime()), `${f.name} ${b.startsAt}`).toBe(
					true
				);
				if (b.startsAt > now) expect(['attended', 'no_show']).not.toContain(b.status);
				if (b.endsAt <= now) expect(b.status).not.toBe('confirmed');
				if (b.status === 'cancelled') continue;
				const key = mode === 'capacity' ? `${b.startsAt}` : `${b.startsAt}|${b.unitIndex}`;
				perSlot.set(key, (perSlot.get(key) ?? 0) + b.seats);
				if (mode === 'unit') expect(b.unitIndex!).toBeLessThan(f.units);
			}
			for (const [key, seats] of perSlot) {
				expect(seats, `${f.name} ${key}`).toBeLessThanOrEqual(mode === 'capacity' ? f.capacity : 1);
			}
		}

		// Peche puntual relativo a hoxe, á medianoite local.
		const [cesped] = shut.filter((c) => c.reason === 'Mantemento do céspede');
		const today = localDateOf(now);
		expect(cesped.startsAt.getTime()).toBe(
			localDateTimeToUtc(addLocalDays(today, 2), '00:00').getTime()
		);
	});

	it('a ventá de reserva dos concellos demo chega a +21 días, como a historia', async () => {
		expect(DEMO_POLICY.maxDaysAhead).toBe(DEMO_DAYS_AHEAD);
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const rows = await db.select({ d: municipalities.maxDaysAhead }).from(municipalities);
		expect(rows.map((r) => r.d)).toEqual(Array(11).fill(21));
	});

	it('perfís, peches e códigos na base de datos coinciden co plan', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const plan = planDemoWorld({ now: NOW, weeksBack: demoWeeksBack(SMALL.scale) });

		// Contador de ausencias e penalización de cada perfil, tal como os calcula o plan.
		const profiles = await db
			.select({ p: municipalityProfiles, subject: users.subject, slug: municipalities.slug })
			.from(municipalityProfiles)
			.innerJoin(users, eq(users.id, municipalityProfiles.userId))
			.innerJoin(municipalities, eq(municipalities.id, municipalityProfiles.municipalityId));
		const indexOf = new Map(DEMO_PEOPLE.map((p, i) => [p.subject, i]));
		expect(profiles).toHaveLength(
			DEMO_PEOPLE.reduce((n, person) => n + Object.keys(person.profiles).length, 0)
		);
		for (const { p, subject, slug } of profiles) {
			const want = plan.profiles.get(`${indexOf.get(subject)}|${slug}`) ?? {
				noShowCount: 0,
				penaltyUntil: null
			};
			expect(p.noShowCount, `${subject} ${slug}`).toBe(want.noShowCount);
			expect(p.penaltyUntil?.getTime() ?? null, `${subject} ${slug}`).toBe(
				want.penaltyUntil?.getTime() ?? null
			);
		}
		expect(profiles.some(({ p }) => p.penaltyUntil !== null)).toBe(true);

		// Peches: os do plan, coa razón da piscina de verán.
		const shut = await db
			.select({ c: closures, name: facilities.name })
			.from(closures)
			.innerJoin(facilities, eq(facilities.id, closures.facilityId));
		expect(shut).toHaveLength(plan.closures.length);
		const summer = shut.filter(({ c }) => c.reason === 'Pechada ata xuño');
		expect(new Set(summer.map((s) => s.name))).toEqual(
			new Set(['Piscina municipal · vaso de adultos', 'Piscina municipal · vaso infantil'])
		);
		expect(summer.some(({ c }) => c.startsAt <= NOW && NOW < c.endsAt)).toBe(true);
		expect(shut.map(({ c }) => c.reason)).toEqual(
			expect.arrayContaining([
				'Mantemento do céspede',
				'Torneo comarcal de balonmano',
				'Mantemento da depuradora'
			])
		);
		const vianaHolidays = await db
			.select({ date: holidays.date, name: holidays.name, mode: holidays.mode })
			.from(holidays)
			.innerJoin(municipalities, eq(municipalities.id, holidays.municipalityId))
			.where(eq(municipalities.slug, 'viana-do-bolo'));
		expect(vianaHolidays).toHaveLength(2);
		expect(vianaHolidays).toEqual(
			expect.arrayContaining([
				{ date: addLocalDays(localDateOf(NOW), 7), name: 'Festa de outono', mode: 'closed' },
				{
					date: addLocalDays(localDateOf(NOW), 14),
					name: 'Día da veciñanza',
					mode: 'sunday_hours'
				}
			])
		);

		// PIN de 4 cifras: únicos por concello e día local.
		const codes = await db
			.select({ m: bookings.municipalityId, s: bookings.startsAt, code: bookings.accessCode })
			.from(bookings);
		const keys = codes.map((b) => `${b.m}|${localDateOf(b.s)}|${b.code}`);
		expect(new Set(keys).size).toBe(keys.length);
		expect(codes.every((b) => /^\d{4}$/.test(b.code))).toBe(true);
	});

	it('o contador de ausencias de cada perfil non supera o limiar', async () => {
		const db = await createTestDb();
		await seedDemo(db, { now: NOW });
		const profiles = await db.select().from(municipalityProfiles);
		expect(profiles.every((p) => p.noShowCount < 3)).toBe(true);
		expect(profiles.some((p) => p.noShowCount > 0)).toBe(true);
		expect(profiles.some((p) => p.penaltyUntil !== null)).toBe(true);
	});

	it('determinista: o mesmo `now` dá as mesmas reservas', async () => {
		const a = await createTestDb();
		const b = await createTestDb();
		await seedDemo(a, SMALL);
		await seedDemo(b, SMALL);
		expect(await bookingDigest(a)).toBe(await bookingDigest(b));
	});

	it('Viana do Bolo ten reservas hoxe antes e despois de agora', async () => {
		for (const time of ['09:00', '13:00', '19:00']) {
			const now = localDateTimeToUtc('2026-10-22', time);
			const db = await createTestDb();
			await seedDemo(db, { now, scale: 0.2 });
			const [viana] = await db
				.select({ id: municipalities.id })
				.from(municipalities)
				.where(inArray(municipalities.slug, ['viana-do-bolo']));
			const rows = (
				await db.select().from(bookings).where(eq(bookings.municipalityId, viana.id))
			).filter((b) => b.status !== 'cancelled' && localDateOf(b.startsAt) === '2026-10-22');
			expect(rows.some((b) => b.startsAt < now)).toBe(true);
			expect(rows.some((b) => b.startsAt > now)).toBe(true);
		}
		// Sementa tres veces (09:00, 13:00, 19:00): coa máquina cargada pasa dos 30 s xerais.
	}, 120_000);

	it('tempadas: CD Viana bloquea As Carrelas os martes ás tardes', async () => {
		const db = await createTestDb();
		await seedDemo(db, SMALL);
		const [viana] = await db
			.select({ id: municipalities.id })
			.from(municipalities)
			.where(eq(municipalities.slug, 'viana-do-bolo'));
		const seasons = await listSeasons(db, viana.id);
		expect(seasons.filter((s) => s.entityName === 'CD Viana — adestramento')).toHaveLength(2);
		expect(seasons.every((s) => s.fromDate === '2026-10-01' && s.toDate === '2027-06-30')).toBe(
			true
		);
		const campo = seasons.find((s) => s.facilityName === 'Campo de fútbol As Carrelas')!;
		// Martes 3 nov 2026: as franxas de 18:30 e 20:00 solapan 19:00–20:30.
		const r = await getAvailability(db, viana.id, campo.facilityId, '2026-11-03');
		if (!r.ok) throw new Error(r.error);
		const at = (hhmm: string) =>
			r.value.find(
				(s) => s.startsAt.getTime() === localDateTimeToUtc('2026-11-03', hhmm).getTime()
			);
		expect(at('17:00')).toBeDefined();
		expect(at('18:30')?.free).toBe(false);
		expect(at('20:00')?.free).toBe(false);
	});

	it('mostrador v1: DNI só como hash, tarifas sociais e prezos sociais', async () => {
		const db = await createTestDb();
		const secret = 'clave-dni-demo';
		await seedDemo(db, { ...SMALL, dniSecret: secret });
		const [viana] = await db
			.select({ id: municipalities.id })
			.from(municipalities)
			.where(eq(municipalities.slug, 'viana-do-bolo'));

		const uxia = await findPersonByDni(db, viana.id, DEMO_DNIS['Nerea Cabaleiro'], secret);
		expect(uxia.status === 'found' && uxia.person.displayName).toBe('Nerea Cabaleiro');
		const xoan = await findPersonByDni(db, viana.id, '34987654P', secret);
		expect(xoan).toMatchObject({
			status: 'found',
			person: { displayName: 'Hadrián Seixo Mouriño', isResident: false, socialTariff: 'maior' }
		});
		expect((await findPersonByDni(db, viana.id, '3498765', secret)).status).toBe('invalid');

		const people = await db.select().from(users).where(like(users.subject, 'DEMO-%'));
		const dump = JSON.stringify(people);
		for (const dni of Object.values(DEMO_DNIS)) expect(dump).not.toContain(dni.slice(0, 8));
		const withHash = people.filter((u) => u.dniHash !== null);
		expect(withHash.length).toBe(DEMO_PEOPLE.length);

		const tariffs = await db
			.select()
			.from(municipalityProfiles)
			.where(isNotNull(municipalityProfiles.socialTariff));
		expect(tariffs.length).toBeGreaterThanOrEqual(3);
		// 3–4 de antes e as dúas novas: Celestino (maior) e Rebeca (familia).
		expect(tariffs.length).toBeLessThanOrEqual(6);
		const social = await db.select().from(facilities).where(isNotNull(facilities.priceSocialCents));
		expect(social.length).toBeGreaterThanOrEqual(3);

		// Sen clave, ningún hash.
		const plain = await createTestDb();
		await seedDemo(plain, SMALL);
		expect((await plain.select().from(users)).filter((u) => u.dniHash !== null)).toHaveLength(0);
	});
});
