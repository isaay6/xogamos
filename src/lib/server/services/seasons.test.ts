// SPDX-License-Identifier: EUPL-1.2
// Reservas de temporada (tarefa 2 do persoal): os adestramentos dos clubs ocupan a instalación
// en todas as vías de dispoñibilidade e, ao crealas sobre reservas, avisan antes de cancelar.
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { bookings, notifications, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc, localTimeOf } from '../domain/time';
import { createBooking, getAvailability } from './bookings';
import { seedFixture, type Fixture } from './fixtures';
import { freeNow } from './home';
import { freeOptions } from './search';
import type { NoticeParams } from '../../avisos';
import { noticeText } from '../../ui/notice-text';
import {
	createSeason,
	createSeasons,
	deleteSeason,
	listSeasons,
	seasonConflicts,
	updateSeason
} from './seasons';
import { getAgenda } from './staff';

// Venres 20 nov 2026; o martes 24 cae dentro da ventá de 14 días.
const NOW = new Date('2026-11-20T10:00:00+01:00');
const TUESDAY = '2026-11-24';
const at = (date: string, hhmm: string) => localDateTimeToUtc(date, hhmm);

async function setup(opts: Parameters<typeof seedFixture>[1] = {}) {
	const db = await createTestDb();
	const f = await seedFixture(db, opts);
	const [admin] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'fixture-admin', displayName: 'Admin' })
		.returning();
	return { db, f, adminId: admin.id };
}

/** CD Viana: martes (1) de 19:00 a 20:30, de outubro a xuño. */
const season = (f: Fixture, createdBy: string, extra: Record<string, unknown> = {}) => ({
	facilityId: f.facilityId,
	unitIndex: null,
	entityName: 'CD Viana — adestramento',
	weekday: 1,
	startsTime: '19:00',
	endsTime: '20:30',
	fromDate: '2026-10-01',
	toDate: '2027-06-30',
	createdBy,
	...extra
});

const book = async (db: Db, f: Fixture, date: string, hhmm: string, unitIndex?: number) => {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at(date, hhmm),
		unitIndex,
		channel: 'online',
		createdByUserId: f.userId,
		now: NOW
	});
	if (!r.ok) throw new Error(r.error);
	return r.value;
};

const freeTimes = async (db: Db, f: Fixture, date: string) => {
	const r = await getAvailability(db, f.municipalityId, f.facilityId, date);
	if (!r.ok) throw new Error(r.error);
	return r.value.filter((s) => s.free).map((s) => localTimeOf(s.startsAt));
};

describe('a tempada ocupa a instalación', () => {
	let db: Db;
	let f: Fixture;
	let adminId: string;
	beforeAll(async () => {
		({ db, f, adminId } = await setup());
		const r = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: false,
			now: NOW
		});
		expect(r.ok).toBe(true);
	});

	it('as franxas que solapan a ocorrencia non están libres en loadDayAvailability', async () => {
		const free = await freeTimes(db, f, TUESDAY);
		expect(free).toContain('18:00');
		expect(free).not.toContain('19:00');
		expect(free).not.toContain('20:00');
		expect(free).toContain('21:00');
	});

	it('nin na busca nin en «Libre agora mesmo»', async () => {
		const options = await freeOptions(db, f.municipalityId, f.typeId, TUESDAY, '19:00', NOW);
		expect(options).toEqual([]);
		// Martes ás 18:30: sen a tempada a primeira libre sería ás 19:00.
		const evening = new Date('2026-11-24T18:30:00+01:00');
		const cards = await freeNow(db, f.municipalityId, evening);
		expect(cards.map((c) => c.time)).toEqual(['21:00']);
	});

	it('createBooking rexeita a franxa da tempada', async () => {
		const r = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at(TUESDAY, '20:00'),
			channel: 'online',
			createdByUserId: f.userId,
			now: NOW
		});
		expect(r).toEqual({ ok: false, error: 'SLOT_UNAVAILABLE' });
	});

	it('fóra do seu rango de datas ou noutro día da semana non bloquea', async () => {
		// Martes antes de from_date e mércores dentro do rango.
		expect(await freeTimes(db, f, '2026-09-29')).toContain('19:00');
		expect(await freeTimes(db, f, '2026-11-25')).toContain('19:00');
		// Martes despois de to_date.
		expect(await freeTimes(db, f, '2027-07-06')).toContain('19:00');
	});

	it('a axenda mostra a tempada co nome da entidade', async () => {
		const agenda = await getAgenda(db, f.municipalityId, TUESDAY);
		const group = agenda.find((g) => g.facilityId === f.facilityId)!;
		expect(group.seasons).toEqual([
			expect.objectContaining({
				entityName: 'CD Viana — adestramento',
				startsAt: at(TUESDAY, '19:00'),
				endsAt: at(TUESDAY, '20:30'),
				unitIndex: null
			})
		]);
		const wednesday = await getAgenda(db, f.municipalityId, '2026-11-25');
		expect(wednesday.find((g) => g.facilityId === f.facilityId)!.seasons).toEqual([]);
	});

	it('listSeasons é do concello; deleteSeason doutro concello é NOT_FOUND e o propio libera', async () => {
		const own = await listSeasons(db, f.municipalityId);
		expect(own.map((s) => s.entityName)).toEqual(['CD Viana — adestramento']);
		expect(await listSeasons(db, f.otherMunicipalityId)).toEqual([]);
		expect(await deleteSeason(db, f.otherMunicipalityId, own[0].id)).toEqual({
			ok: false,
			error: 'NOT_FOUND'
		});
		expect((await deleteSeason(db, f.municipalityId, own[0].id)).ok).toBe(true);
		expect(await freeTimes(db, f, TUESDAY)).toContain('19:00');
	});
});

describe('crear unha tempada sobre reservas confirmadas', () => {
	it('sen confirm devolve CONFLICTS coa lista e non crea nada', async () => {
		const { db, f, adminId } = await setup();
		const inside = await book(db, f, TUESDAY, '20:00');
		await book(db, f, TUESDAY, '18:00');
		await book(db, f, '2026-11-25', '19:00');
		const conflicts = await seasonConflicts(db, f.municipalityId, season(f, adminId), NOW);
		expect(conflicts.ok && conflicts.value.map((b) => b.id)).toEqual([inside.id]);

		const r = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: false,
			now: NOW
		});
		expect(r.ok).toBe(false);
		if (r.ok || r.error !== 'CONFLICTS') throw new Error('expected CONFLICTS');
		expect(r.conflicts.map((b) => b.id)).toEqual([inside.id]);
		expect(await listSeasons(db, f.municipalityId)).toEqual([]);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, inside.id));
		expect(row.status).toBe('confirmed');
	});

	it('con confirm crea a tempada, cancela a reserva co motivo e engade un aviso', async () => {
		const { db, f, adminId } = await setup();
		const inside = await book(db, f, TUESDAY, '19:00');
		const r = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: true,
			now: NOW
		});
		expect(r.ok).toBe(true);
		expect(await listSeasons(db, f.municipalityId)).toHaveLength(1);
		const [row] = await db.select().from(bookings).where(eq(bookings.id, inside.id));
		expect(row.status).toBe('cancelled');
		const notices = await db
			.select()
			.from(notifications)
			.where(
				and(eq(notifications.bookingId, inside.id), eq(notifications.kind, 'cancelled_by_staff'))
			);
		expect(notices).toHaveLength(1);
		// Só a entidade: sen texto escrito nun idioma.
		expect(notices[0].params.season).toBe('CD Viana — adestramento');
		expect(notices[0].params).not.toHaveProperty('reason');
		expect(notices[0].userId).toBe(f.userId);
		const params = notices[0].params as Partial<NoticeParams>;
		expect(noticeText('gl', 'cancelled_by_staff', params)).toContain(
			'Motivo: Reserva de tempada: CD Viana — adestramento'
		);
		expect(noticeText('es', 'cancelled_by_staff', params)).toContain(
			'Motivo: Reserva de temporada: CD Viana — adestramento'
		);
	});

	it('valida: instalación doutro concello NOT_FOUND; horas ao revés VALIDATION_FAILED', async () => {
		const { db, f, adminId } = await setup();
		const opts = { confirm: false, now: NOW };
		expect(
			await createSeason(
				db,
				f.municipalityId,
				season(f, adminId, { facilityId: f.otherFacilityId }),
				opts
			)
		).toEqual({ ok: false, error: 'NOT_FOUND' });
		for (const bad of [
			{ startsTime: '20:30', endsTime: '19:00' },
			{ weekday: 7 },
			{ fromDate: '2027-07-01', toDate: '2026-10-01' },
			{ entityName: '   ' },
			{ unitIndex: 0 }
		]) {
			expect(await createSeason(db, f.municipalityId, season(f, adminId, bad), opts)).toEqual({
				ok: false,
				error: 'VALIDATION_FAILED'
			});
		}
	});

	it('a vista previa (seasonConflicts) e createSeason coinciden en erros e conflitos', async () => {
		const { db, f, adminId } = await setup();
		await book(db, f, TUESDAY, '19:00');
		const cases = [
			// Unidade nunha instalación que non é por unidades: a vista previa tamén a rexeita.
			{ input: season(f, adminId, { unitIndex: 0 }), error: 'VALIDATION_FAILED' },
			{ input: season(f, adminId, { facilityId: f.otherFacilityId }), error: 'NOT_FOUND' },
			{ input: season(f, adminId, { weekday: 9 }), error: 'VALIDATION_FAILED' }
		];
		for (const { input, error } of cases) {
			expect(await seasonConflicts(db, f.municipalityId, input, NOW)).toEqual({
				ok: false,
				error
			});
			expect(await createSeason(db, f.municipalityId, input, { confirm: false, now: NOW })).toEqual(
				{ ok: false, error }
			);
		}
		const preview = await seasonConflicts(db, f.municipalityId, season(f, adminId), NOW);
		const created = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: false,
			now: NOW
		});
		if (!preview.ok || created.ok || created.error !== 'CONFLICTS') throw new Error('mismatch');
		expect(created.conflicts.map((b) => b.id)).toEqual(preview.value.map((b) => b.id));
		// Cun `now` despois da reserva, xa non conta en ningún dos dous.
		const later = new Date('2026-11-24T21:00:00+01:00');
		expect(await seasonConflicts(db, f.municipalityId, season(f, adminId), later)).toEqual({
			ok: true,
			value: []
		});
	});
});

describe('tempada en modo unidade', () => {
	it('cunha unidade concreta só ocupa esa; sen unidade ocupa todas', async () => {
		const { db, f, adminId } = await setup({ bookingMode: 'unit', units: 3 });
		const opts = { confirm: false, now: NOW };
		expect(
			(await createSeason(db, f.municipalityId, season(f, adminId, { unitIndex: 0 }), opts)).ok
		).toBe(true);
		let r = await getAvailability(db, f.municipalityId, f.facilityId, TUESDAY);
		if (!r.ok) throw new Error(r.error);
		const s19 = r.value.find((s) => localTimeOf(s.startsAt) === '19:00')!;
		expect(s19.freeUnits).toEqual([1, 2]);

		// Unha reserva da unidade 2 entra en conflito coa tempada sen unidade; a da 0 non pode existir.
		// A tempada sen unidade vai ás 20:30 para non pisar a da unidade 0 (iso queda bloqueado).
		const other = await book(db, f, TUESDAY, '20:00', 2);
		const conflicts = await seasonConflicts(
			db,
			f.municipalityId,
			season(f, adminId, {
				entityName: 'Escola',
				unitIndex: null,
				startsTime: '20:30',
				endsTime: '21:30'
			}),
			NOW
		);
		expect(conflicts.ok && conflicts.value.map((b) => b.id)).toEqual([other.id]);
		expect(
			(
				await createSeason(
					db,
					f.municipalityId,
					season(f, adminId, {
						entityName: 'Escola',
						unitIndex: null,
						startsTime: '20:30',
						endsTime: '21:30'
					}),
					{ confirm: true, now: NOW }
				)
			).ok
		).toBe(true);
		r = await getAvailability(db, f.municipalityId, f.facilityId, TUESDAY);
		if (!r.ok) throw new Error(r.error);
		expect(r.value.find((s) => localTimeOf(s.startsAt) === '20:00')!.free).toBe(false);
	});
});

describe('solapes entre tempadas e edición', () => {
	it('unha tempada que pisa outra da mesma instalación queda bloqueada (con ou sen confirm)', async () => {
		const { db, f, adminId } = await setup();
		const first = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: false,
			now: NOW
		});
		if (!first.ok) throw new Error(first.error);
		for (const confirm of [false, true]) {
			const r = await createSeason(
				db,
				f.municipalityId,
				season(f, adminId, { entityName: 'Escola', startsTime: '20:00', endsTime: '21:00' }),
				{ confirm, now: NOW }
			);
			expect(r).toMatchObject({ ok: false, error: 'SEASON_OVERLAP' });
			expect(!r.ok && 'overlaps' in r && r.overlaps.map((o) => o.id)).toEqual([first.value.id]);
		}
		// Seguida (20:30) ou noutro día non pisa.
		const next = await createSeason(
			db,
			f.municipalityId,
			season(f, adminId, { entityName: 'Escola', startsTime: '20:30', endsTime: '21:30' }),
			{ confirm: false, now: NOW }
		);
		expect(next.ok).toBe(true);
		expect((await listSeasons(db, f.municipalityId)).length).toBe(2);
	});

	it('varios días a vez: todo ou nada, e os conflitos de todos os días xuntos', async () => {
		const { db, f, adminId } = await setup();
		const tuesday = await book(db, f, TUESDAY, '19:00');
		const thursday = await book(db, f, '2026-11-26', '19:00');
		const inputs = [1, 3].map((weekday) => season(f, adminId, { weekday }));
		const r = await createSeasons(db, f.municipalityId, inputs, { confirm: false, now: NOW });
		expect(r).toMatchObject({ ok: false, error: 'CONFLICTS' });
		expect(!r.ok && 'conflicts' in r && r.conflicts.map((b) => b.id)).toEqual([
			tuesday.id,
			thursday.id
		]);
		expect(await listSeasons(db, f.municipalityId)).toEqual([]);

		const done = await createSeasons(db, f.municipalityId, inputs, { confirm: true, now: NOW });
		expect(done.ok && done.value.map((s) => s.weekday)).toEqual([1, 3]);
		const rows = await db.select().from(bookings);
		expect(rows.every((b) => b.status === 'cancelled')).toBe(true);
		const notices = await db
			.select()
			.from(notifications)
			.where(eq(notifications.kind, 'cancelled_by_staff'));
		expect(notices).toHaveLength(2);
	});

	it('editar compara coas outras (non consigo mesma) e pide confirmar sobre reservas', async () => {
		const { db, f, adminId } = await setup();
		const a = await createSeason(db, f.municipalityId, season(f, adminId), {
			confirm: false,
			now: NOW
		});
		const b = await createSeason(
			db,
			f.municipalityId,
			season(f, adminId, { entityName: 'Escola', weekday: 2 }),
			{ confirm: false, now: NOW }
		);
		if (!a.ok || !b.ok) throw new Error('setup');
		// Mover a tempada A un pouco: pisa só a súa vella franxa → vale.
		const moved = await updateSeason(
			db,
			f.municipalityId,
			a.value.id,
			season(f, adminId, { startsTime: '18:30', endsTime: '20:00' }),
			{ confirm: false, now: NOW }
		);
		expect(moved).toMatchObject({ ok: true, value: { id: a.value.id, startsTime: '18:30' } });
		// Levala ao mércores pisa B → bloqueado.
		const clash = await updateSeason(
			db,
			f.municipalityId,
			a.value.id,
			season(f, adminId, { weekday: 2 }),
			{ confirm: false, now: NOW }
		);
		expect(clash).toMatchObject({ ok: false, error: 'SEASON_OVERLAP' });
		// Sobre unha reserva: CONFLICTS; con confirm, cancélaa.
		const booked = await book(db, f, TUESDAY, '21:00');
		const over = await updateSeason(
			db,
			f.municipalityId,
			a.value.id,
			season(f, adminId, { startsTime: '20:00', endsTime: '22:00' }),
			{ confirm: false, now: NOW }
		);
		expect(!over.ok && 'conflicts' in over && over.conflicts.map((x) => x.id)).toEqual([booked.id]);
		expect(
			(
				await updateSeason(
					db,
					f.municipalityId,
					a.value.id,
					season(f, adminId, { startsTime: '20:00', endsTime: '22:00' }),
					{ confirm: true, now: NOW }
				)
			).ok
		).toBe(true);
		// Doutro concello: NOT_FOUND.
		expect(
			await updateSeason(db, f.otherMunicipalityId, a.value.id, season(f, adminId), {
				confirm: false,
				now: NOW
			})
		).toEqual({ ok: false, error: 'NOT_FOUND' });
	});
});
