// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import {
	bookings,
	municipalityNotices,
	municipalityProfiles,
	notifications,
	outboxEmails,
	users
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { localDateTimeToUtc } from '../domain/time';
import { cancelBooking, createBooking, createBookingTx, rescheduleBooking } from './bookings';
import { seedFixture, type Fixture } from './fixtures';
import { sendPending } from './mailer';
import {
	countUnread,
	emailContent,
	listMunicipalityNotices,
	listNotifications,
	markAllRead,
	markRead,
	notify,
	notifyClosureAffected,
	notifyHoursChanged,
	setNotifyPrefs
} from './notifications';

const now = new Date('2026-10-21T10:00:00Z');
const at = (date: string, hhmm: string) => localDateTimeToUtc(date, hhmm);

let db: Db;
let f: Fixture;

beforeAll(async () => {
	db = await createTestDb();
	f = await seedFixture(db);
});

const book = async (date: string, hhmm: string) => {
	const r = await createBooking(db, {
		municipalityId: f.municipalityId,
		facilityId: f.facilityId,
		profileId: f.profileId,
		startsAt: at(date, hhmm),
		channel: 'online',
		createdByUserId: f.userId,
		now
	});
	if (!r.ok) throw new Error(r.error);
	return r.value;
};

const noticesOf = (bookingId: string) =>
	db.select().from(notifications).where(eq(notifications.bookingId, bookingId));

describe('avisos de reservas', () => {
	it('crear una reserva deixa lido o aviso confirmed da persoa titular', async () => {
		const b = await book('2026-10-23', '10:00');
		const rows = await noticesOf(b.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			kind: 'confirmed',
			userId: f.userId,
			municipalityId: f.municipalityId,
			readAt: expect.any(Date)
		});
		expect(rows[0].params).toMatchObject({ date: '2026-10-23', time: '10:00' });
		expect(typeof rows[0].params.facilityName).toBe('string');
	});

	it('reprogramar engade changed (e non un segundo confirmed)', async () => {
		const b = await book('2026-10-23', '12:00');
		const r = await rescheduleBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			startsAt: at('2026-10-23', '13:00'),
			now
		});
		if (!r.ok) throw new Error(r.error);
		expect(await noticesOf(b.id)).toHaveLength(1);
		const rows = await noticesOf(r.value.id);
		expect(rows.map((n) => n.kind)).toEqual(['changed']);
		expect(rows[0].params).toMatchObject({ date: '2026-10-23', time: '13:00' });
	});

	it('cancelar engade cancelled', async () => {
		const b = await book('2026-10-23', '15:00');
		const r = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: false,
			now
		});
		expect(r.ok).toBe(true);
		expect((await noticesOf(b.id)).map((n) => n.kind).sort()).toEqual(['cancelled', 'confirmed']);
	});

	it('cancelación do persoal engade cancelled_by_staff co motivo en params', async () => {
		const b = await book('2026-10-23', '16:00');
		const r = await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: b.id,
			byStaff: true,
			reason: 'Obras na pista',
			now
		});
		expect(r.ok).toBe(true);
		const rows = (await noticesOf(b.id)).filter((n) => n.kind === 'cancelled_by_staff');
		expect(rows).toHaveLength(1);
		expect(rows[0].params.reason).toBe('Obras na pista');
	});

	it('un erro de reserva non deixa avisos orfos (misma transacción)', async () => {
		const before = (await db.select().from(notifications)).length;
		const r = await createBooking(db, {
			municipalityId: f.municipalityId,
			facilityId: f.facilityId,
			profileId: f.profileId,
			startsAt: at('2026-10-23', '10:00'), // ocupada
			channel: 'online',
			createdByUserId: f.userId,
			now
		});
		expect(r.ok).toBe(false);
		expect((await db.select().from(notifications)).length).toBe(before);
	});
});

describe('correo', () => {
	it('redacta o correo dun rexeitamento co motivo', () => {
		const mail = emailContent(
			'request_status',
			{
				requestTitle: 'Uso do pavillón',
				requestStatus: 'rexeitada',
				response: 'Xa está ocupado'
			},
			'Ribadávila'
		);
		expect(mail.body).toContain('rexeitou');
		expect(mail.body).toContain('Xa está ocupado');
	});

	it('con notify_email e enderezo xera unha fila no buzón sen datos persoais', async () => {
		await db
			.update(users)
			.set({ email: 'uxia.privada@example.org', phone: '600123456' })
			.where(eq(users.id, f.userId));
		await setNotifyPrefs(db, f.userId, { email: true }, now);
		const b = await book('2026-10-24', '10:00');
		const rows = await db.select().from(outboxEmails);
		expect(rows).toHaveLength(1);
		const [row] = rows;
		expect(row.toAddress).toBe('uxia.privada@example.org');
		expect(row.sentAt).toBeNull();
		const text = `${row.subject}\n${row.body}`;
		expect(text).toContain('Ribadávila');
		expect(text).toContain('24/10/2026');
		expect(text).toContain('10:00');
		expect(text).not.toContain('Nerea');
		expect(text).not.toContain('Veciña');
		expect(text).not.toContain('600123456');
		expect(text).not.toContain('uxia.privada');
		expect(text).not.toContain(b.accessCode);
		expect(text).not.toContain(b.id);
	});

	it('o motivo do persoal non vai no correo', async () => {
		await db.delete(outboxEmails);
		await notify(db, {
			userId: f.userId,
			municipalityId: f.municipalityId,
			kind: 'cancelled_by_staff',
			params: { facilityName: 'Pista', date: '2026-10-25', time: '18:00', reason: 'Dato 600999888' }
		});
		const [row] = await db.select().from(outboxEmails);
		expect(row.body).not.toContain('600999888');
	});

	it('sen notify_email non hai correo; sen enderezo tampouco', async () => {
		await db.delete(outboxEmails);
		await setNotifyPrefs(db, f.userId, { email: false }, now);
		await notify(db, {
			userId: f.userId,
			municipalityId: f.municipalityId,
			kind: 'reminder',
			params: { facilityName: 'Pista', date: '2026-10-25', time: '18:00' }
		});
		await db.update(users).set({ email: null }).where(eq(users.id, f.userId));
		await setNotifyPrefs(db, f.userId, { email: true }, now);
		await notify(db, {
			userId: f.userId,
			municipalityId: f.municipalityId,
			kind: 'reminder',
			params: { facilityName: 'Pista', date: '2026-10-25', time: '18:00' }
		});
		expect(await db.select().from(outboxEmails)).toHaveLength(0);
	});

	it('setNotifyPrefs marca o consentimento ao activar e quítao ao desactivar', async () => {
		const later = new Date('2026-10-22T08:00:00Z');
		await setNotifyPrefs(db, f.userId, { email: true }, later);
		let [u] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(u.notifyEmail).toBe(true);
		expect(u.notifyConsentAt?.toISOString()).toBe(later.toISOString());
		await setNotifyPrefs(db, f.userId, { email: false }, later);
		[u] = await db.select().from(users).where(eq(users.id, f.userId));
		expect(u.notifyEmail).toBe(false);
		expect(u.notifyConsentAt).toBeNull();
	});

	it('sendPending envía o pendente, marca sent_at e garda só os rexeitamentos permanentes', async () => {
		await db.delete(outboxEmails);
		await db.insert(outboxEmails).values([
			{ toAddress: 'a@example.org', subject: 's1', body: 'b1' },
			{ toAddress: 'fail@example.org', subject: 's2', body: 'b2' }
		]);
		const sent: string[] = [];
		const transport = {
			send: async (to: string, subject: string) => {
				if (to.startsWith('fail')) {
					throw Object.assign(new Error('550 buzón inexistente'), { responseCode: 550 });
				}
				sent.push(`${to}|${subject}`);
			}
		};
		expect(await sendPending(db, transport)).toBe(1);
		expect(sent).toEqual(['a@example.org|s1']);
		const rows = await db.select().from(outboxEmails);
		expect(rows.find((r) => r.toAddress === 'a@example.org')?.sentAt).not.toBeNull();
		const failed = rows.find((r) => r.toAddress === 'fail@example.org')!;
		expect(failed.sentAt).toBeNull();
		expect(failed.error).toContain('550');
		expect(await sendPending(db, transport)).toBe(0);
	});

	it('EENVELOPE é permanente', async () => {
		await db.delete(outboxEmails);
		await db.insert(outboxEmails).values({ toAddress: 'x', subject: 's', body: 'b' });
		const transport = {
			send: async () => {
				throw Object.assign(new Error('No recipients defined'), { code: 'EENVELOPE' });
			}
		};
		expect(await sendPending(db, transport)).toBe(0);
		expect((await db.select().from(outboxEmails))[0].error).toContain('No recipients');
	});

	it('un fallo transitorio deixa as filas pendentes, para a tanda e reintenta despois', async () => {
		await db.delete(outboxEmails);
		await db.insert(outboxEmails).values([
			{ toAddress: 'one@example.org', subject: 's', body: 'b', createdAt: new Date(1000) },
			{ toAddress: 'two@example.org', subject: 's', body: 'b', createdAt: new Date(2000) },
			{ toAddress: 'three@example.org', subject: 's', body: 'b', createdAt: new Date(3000) }
		]);
		const attempts: string[] = [];
		const flaky = {
			send: async (to: string) => {
				attempts.push(to);
				if (to.startsWith('two')) {
					throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' });
				}
			}
		};
		expect(await sendPending(db, flaky)).toBe(1);
		// Parou na segunda: a terceira nin se intentou.
		expect(attempts).toEqual(['one@example.org', 'two@example.org']);
		const rows = await db.select().from(outboxEmails);
		for (const r of rows.filter((r) => !r.toAddress.startsWith('one'))) {
			expect(r.sentAt).toBeNull();
			expect(r.error).toBeNull();
			expect(r.claimedAt).toBeNull();
		}
		// Co servidor de volta, saen as dúas que quedaban.
		const ok: string[] = [];
		expect(await sendPending(db, { send: async (to) => void ok.push(to) })).toBe(2);
		expect(ok).toEqual(['two@example.org', 'three@example.org']);
	});
});

describe('lectura e privacidade', () => {
	it('markRead non toca avisos alleos; countUnread, markAllRead e a orde', async () => {
		const [other] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'other-user', displayName: 'Outra' })
			.returning();
		await db.delete(notifications);
		await notify(db, {
			userId: f.userId,
			municipalityId: f.municipalityId,
			kind: 'confirmed',
			params: { facilityName: 'A', date: '2026-10-26', time: '10:00' }
		});
		await notify(db, {
			userId: f.userId,
			municipalityId: f.municipalityId,
			kind: 'reminder',
			params: { facilityName: 'B', date: '2026-10-26', time: '11:00' }
		});
		const [mine] = await listNotifications(db, f.userId);
		expect(await markRead(db, other.id, mine.id)).toBe(false);
		expect(await countUnread(db, f.userId)).toBe(2);
		expect(await listNotifications(db, other.id)).toEqual([]);
		expect(await markRead(db, f.userId, mine.id)).toBe(true);
		expect(await markRead(db, f.userId, mine.id)).toBe(true);
		expect(await markRead(db, f.userId, crypto.randomUUID())).toBe(false);
		expect(await countUnread(db, f.userId)).toBe(1);
		await markAllRead(db, f.userId);
		expect(await countUnread(db, f.userId)).toBe(0);
		await markAllRead(db, other.id);
		const list = await listNotifications(db, f.userId, { limit: 1 });
		expect(list).toHaveLength(1);
	});

	it('listNotifications: máis novo primeiro', async () => {
		await db.delete(notifications);
		await db.insert(notifications).values([
			{ userId: f.userId, kind: 'confirmed', createdAt: new Date('2026-10-20T10:00:00Z') },
			{ userId: f.userId, kind: 'cancelled', createdAt: new Date('2026-10-21T10:00:00Z') }
		]);
		expect((await listNotifications(db, f.userId)).map((n) => n.kind)).toEqual([
			'cancelled',
			'confirmed'
		]);
	});
});

describe('avisos do concello', () => {
	it('só os vixentes e só dos concellos pedidos', async () => {
		const t0 = new Date('2026-10-21T10:00:00Z');
		const mk = (municipalityId: string, title: string, startsAt: string, endsAt?: string) => ({
			municipalityId,
			title,
			body: '',
			startsAt: new Date(startsAt),
			endsAt: endsAt ? new Date(endsAt) : null,
			createdByUserId: f.userId
		});
		await db
			.insert(municipalityNotices)
			.values([
				mk(f.municipalityId, 'vixente', '2026-10-01T00:00:00Z'),
				mk(f.municipalityId, 'vixente con fin', '2026-10-05T00:00:00Z', '2026-11-01T00:00:00Z'),
				mk(f.municipalityId, 'caducado', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
				mk(f.municipalityId, 'futuro', '2026-10-22T00:00:00Z'),
				mk(f.otherMunicipalityId, 'doutro concello', '2026-10-01T00:00:00Z')
			]);
		const mine = await listMunicipalityNotices(db, [f.municipalityId], t0);
		expect(mine.map((n) => n.title)).toEqual(['vixente con fin', 'vixente']);
		const both = await listMunicipalityNotices(db, [f.municipalityId, f.otherMunicipalityId], t0);
		expect(both.map((n) => n.title).sort()).toEqual(
			['doutro concello', 'vixente', 'vixente con fin'].sort()
		);
		expect(await listMunicipalityNotices(db, [], t0)).toEqual([]);
	});
});

describe('peche de instalación', () => {
	it('notifyClosureAffected avisa unha vez a cada reserva confirmada afectada', async () => {
		const [second] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'second', displayName: 'Segundo' })
			.returning();
		const [p2] = await db
			.insert(municipalityProfiles)
			.values({ municipalityId: f.municipalityId, userId: second.id })
			.returning();
		await db.delete(notifications);
		const mkB = (profileId: string, date: string, hhmm: string) =>
			createBooking(db, {
				municipalityId: f.municipalityId,
				facilityId: f.facilityId,
				profileId,
				startsAt: at(date, hhmm),
				channel: 'online',
				createdByUserId: f.userId,
				now
			});
		const a = await mkB(f.profileId, '2026-11-02', '10:00');
		const b = await mkB(p2.id, '2026-11-02', '11:00');
		await mkB(f.profileId, '2026-11-03', '10:00'); // fóra do peche
		const cancelled = await mkB(p2.id, '2026-11-02', '12:00');
		if (!a.ok || !b.ok || !cancelled.ok) throw new Error('setup');
		await cancelBooking(db, {
			municipalityId: f.municipalityId,
			bookingId: cancelled.value.id,
			byStaff: false,
			now
		});
		await db.delete(notifications);

		const closure = { from: at('2026-11-02', '00:00'), to: at('2026-11-03', '00:00') };
		const c1 = { closureId: crypto.randomUUID(), reason: 'Obras' };
		const n = await notifyClosureAffected(db, f.municipalityId, f.facilityId, closure, now, c1);
		expect(n).toBe(2);
		const rows = await db.select().from(notifications);
		expect(rows.map((r) => r.kind)).toEqual(['closure', 'closure']);
		expect(rows.map((r) => r.userId).sort()).toEqual([f.userId, second.id].sort());
		expect(rows.every((r) => r.params.reason === 'Obras')).toBe(true);
		expect(rows.every((r) => r.params.closureId === c1.closureId)).toBe(true);
		// O mesmo peche non duplica...
		expect(await notifyClosureAffected(db, f.municipalityId, f.facilityId, closure, now, c1)).toBe(
			0
		);
		expect(await db.select().from(notifications)).toHaveLength(2);
		// ...pero outro peche distinto sobre as mesmas reservas avisa de novo.
		const c2 = { closureId: crypto.randomUUID(), reason: 'Limpeza' };
		expect(await notifyClosureAffected(db, f.municipalityId, f.facilityId, closure, now, c2)).toBe(
			2
		);
		expect(await db.select().from(notifications)).toHaveLength(4);
		// As reservas non se cancelan.
		const [row] = await db.select().from(bookings).where(eq(bookings.id, a.value.id));
		expect(row.status).toBe('confirmed');
	});
});

describe('cambio de horario', () => {
	it('notifyHoursChanged avisa só ás reservas que quedan fóra do horario novo', async () => {
		await db.delete(notifications);
		const early = await book('2026-10-26', '09:00');
		const late = await book('2026-10-26', '20:00');
		await db.delete(notifications);
		// Luns 09–13: a das 20:00 queda fóra.
		const hours = [{ weekday: 0, opens: '09:00', closes: '13:00' }];
		expect(
			await notifyHoursChanged(db, f.municipalityId, f.facilityId, hours, now)
		).toBeGreaterThan(0);
		const rows = await db.select().from(notifications);
		expect(rows.every((r) => r.kind === 'hours_changed')).toBe(true);
		expect(rows.some((r) => r.bookingId === late.id)).toBe(true);
		expect(rows.some((r) => r.bookingId === early.id)).toBe(false);
	});
});

describe('atomicidade', () => {
	it('un fallo despois de escribir o aviso non deixa aviso nin reserva', async () => {
		const before = (await db.select().from(notifications)).length;
		const bookingsBefore = (await db.select().from(bookings)).length;
		await expect(
			db.transaction(async (tx) => {
				const r = await createBookingTx(tx, {
					municipalityId: f.municipalityId,
					facilityId: f.facilityId,
					profileId: f.profileId,
					startsAt: at('2026-10-30', '10:00'),
					channel: 'online',
					createdByUserId: f.userId,
					now
				});
				expect(r.ok).toBe(true);
				// Aviso xa escrito dentro da transacción.
				expect((await tx.select().from(notifications)).length).toBe(before + 1);
				throw new Error('fallo posterior');
			})
		).rejects.toThrow('fallo posterior');
		expect((await db.select().from(notifications)).length).toBe(before);
		expect((await db.select().from(bookings)).length).toBe(bookingsBefore);
	});
});
