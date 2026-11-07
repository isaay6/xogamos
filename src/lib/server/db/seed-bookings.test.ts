// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { applyNoShow } from '../domain/policies';
import { generateSlots } from '../domain/slots';
import { seasonOccurrence } from '../domain/seasons';
import { computeStreak } from '../domain/streak';
import { addLocalDays, localDateOf, localDateTimeToUtc, weekdayOf } from '../domain/time';
import { DEMO_FACILITIES } from './seed-data';
import { DEMO_PEOPLE, DEMO_TARIFF_OF } from './seed-people';
import {
	DEMO_DAYS_AHEAD,
	DEMO_POLICY,
	DEMO_WEEKS_BACK,
	facilityHours,
	planDemoWorld,
	type DemoPlan,
	type PlannedBooking
} from './seed-bookings';

// Xoves 22 out 2026, 18:30 en Madrid.
const NOW = new Date('2026-10-22T16:30:00Z');
const plans = new Map<number, DemoPlan>();
const planAt = (now: Date) => {
	const key = now.getTime();
	if (!plans.has(key)) plans.set(key, planDemoWorld({ now }));
	return plans.get(key)!;
};
const facDef = new Map(DEMO_FACILITIES.map((f) => [f.key, f]));
const live = (b: PlannedBooking) => b.status !== 'cancelled';
const minutes = (b: { startsAt: Date; endsAt: Date }) =>
	(b.endsAt.getTime() - b.startsAt.getTime()) / 60_000;

describe('planDemoWorld: ventá e estados', () => {
	it('de −26 semanas a +3 semanas arredor de hoxe', () => {
		const { bookings } = planAt(NOW);
		const today = localDateOf(NOW);
		const dates = bookings.map((b) => localDateOf(b.startsAt)).sort();
		expect(dates[0] >= addLocalDays(today, -7 * DEMO_WEEKS_BACK)).toBe(true);
		expect(dates[0] <= addLocalDays(today, -7 * DEMO_WEEKS_BACK + 3)).toBe(true);
		expect(dates.at(-1)! <= addLocalDays(today, DEMO_DAYS_AHEAD)).toBe(true);
		expect(dates.at(-1)! >= addLocalDays(today, DEMO_DAYS_AHEAD - 3)).toBe(true);
	});

	it.each([
		NOW,
		new Date('2027-03-24T10:00:00Z'), // semana do cambio a verán
		new Date('2026-10-25T23:30:00Z'), // luns 00:30 en Madrid, xusto despois do cambio a inverno
		new Date('2026-11-26T11:00:00Z')
	])('estados coherentes co reloxo (%s)', (now) => {
		const { bookings } = planAt(now);
		for (const b of bookings) {
			if (b.startsAt > now) expect(['attended', 'no_show']).not.toContain(b.status);
			if (b.endsAt <= now) expect(b.status).not.toBe('confirmed');
			expect(b.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
			expect(b.createdAt < b.startsAt).toBe(true);
			if (b.status === 'cancelled') {
				expect(b.cancelledAt).not.toBeNull();
				if (b.channel === 'online') {
					// Cancelada pola persoa: dentro do prazo do concello.
					expect(b.cancelledAt!.getTime()).toBeLessThanOrEqual(
						b.startsAt.getTime() - DEMO_POLICY.cancellationDeadlineMinutes * 60_000
					);
				}
				expect(b.cancelledAt! < b.startsAt).toBe(true);
				expect(b.cancelledAt!.getTime()).toBeLessThanOrEqual(now.getTime());
				expect(b.cancelledAt! > b.createdAt).toBe(true);
			} else {
				expect(b.cancelledAt).toBeNull();
			}
		}
	});

	it('proporcións: ~6 % ausencias no pasado e ~8 % canceladas', () => {
		const { bookings } = planAt(NOW);
		const past = bookings.filter((b) => b.endsAt <= NOW && live(b));
		const noShow = past.filter((b) => b.status === 'no_show').length / past.length;
		expect(noShow).toBeGreaterThan(0.04);
		expect(noShow).toBeLessThan(0.08);
		const cancelled = bookings.filter((b) => b.status === 'cancelled').length / bookings.length;
		expect(cancelled).toBeGreaterThan(0.06);
		expect(cancelled).toBeLessThan(0.1);
		const future = bookings.filter((b) => b.startsAt > NOW);
		expect(future.some((b) => b.status === 'cancelled')).toBe(true);
		expect(future.some((b) => b.status === 'confirmed')).toBe(true);
	});

	it('canles: sobre todo en liña, algunhas por teléfono e no mostrador', () => {
		const { bookings } = planAt(NOW);
		const share = (c: string) => bookings.filter((b) => b.channel === c).length / bookings.length;
		expect(share('online')).toBeGreaterThan(0.7);
		expect(share('phone')).toBeGreaterThan(0.05);
		expect(share('desk')).toBeGreaterThan(0.03);
		for (const b of bookings) expect(b.createdByStaff).toBe(b.channel !== 'online');
	});

	it('é determinista', () => {
		const a = planDemoWorld({ now: NOW });
		expect(JSON.stringify(a)).toBe(JSON.stringify(planAt(NOW)));
	});
});

describe('planDemoWorld: invariantes', () => {
	it.each([NOW, new Date('2027-03-24T10:00:00Z'), new Date('2026-10-25T23:30:00Z')])(
		'cada reserva cae nunha franxa real, sen solapes nin excesos (%s)',
		(now) => {
			const { bookings, closures } = planAt(now);
			const slotCache = new Map<string, Set<string>>();
			const used = new Map<string, number>();
			const personBusy = new Map<number, { s: number; e: number }[]>();
			for (const b of bookings) {
				const f = facDef.get(b.facility)!;
				expect(b.municipality).toBe(f.municipality);
				const date = localDateOf(b.startsAt);
				const cacheKey = `${f.key}|${date}`;
				if (!slotCache.has(cacheKey)) {
					const slots = generateSlots({
						date,
						slotMinutes: f.slotMinutes,
						hours: facilityHours(f),
						closures: closures.filter((c) => c.facility === f.key),
						bookingMode: f.bookingMode
					});
					slotCache.set(
						cacheKey,
						new Set(slots.map((s) => `${s.startsAt.toISOString()}|${s.endsAt.toISOString()}`))
					);
				}
				expect(
					slotCache.get(cacheKey)!.has(`${b.startsAt.toISOString()}|${b.endsAt.toISOString()}`),
					`${cacheKey} ${b.startsAt.toISOString()}`
				).toBe(true);

				const person = DEMO_PEOPLE[b.person];
				expect(
					person.profiles[b.municipality],
					`${person.name} en ${b.municipality}`
				).toBeDefined();
				const tariff = DEMO_TARIFF_OF.get(`${b.person}|${b.municipality}`) ?? null;
				const prices = [f.priceNonResidentCents];
				if (person.profiles[b.municipality]) prices.push(f.priceResidentCents);
				if (tariff && f.priceSocialCents !== undefined) prices.push(f.priceSocialCents);
				expect(b.priceCents).toBe(Math.min(...prices) * b.seats);
				expect(b.accessCode).toMatch(/^\d{4}$/);

				if (f.bookingMode === 'unit') {
					expect(b.unitIndex).not.toBeNull();
					expect(b.unitIndex!).toBeGreaterThanOrEqual(0);
					expect(b.unitIndex!).toBeLessThan(f.units);
				} else {
					expect(b.unitIndex).toBeNull();
				}
				if (f.bookingMode !== 'capacity') expect(b.seats).toBe(1);
				if (!live(b)) continue;
				const key =
					f.bookingMode === 'capacity'
						? `${f.key}|${b.startsAt.toISOString()}`
						: `${f.key}|${b.startsAt.toISOString()}|${b.unitIndex}`;
				used.set(key, (used.get(key) ?? 0) + b.seats);
				const limit = f.bookingMode === 'capacity' ? f.capacity : 1;
				expect(used.get(key)!, key).toBeLessThanOrEqual(limit);

				const mine = personBusy.get(b.person) ?? [];
				const s = b.startsAt.getTime();
				const e = b.endsAt.getTime();
				expect(
					mine.some((x) => x.s < e && s < x.e),
					`${person.name} dúas reservas á vez`
				).toBe(false);
				mine.push({ s, e });
				personBusy.set(b.person, mine);
			}
		}
	);

	it('PIN únicos por concello e día', () => {
		const seen = new Set<string>();
		for (const b of planAt(NOW).bookings) {
			const key = `${b.municipality}|${localDateOf(b.startsAt)}|${b.accessCode}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it('ausencias e penalizacións saen de repetir applyNoShow coas reservas finais', () => {
		const { bookings, profiles } = planAt(NOW);
		const expected = new Map<string, { noShowCount: number; penaltyUntil: Date | null }>();
		const noShows = bookings
			.filter((b) => b.status === 'no_show')
			.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
		for (const b of noShows) {
			const key = `${b.person}|${b.municipality}`;
			const prev = expected.get(key) ?? { noShowCount: 0, penaltyUntil: null };
			expected.set(key, applyNoShow(prev, b.endsAt, DEMO_POLICY));
		}
		for (const [key, state] of profiles) {
			const want = expected.get(key) ?? { noShowCount: 0, penaltyUntil: null };
			expect(state.noShowCount, key).toBe(want.noShowCount);
			expect(state.penaltyUntil?.getTime() ?? null, key).toBe(want.penaltyUntil?.getTime() ?? null);
		}
		const all = [...profiles.values()];
		expect(all.some((p) => p.noShowCount > 0)).toBe(true);
		expect(all.some((p) => p.penaltyUntil !== null)).toBe(true);
		// Ninguén ten reservas que empecen mentres está penalizado nese concello.
		const windows: { key: string; from: number; to: number }[] = [];
		const replay = new Map<string, { noShowCount: number; penaltyUntil: Date | null }>();
		for (const b of noShows) {
			const key = `${b.person}|${b.municipality}`;
			const next = applyNoShow(
				replay.get(key) ?? { noShowCount: 0, penaltyUntil: null },
				b.endsAt,
				DEMO_POLICY
			);
			if (next.noShowCount === 0) {
				windows.push({ key, from: b.endsAt.getTime(), to: next.penaltyUntil!.getTime() });
			}
			replay.set(key, next);
		}
		for (const b of bookings.filter(live)) {
			const key = `${b.person}|${b.municipality}`;
			const s = b.startsAt.getTime();
			expect(
				windows.some((w) => w.key === key && w.from <= s && s < w.to),
				key
			).toBe(false);
		}
	});
});

describe('planDemoWorld: ocupación', () => {
	const occupancy = (plan: DemoPlan, from: string, to: string, keys: string[]) => {
		const fromMs = localDateTimeToUtc(from, '00:00').getTime();
		const toMs = localDateTimeToUtc(to, '00:00').getTime();
		const rates: number[] = [];
		for (const key of keys) {
			const f = facDef.get(key)!;
			let offered = 0;
			for (let d = from; d < to; d = addLocalDays(d, 1)) {
				const slots = generateSlots({
					date: d,
					slotMinutes: f.slotMinutes,
					hours: facilityHours(f),
					closures: plan.closures.filter((c) => c.facility === key),
					bookingMode: f.bookingMode
				});
				const mult =
					f.bookingMode === 'unit' ? f.units : f.bookingMode === 'capacity' ? f.capacity : 1;
				offered += slots.reduce((n, s) => n + minutes(s), 0) * mult;
			}
			if (offered === 0) continue;
			const booked = plan.bookings
				.filter(
					(b) =>
						b.facility === key &&
						live(b) &&
						b.startsAt.getTime() >= fromMs &&
						b.startsAt.getTime() < toMs
				)
				.reduce((n, b) => n + minutes(b) * b.seats, 0);
			rates.push(booked / offered);
		}
		return rates.reduce((a, b) => a + b, 0) / rates.length;
	};

	it('media entre o 35 % e o 55 % nas últimas 8 semanas', () => {
		const plan = planAt(NOW);
		const today = localDateOf(NOW);
		const avg = occupancy(
			plan,
			addLocalDays(today, -56),
			today,
			DEMO_FACILITIES.map((f) => f.key)
		);
		expect(avg).toBeGreaterThan(0.35);
		expect(avg).toBeLessThan(0.55);
	});

	it('picos preto do 90 % no pádel ás tardes de diario', () => {
		const plan = planAt(NOW);
		const cells = new Map<string, { booked: number; days: Set<string> }>();
		for (const b of plan.bookings.filter((x) => x.facility === 'viana-padel' && live(x))) {
			const date = localDateOf(b.startsAt);
			const key = `${weekdayOf(date)}|${b.startsAt.toISOString().slice(11, 16)}`;
			const c = cells.get(key) ?? { booked: 0, days: new Set() };
			c.booked++;
			c.days.add(date);
			cells.set(key, c);
		}
		const weeks = DEMO_WEEKS_BACK + 3;
		const best = Math.max(...[...cells.values()].map((c) => c.booked / weeks));
		expect(best).toBeGreaterThan(0.8);
	});

	it('as mañás de diario son tranquilas e as tardes, cheas', () => {
		const plan = planAt(NOW);
		const viana = plan.bookings.filter((b) => b.facility === 'viana-tenis' && live(b));
		const hourOf = (b: PlannedBooking) =>
			Number(
				new Intl.DateTimeFormat('en-GB', {
					hour: '2-digit',
					hour12: false,
					timeZone: 'Europe/Madrid'
				}).format(b.startsAt)
			);
		const weekday = viana.filter((b) => weekdayOf(localDateOf(b.startsAt)) < 5);
		const morning = weekday.filter((b) => hourOf(b) < 12).length / 4;
		const evening = weekday.filter((b) => hourOf(b) >= 18 && hourOf(b) < 22).length / 4;
		expect(evening).toBeGreaterThan(morning * 3);
	});
});

describe('planDemoWorld: Viana do Bolo', () => {
	it.each(['09:00', '13:00', '19:00'])(
		'hoxe ás %s hai reservas antes e despois de agora',
		(time) => {
			for (const date of ['2026-10-22', '2026-10-24', '2026-10-26']) {
				const now = localDateTimeToUtc(date, time);
				const today = localDateOf(now);
				const mine = planAt(now).bookings.filter(
					(b) => b.municipality === 'viana-do-bolo' && live(b) && localDateOf(b.startsAt) === today
				);
				const before = new Set(mine.filter((b) => b.startsAt < now).map((b) => b.facility));
				const after = new Set(mine.filter((b) => b.startsAt > now).map((b) => b.facility));
				expect(before.size, `${date} ${time} antes`).toBeGreaterThanOrEqual(2);
				expect(after.size, `${date} ${time} despois`).toBeGreaterThanOrEqual(3);
			}
		}
	);

	it.each(['2026-10-22T14:40:00Z', '2026-10-24T09:30:00Z', '2026-10-26T11:00:00Z'])(
		'hoxe (%s): o xa empezado vai cheo e a tarde que queda ten ocos en varias instalacións',
		(iso) => {
			const now = new Date(iso);
			const today = localDateOf(now);
			const plan = planAt(now);
			let pastSlots = 0;
			let pastTaken = 0;
			let laterSlots = 0;
			let laterTaken = 0;
			const withRoom = new Set<string>();
			for (const f of DEMO_FACILITIES) {
				if (f.municipality !== 'viana-do-bolo' || f.bookingMode === 'day' || f.summerOnly) continue;
				const per =
					f.bookingMode === 'unit' ? f.units : f.bookingMode === 'capacity' ? f.capacity : 1;
				const slots = generateSlots({
					date: today,
					slotMinutes: f.slotMinutes,
					hours: facilityHours(f),
					closures: plan.closures.filter((c) => c.facility === f.key),
					bookingMode: f.bookingMode
				});
				for (const slot of slots) {
					const taken = plan.bookings
						.filter(
							(b) =>
								b.facility === f.key && live(b) && b.startsAt.getTime() === slot.startsAt.getTime()
						)
						.reduce((n, b) => n + b.seats, 0);
					if (slot.startsAt <= now) {
						pastSlots += per;
						pastTaken += Math.min(per, taken);
					} else {
						laterSlots += per;
						laterTaken += Math.min(per, taken);
						if (taken < per) withRoom.add(f.key);
					}
				}
			}
			if (pastSlots > 0) expect(pastTaken / pastSlots, 'xa empezado').toBeGreaterThanOrEqual(0.8);
			expect(laterTaken / laterSlots, 'o que queda').toBeLessThanOrEqual(0.75);
			expect(withRoom.size, 'instalacións con oco').toBeGreaterThanOrEqual(3);
		}
	);

	it('Nerea: racha de 3 semanas, algunhas ausencias e canceladas, 2–3 reservas próximas', () => {
		const { bookings, profiles } = planAt(NOW);
		const uxia = bookings.filter((b) => b.person === 0);
		const viana = uxia.filter((b) => b.municipality === 'viana-do-bolo');
		expect(computeStreak(viana, NOW)).toBe(3);
		const noShows = viana.filter((b) => b.status === 'no_show').length;
		expect(noShows).toBeGreaterThanOrEqual(2);
		expect(noShows).toBeLessThanOrEqual(3);
		expect(uxia.filter((b) => b.status === 'cancelled').length).toBeGreaterThanOrEqual(2);
		const upcoming = uxia.filter((b) => b.startsAt > NOW && b.status === 'confirmed');
		expect(upcoming.length).toBeGreaterThanOrEqual(2);
		expect(upcoming.length).toBeLessThanOrEqual(3);
		expect(uxia.some((b) => b.municipality === 'a-rua')).toBe(true);
		expect(viana.filter((b) => b.status === 'attended').length).toBeGreaterThan(15);
		expect(profiles.get('0|viana-do-bolo')!.penaltyUntil).toBeNull();
	});
});

describe('planDemoWorld: peches', () => {
	it('a piscina de Viana está pechada ata xuño e só ten reservas no verán', () => {
		const plan = planAt(NOW);
		for (const key of ['viana-piscina-adultos', 'viana-piscina-infantil']) {
			const current = plan.closures.find(
				(c) => c.facility === key && c.startsAt <= NOW && NOW < c.endsAt
			);
			expect(current?.reason).toBe('Pechada ata xuño');
			expect(localDateOf(current!.endsAt)).toBe('2027-06-01');
			const months = new Set(
				plan.bookings
					.filter((b) => b.facility === key)
					.map((b) => localDateOf(b.startsAt).slice(5, 7))
			);
			expect([...months].sort()).toEqual(['06', '07', '08', '09']);
		}
	});

	it('2–3 peches puntuais, entre eles o mantemento do céspede nos próximos días', () => {
		const plan = planAt(NOW);
		// Os bloques de evento (o torneo) non son peches: van á parte.
		const others = plan.closures.filter((c) => !c.facility.startsWith('viana-piscina') && !c.event);
		expect(plan.closures.filter((c) => c.event).map((c) => c.event!.title)).toEqual([
			'Torneo de pádel de Nadal'
		]);
		expect(others.length).toBeGreaterThanOrEqual(2);
		expect(others.length).toBeLessThanOrEqual(3);
		const cesped = others.find((c) => c.reason === 'Mantemento do céspede')!;
		expect(cesped.facility).toBe('viana-futbol');
		const today = localDateOf(NOW);
		expect(cesped.startsAt.getTime()).toBe(
			localDateTimeToUtc(addLocalDays(today, 2), '00:00').getTime()
		);
		expect(cesped.startsAt > NOW).toBe(true);
	});

	it('os peches comezan á medianoite local tamén na semana do cambio de hora', () => {
		const now = new Date('2027-03-26T10:00:00Z'); // venres; o cambio é o domingo 28
		const today = localDateOf(now);
		const cesped = planAt(now).closures.find((c) => c.reason === 'Mantemento do céspede')!;
		expect(cesped.startsAt.getTime()).toBe(
			localDateTimeToUtc(addLocalDays(today, 2), '00:00').getTime()
		);
		expect(cesped.endsAt.getTime()).toBe(
			localDateTimeToUtc(addLocalDays(today, 5), '00:00').getTime()
		);
	});
});

describe('planDemoWorld: tempadas', () => {
	it('CD Viana (martes e xoves 19:00–20:30) e a escola de baloncesto, de outubro a xuño', () => {
		const { seasons } = planAt(NOW);
		const cd = seasons.filter((s) => s.entityName === 'CD Viana — adestramento');
		expect(cd.map((s) => s.weekday)).toEqual([1, 3]);
		for (const s of cd) {
			expect(s).toMatchObject({
				facility: 'viana-futbol',
				startsTime: '19:00',
				endsTime: '20:30',
				fromDate: '2026-10-01',
				toDate: '2027-06-30',
				unitIndex: null
			});
		}
		expect(seasons.filter((s) => s.facility === 'viana-pavillon').length).toBeGreaterThan(0);
		// En xullo aínda é o curso que acaba; en setembro, o que empeza en outubro.
		expect(planAt(new Date('2027-05-10T10:00:00Z')).seasons[0].fromDate).toBe('2026-10-01');
		expect(planAt(new Date('2027-09-10T10:00:00Z')).seasons[0].fromDate).toBe('2027-10-01');
	});

	it.each([NOW, new Date('2027-03-24T10:00:00Z')])(
		'ningunha reserva xerada pisa unha tempada (%s)',
		(now) => {
			const { bookings, seasons } = planAt(now);
			for (const b of bookings) {
				for (const s of seasons.filter((x) => x.facility === b.facility)) {
					const o = seasonOccurrence(s, localDateOf(b.startsAt));
					const hit = o !== null && b.startsAt < o.endsAt && o.startsAt < b.endsAt;
					expect(hit, `${b.facility} ${b.startsAt.toISOString()}`).toBe(false);
				}
			}
		}
	);
});

describe('planDemoWorld: escala', () => {
	it('weeksBack máis curto para probas máis rápidas', () => {
		const small = planDemoWorld({ now: NOW, weeksBack: 5 });
		const today = localDateOf(NOW);
		const first = small.bookings.map((b) => localDateOf(b.startsAt)).sort()[0];
		expect(first >= addLocalDays(today, -35)).toBe(true);
		expect(small.bookings.length).toBeLessThan(planAt(NOW).bookings.length / 3);
		expect(
			computeStreak(
				small.bookings.filter((b) => b.person === 0 && b.municipality === 'viana-do-bolo'),
				NOW
			)
		).toBe(3);
	});
});
