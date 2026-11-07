// SPDX-License-Identifier: EUPL-1.2
// Xerador puro (sen base de datos) da historia da demo: reservas e peches arredor de `now`.
// Determinista: mesmo `now`, mesmo resultado. Cada (concello, día) ten a súa propia semente, así
// que un día concreto adoita saír parecido aínda que `now` cambie. Non é idéntico: os estados
// dependen de `now`, o día de hoxe en Viana do Bolo vai reforzado (axenda chea), o guión de Nerea
// móvese con hoxe e as penalizacións arrastran o que pasou antes na ventá.
import { applyNoShow, priceFor, type Policy } from '../domain/policies';
import { seasonOccurrence, type SeasonRule } from '../domain/seasons';
import { generateSlots } from '../domain/slots';
import {
	addLocalDays,
	localDateOf,
	localDateTimeToUtc,
	localTimeOf,
	weekdayOf
} from '../domain/time';
import type { BookingStatus, Hours, Interval, Slot } from '../domain/types';
import {
	DEMO_FACILITIES,
	DEMO_SEASONS,
	DEMO_SIZE,
	DEMO_SLUGS,
	type DemoFacility,
	type DemoSlug
} from './seed-data';
import { DEMO_PEOPLE, DEMO_TARIFF_OF } from './seed-people';
import { hashSeed, prng } from './seed-random';

export const DEMO_WEEKS_BACK = 26;
export const DEMO_DAYS_AHEAD = 21;
/** Mesmos valores que os predeterminados da táboa `municipalities`. */
export const DEMO_POLICY: Policy = {
	cancellationDeadlineMinutes: 120,
	maxDaysAhead: 21,
	noShowThreshold: 3,
	penaltyDays: 7
};

const MIN = 60_000;
const NO_SHOW_RATE = 0.065;
const CANCEL_FACTOR = 0.09;
const SUMMER_REASON = 'Pechada ata xuño';

export type PlannedBooking = {
	facility: string;
	municipality: DemoSlug;
	/** Índice en DEMO_PEOPLE. */
	person: number;
	unitIndex: number | null;
	seats: number;
	startsAt: Date;
	endsAt: Date;
	status: BookingStatus;
	channel: 'online' | 'phone' | 'desk';
	/** Creada polo conserxe do concello (teléfono ou mostrador). */
	createdByStaff: boolean;
	createdAt: Date;
	cancelledAt: Date | null;
	accessCode: string;
	priceCents: number;
};

export type PlannedClosure = {
	facility: string;
	startsAt: Date;
	endsAt: Date;
	reason: string;
	/** Bloque dun evento aprobado (torneo): amósase «Evento: {title}», non «Pechada». */
	event?: { title: string };
};

/** O torneo de pádel de Nadal da demo: bloque de evento do día +12 ás 10:00 ao +13 ás 20:00. */
export const DEMO_TOURNAMENT = {
	facility: 'viana-padel',
	title: 'Torneo de pádel de Nadal',
	fromOffset: 12,
	toOffset: 13,
	startsTime: '10:00',
	endsTime: '20:00'
} as const;

export type ProfileState = { noShowCount: number; penaltyUntil: Date | null };

/** Unha fila de `season_bookings`: un día da semana dunha tempada da demo. */
export type PlannedSeason = SeasonRule & { facility: string; entityName: string };

export type DemoPlan = {
	bookings: PlannedBooking[];
	closures: PlannedClosure[];
	seasons: PlannedSeason[];
	/** Clave `${persoa}|${concello}`: contador de ausencias e penalización, calculados das reservas. */
	profiles: Map<string, ProfileState>;
};

export const facilityHours = (f: DemoFacility): Hours[] =>
	Object.entries(f.hours).flatMap(([weekday, ranges]) =>
		ranges.map(([opens, closes]) => ({ weekday: Number(weekday), opens, closes }))
	);

// ── Peches ──────────────────────────────────────────────────────────────────

function planClosures(today: string, from: string, to: string): PlannedClosure[] {
	const day = (offset: number, time = '00:00') =>
		localDateTimeToUtc(addLocalDays(today, offset), time);
	const out: PlannedClosure[] = [];
	// Piscinas de verán: pechadas fóra de xuño–setembro.
	const firstYear = Number(from.slice(0, 4)) - 1;
	const lastYear = Number(to.slice(0, 4));
	for (const f of DEMO_FACILITIES.filter((x) => x.summerOnly)) {
		for (let y = firstYear; y <= lastYear; y++) {
			const startsAt = localDateTimeToUtc(`${y}-10-01`, '00:00');
			const endsAt = localDateTimeToUtc(`${y + 1}-06-01`, '00:00');
			if (endsAt <= localDateTimeToUtc(from, '00:00')) continue;
			if (startsAt >= localDateTimeToUtc(addLocalDays(to, 1), '00:00')) continue;
			out.push({ facility: f.key, startsAt, endsAt, reason: SUMMER_REASON });
		}
	}
	out.push(
		{
			facility: 'viana-futbol',
			startsAt: day(2),
			endsAt: day(5),
			reason: 'Mantemento do céspede'
		},
		{
			facility: 'barco-pavillon',
			startsAt: day(9, '09:00'),
			endsAt: day(9, '21:00'),
			reason: 'Torneo comarcal de balonmano'
		},
		{
			facility: 'verin-piscina',
			startsAt: day(-40),
			endsAt: day(-37),
			reason: 'Mantemento da depuradora'
		},
		{
			facility: DEMO_TOURNAMENT.facility,
			startsAt: day(DEMO_TOURNAMENT.fromOffset, DEMO_TOURNAMENT.startsTime),
			endsAt: day(DEMO_TOURNAMENT.toOffset, DEMO_TOURNAMENT.endsTime),
			reason: '',
			event: { title: DEMO_TOURNAMENT.title }
		}
	);
	return out;
}

// ── Tempadas ────────────────────────────────────────────────────────────────

/** Tempadas de outubro a xuño do curso de `today` (desde xullo, o curso que empeza en outubro). */
export function planSeasons(today: string): PlannedSeason[] {
	const year = Number(today.slice(0, 4));
	const start = Number(today.slice(5, 7)) >= 7 ? year : year - 1;
	return DEMO_SEASONS.flatMap((s) =>
		s.weekdays.map((weekday) => ({
			facility: s.facility,
			entityName: s.entityName,
			weekday,
			startsTime: s.startsTime,
			endsTime: s.endsTime,
			fromDate: `${start}-10-01`,
			toDate: `${start + 1}-06-30`,
			unitIndex: null
		}))
	);
}

// ── Demanda ─────────────────────────────────────────────────────────────────

/** Probabilidade base segundo o día e a hora local de comezo (minutos desde a medianoite). */
function bandBase(weekend: boolean, m: number): number {
	if (!weekend) {
		if (m < 720) return 0.12;
		if (m < 960) return 0.18;
		if (m < 1080) return 0.45;
		if (m < 1320) return 0.74;
		return 0.35;
	}
	if (m < 600) return 0.35;
	if (m < 840) return 0.7;
	if (m < 1020) return 0.3;
	if (m < 1260) return 0.52;
	return 0.25;
}

function kindFactor(f: DemoFacility, weekend: boolean, m: number): number {
	switch (f.demand) {
		case 'padel':
			return 1.35;
		case 'pavillon':
			// Clubs nas tardes de diario; pola mañá, case baleiro.
			if (!weekend && m >= 1020 && m < 1320) return 1.3;
			return !weekend && m < 1020 ? 0.6 : 0.9;
		case 'raqueta':
			return 0.9;
		case 'campo':
			return 0.95;
		case 'aire-libre':
			return 0.65;
		case 'piscina-verán':
			return m >= 720 ? 1.25 : 0.8;
		case 'piscina-cuberta':
			// Nadadores de primeira hora.
			return !weekend && m < 600 ? 4 : 0.9;
		case 'ximnasio':
			return !weekend && m < 600 ? 3 : 0.8;
		case 'fronton':
			return 0.7;
		case 'sala':
			return 1;
	}
}

function seasonFactor(f: DemoFacility, date: string): number {
	const month = Number(date.slice(5, 7));
	const outdoor = f.demand === 'aire-libre' || f.demand === 'campo' || f.demand === 'raqueta';
	if (month === 7 || month === 8) return outdoor || f.summerOnly ? 1.1 : 0.7;
	if (month <= 2 || month >= 11) return outdoor ? 0.75 : 1.05;
	return 1;
}

// ── Xerador ─────────────────────────────────────────────────────────────────

type Candidate = { person: number; isResident: boolean; weight: number };

type Scripted = {
	facility: string;
	date: string;
	time: string;
	unit?: number;
	status: 'attended' | 'no_show' | 'cancelled' | 'upcoming';
};

/** Historia de Nerea Cabaleiro (DEMO-1): racha de 3 semanas, ausencias, canceladas e próximas. */
function uxiaScript(today: string): Scripted[] {
	const monday = addLocalDays(today, -weekdayOf(today));
	const at = (w: number, weekday: number) => addLocalDays(monday, -7 * w + weekday);
	const padel = (w: number, status: Scripted['status']): Scripted => ({
		facility: 'viana-padel',
		date: at(w, 1),
		time: '19:30',
		status
	});
	const pavillon = (w: number, weekday: number, status: Scripted['status']): Scripted => ({
		facility: 'viana-pavillon',
		date: at(w, weekday),
		time: weekday >= 5 ? '10:00' : '19:00',
		status
	});
	const out: Scripted[] = [
		padel(1, 'attended'),
		pavillon(1, 5, 'attended'),
		pavillon(2, 3, 'attended'),
		padel(3, 'attended'),
		pavillon(3, 2, 'cancelled'),
		// A semana 4 rompe a racha cunha ausencia.
		padel(4, 'no_show')
	];
	for (let w = 5; w < DEMO_WEEKS_BACK; w++) {
		if (w % 5 !== 0) out.push(padel(w, w === 11 || w === 17 ? 'cancelled' : 'attended'));
		if (w % 3 === 0) out.push(pavillon(w, 3, w === 9 ? 'no_show' : 'attended'));
		if (w % 7 === 0) {
			out.push({
				facility: 'rua-padel',
				date: at(w, 5),
				time: '11:30',
				unit: 0,
				status: 'attended'
			});
		}
	}
	out.push(
		{
			facility: 'viana-padel',
			date: addLocalDays(today, 1),
			time: '19:30',
			status: 'upcoming'
		},
		{ facility: 'viana-pavillon', date: addLocalDays(today, 3), time: '19:00', status: 'upcoming' },
		{
			facility: 'viana-pavillon',
			date: addLocalDays(today, 5),
			time: '19:00',
			status: 'cancelled'
		},
		{
			facility: 'viana-padel',
			date: addLocalDays(today, 8),
			time: '19:30',
			status: 'upcoming'
		}
	);
	return out;
}

const SCRIPTED_PEOPLE = new Set([0]);
/** Primeira hora de hoxe sempre reservada en Viana do Bolo (axenda viva desde cedo). */
const FIRST_TODAY = new Set(['viana-tenis', 'viana-futbol-7']);
/** Teito da demanda das horas de hoxe que aínda non empezaron en Viana do Bolo. */
const TODAY_LATER_MAX = 0.65;

export function planDemoWorld(opts: { now: Date; weeksBack?: number }): DemoPlan {
	const now = opts.now;
	const nowMs = now.getTime();
	const today = localDateOf(now);
	const from = addLocalDays(today, -7 * (opts.weeksBack ?? DEMO_WEEKS_BACK));
	const to = addLocalDays(today, DEMO_DAYS_AHEAD);
	const closures = planClosures(today, from, to);
	// As tempadas xéranse primeiro: as súas horas contan como ocupadas e non se reservan.
	const seasons = planSeasons(today);

	const hoursOf = new Map(DEMO_FACILITIES.map((f) => [f.key, facilityHours(f)]));
	const closuresOf = new Map<string, Interval[]>();
	for (const c of closures) {
		const list = closuresOf.get(c.facility) ?? [];
		list.push({ startsAt: c.startsAt, endsAt: c.endsAt });
		closuresOf.set(c.facility, list);
	}
	const slotsOf = (f: DemoFacility, date: string): Slot[] =>
		generateSlots({
			date,
			slotMinutes: f.slotMinutes,
			hours: hoursOf.get(f.key)!,
			closures: closuresOf.get(f.key) ?? [],
			bookingMode: f.bookingMode
		});

	// Guión: clave instalación|inicio|unidade.
	const scripted = new Map<string, Scripted>();
	for (const s of uxiaScript(today)) {
		if (s.date < from || s.date > to) continue;
		const f = DEMO_FACILITIES.find((x) => x.key === s.facility)!;
		const start = localDateTimeToUtc(s.date, s.time);
		if (!slotsOf(f, s.date).some((x) => x.startsAt.getTime() === start.getTime())) {
			throw new Error(`Demo seed: scripted ${s.facility} ${s.date} ${s.time} is not a valid slot`);
		}
		const unit = f.bookingMode === 'unit' ? (s.unit ?? 0) : null;
		scripted.set(`${f.key}|${start.getTime()}|${unit}`, s);
	}

	const candidates = new Map<DemoSlug, { list: Candidate[]; cumulative: number[] }>();
	for (const slug of DEMO_SLUGS) {
		const list: Candidate[] = [];
		DEMO_PEOPLE.forEach((p, i) => {
			if (SCRIPTED_PEOPLE.has(i) || !(slug in p.profiles)) return;
			list.push({
				person: i,
				isResident: p.profiles[slug]!,
				weight: p.activity * (p.home === slug ? 1 : 0.35)
			});
		});
		let acc = 0;
		candidates.set(slug, { list, cumulative: list.map((c) => (acc += c.weight)) });
	}

	const profiles = new Map<string, ProfileState>();
	DEMO_PEOPLE.forEach((p, i) => {
		for (const slug of Object.keys(p.profiles)) {
			profiles.set(`${i}|${slug}`, { noShowCount: 0, penaltyUntil: null });
		}
	});
	const busy = new Map<string, [number, number][]>(); // persoa|día → intervalos ocupados
	const codes = new Set<string>();
	const bookings: PlannedBooking[] = [];

	for (const slug of DEMO_SLUGS) {
		const facs = DEMO_FACILITIES.filter((f) => f.municipality === slug);
		const pool = candidates.get(slug)!;
		const size = DEMO_SIZE[slug];

		for (let date = from; date <= to; date = addLocalDays(date, 1)) {
			const rand = prng(hashSeed(`${slug}|${date}`));
			const weekend = weekdayOf(date) >= 5;
			const noon = localDateTimeToUtc(date, '12:00').getTime();
			const monday = addLocalDays(date, -weekdayOf(date));
			const isToday = date === today;

			const events: { f: DemoFacility; slot: Slot; first: boolean }[] = [];
			for (const f of facs) {
				const taken = seasons
					.filter((s) => s.facility === f.key)
					.map((s) => seasonOccurrence(s, date))
					.filter((o): o is Interval => o !== null);
				slotsOf(f, date)
					.filter(
						(slot) => !taken.some((o) => o.startsAt < slot.endsAt && slot.startsAt < o.endsAt)
					)
					.forEach((slot, i) => events.push({ f, slot, first: i === 0 }));
			}
			events.sort((a, b) => a.slot.startsAt.getTime() - b.slot.startsAt.getTime());
			// En Viana, a primeira franxa futura de cada instalación mantén a axenda de hoxe
			// representativa aínda despois de substituír tres pistas por dúas unidades de pádel.
			const firstFuture = new Set<string>();
			const futureFacilities = new Set<string>();
			if (slug === 'viana-do-bolo' && isToday) {
				for (const event of events) {
					const key = `${event.f.key}|${event.slot.startsAt.getTime()}`;
					if (event.slot.startsAt.getTime() > nowMs && !futureFacilities.has(event.f.key)) {
						firstFuture.add(key);
						futureFacilities.add(event.f.key);
					}
				}
			}

			const pickPerson = (start: number, end: number, tries: number, isBusyChecked: boolean) => {
				for (let t = 0; t < tries; t++) {
					const r = rand() * pool.cumulative[pool.cumulative.length - 1];
					let lo = 0;
					let hi = pool.cumulative.length - 1;
					while (lo < hi) {
						const mid = (lo + hi) >> 1;
						if (pool.cumulative[mid] < r) lo = mid + 1;
						else hi = mid;
					}
					const c = pool.list[lo];
					const state = profiles.get(`${c.person}|${slug}`)!;
					if (state.penaltyUntil && state.penaltyUntil.getTime() > start) continue;
					if (isBusyChecked) {
						const mine = busy.get(`${c.person}|${date}`);
						if (mine?.some(([s, e]) => s < end && start < e)) continue;
					}
					return c;
				}
				return null;
			};

			const emit = (
				f: DemoFacility,
				slot: Slot,
				person: number,
				isResident: boolean,
				unitIndex: number | null,
				seats: number,
				status: BookingStatus
			) => {
				const start = slot.startsAt.getTime();
				const end = slot.endsAt.getTime();
				const r = rand();
				const channel = r < 0.78 ? 'online' : r < 0.9 ? 'phone' : 'desk';
				// Quen cancela en liña respecta o prazo; o persoal pode cancelar máis tarde.
				const deadline =
					status === 'cancelled' && channel === 'online'
						? DEMO_POLICY.cancellationDeadlineMinutes * MIN
						: 0;
				const ref = Math.min(start - deadline, nowMs);
				const createdAt = ref - (30 + Math.floor(rand() * 6 * 24 * 60)) * MIN;
				const cancelledAt =
					status === 'cancelled'
						? createdAt + Math.floor((ref - createdAt) * (0.2 + 0.7 * rand()))
						: null;
				let code: string;
				do {
					code = String(Math.floor(rand() * 10_000)).padStart(4, '0');
				} while (codes.has(`${slug}|${date}|${code}`));
				codes.add(`${slug}|${date}|${code}`);
				bookings.push({
					facility: f.key,
					municipality: slug,
					person,
					unitIndex,
					seats,
					startsAt: slot.startsAt,
					endsAt: slot.endsAt,
					status,
					channel,
					createdByStaff: channel !== 'online',
					createdAt: new Date(createdAt),
					cancelledAt: cancelledAt === null ? null : new Date(cancelledAt),
					accessCode: code,
					priceCents: priceFor(
						{ ...f, priceSocialCents: f.priceSocialCents ?? null },
						{ isResident, socialTariff: DEMO_TARIFF_OF.get(`${person}|${slug}`) ?? null },
						seats
					)
				});
				if (status === 'cancelled') return;
				const key = `${person}|${date}`;
				const mine = busy.get(key) ?? [];
				mine.push([start, end]);
				busy.set(key, mine);
				if (status === 'no_show') {
					const pk = `${person}|${slug}`;
					profiles.set(pk, applyNoShow(profiles.get(pk)!, slot.endsAt, DEMO_POLICY));
				}
			};

			const liveStatus = (slot: Slot): BookingStatus => {
				if (slot.endsAt.getTime() <= nowMs) return rand() < NO_SHOW_RATE ? 'no_show' : 'attended';
				if (slot.startsAt.getTime() > nowMs) return 'confirmed';
				return rand() < 0.5 ? 'attended' : 'confirmed';
			};

			for (const { f, slot, first } of events) {
				const start = slot.startsAt.getTime();
				const end = slot.endsAt.getTime();
				const m = 720 + (start - noon) / MIN;
				const noise = 0.8 + 0.4 * prng(hashSeed(`${f.key}|${monday}`))();
				let p =
					f.bookingMode === 'day'
						? (weekend ? 0.45 : 0.25) * size
						: bandBase(weekend, m) *
							kindFactor(f, weekend, m) *
							seasonFactor(f, date) *
							size *
							noise;
				p = Math.min(0.96, p);
				// Viana do Bolo hoxe: o xa empezado vai cheo (a axenda do mostrador vese viva pola
				// mañá); o que queda segue a demanda normal, con teito, para que a portada teña ocos.
				let tries = 8;
				if (slug === 'viana-do-bolo' && isToday) {
					p = start <= nowMs ? Math.max(p, 0.9) : Math.min(p, TODAY_LATER_MAX);
					if (firstFuture.has(`${f.key}|${start}`)) {
						p = 1;
						tries = 40;
					}
					if (first && FIRST_TODAY.has(f.key)) {
						p = 1;
						tries = 40;
					}
				}

				if (f.bookingMode === 'capacity') {
					let demand = 0;
					for (let k = 0; k < f.capacity; k++) if (rand() < p) demand++;
					while (demand > 0) {
						const seats = demand >= 2 && rand() < 0.25 ? 2 : 1;
						const c = pickPerson(start, end, tries, true);
						if (!c) break;
						emit(f, slot, c.person, c.isResident, null, seats, liveStatus(slot));
						demand -= seats;
					}
					if (rand() < CANCEL_FACTOR * p * 3) {
						const c = pickPerson(start, end, tries, false);
						if (c) emit(f, slot, c.person, c.isResident, null, 1, 'cancelled');
					}
					continue;
				}

				const units = f.bookingMode === 'unit' ? f.units : 1;
				for (let u = 0; u < units; u++) {
					const unitIndex = f.bookingMode === 'unit' ? u : null;
					const script = scripted.get(`${f.key}|${start}|${unitIndex}`);
					if (script) {
						const resident = DEMO_PEOPLE[0].profiles[slug]!;
						const status: BookingStatus =
							script.status === 'upcoming'
								? liveStatus(slot)
								: script.status === 'cancelled'
									? 'cancelled'
									: script.status;
						emit(f, slot, 0, resident, unitIndex, 1, status);
						if (status !== 'cancelled') continue;
					}
					if (rand() < p) {
						const c = pickPerson(start, end, tries, true);
						if (c) emit(f, slot, c.person, c.isResident, unitIndex, 1, liveStatus(slot));
					}
					if (rand() < CANCEL_FACTOR * p) {
						const c = pickPerson(start, end, tries, false);
						if (c) emit(f, slot, c.person, c.isResident, unitIndex, 1, 'cancelled');
					}
				}
			}
		}
	}

	// Casos reais e visibles da demo, ao final para non cambiar a historia xerada.
	const story = (name: string, facility: string, daysAgo: number, time: string, code: string) => {
		const person = DEMO_PEOPLE.findIndex((candidate) => candidate.name === name);
		const f = DEMO_FACILITIES.find((candidate) => candidate.key === facility);
		if (person < 0 || !f) throw new Error(`Demo seed: falta o caso ${name}`);
		const unitIndex = f.bookingMode === 'unit' ? f.units - 1 : null;
		// O día pedido ou, se ese día non abre, está pechado ou xa está collido, o anterior que si.
		let slot: Slot | undefined;
		for (let back = daysAgo; addLocalDays(today, -back) >= from && !slot; back++) {
			const date = addLocalDays(today, -back);
			// A primeira franxa desde esa hora: cada instalación ten a súa duración de franxa.
			const candidate = slotsOf(f, date).find((c) => localTimeOf(c.startsAt) >= time);
			if (!candidate) continue;
			const day = localDateOf(candidate.startsAt);
			const clash = bookings.some(
				(b) =>
					(b.facility === f.key &&
						b.status !== 'cancelled' &&
						(unitIndex === null || b.unitIndex === unitIndex) &&
						b.startsAt < candidate.endsAt &&
						candidate.startsAt < b.endsAt) ||
					(b.municipality === f.municipality &&
						b.accessCode === code &&
						localDateOf(b.startsAt) === day)
			);
			if (!clash) slot = candidate;
		}
		// Cunha historia curta (probas) pode non haber sitio: o caso simplemente non se engade.
		if (!slot) return;
		bookings.push({
			facility: f.key,
			municipality: f.municipality,
			person,
			unitIndex,
			seats: 1,
			startsAt: slot.startsAt,
			endsAt: slot.endsAt,
			status: 'attended',
			channel: 'online',
			createdByStaff: false,
			createdAt: new Date(slot.startsAt.getTime() - 7 * 86_400_000),
			cancelledAt: null,
			accessCode: code,
			priceCents: priceFor(
				{ ...f, priceSocialCents: f.priceSocialCents ?? null },
				{
					isResident: DEMO_PEOPLE[person].profiles[f.municipality]!,
					socialTariff: DEMO_TARIFF_OF.get(`${person}|${f.municipality}`) ?? null
				},
				1
			)
		});
	};
	story('Celestino Arias Fervenza', 'viana-piscina-adultos', 100, '12:00', '9901');
	story('Telmo Quiroga Busto', 'viana-padel', 14, '18:00', '9902');
	// Mañás de fin de semana: lonxe das tempadas dos clubs.
	story('Rebeca Viñas Toimil', 'viana-pavillon', 21, '10:00', '9903');
	story('Rebeca Viñas Toimil', 'viana-futbol-7', 28, '10:00', '9904');
	story('Rebeca Viñas Toimil', 'viana-pavillon', 35, '10:00', '9905');
	story('Isay Rodríguez', 'viana-pavillon', 7, '19:00', '9906');
	// Racha de Isay: xoga ao tenis o xoves de cada unha das tres semanas anteriores. Contando
	// desde o xoves, se ese día está collido retrocede como moito ata o luns da mesma semana.
	const thursdayOf = (weeksBack: number) => weekdayOf(today) + 7 * weeksBack - 3;
	story('Isay Rodríguez', 'viana-tenis', thursdayOf(1), '10:00', '9907');
	story('Isay Rodríguez', 'viana-tenis', thursdayOf(2), '10:00', '9908');
	story('Isay Rodríguez', 'viana-tenis', thursdayOf(3), '10:00', '9909');

	return { bookings, closures, seasons, profiles };
}
