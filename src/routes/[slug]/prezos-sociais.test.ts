// SPDX-License-Identifier: EUPL-1.2
// Fase 4, tarefa 1 (arranxo 1): o prezo que se ensina antes de reservar é o que se garda, coa
// tarifa social (priceFor) no mostrador, en «lo libre» e en confirmar.
import { isRedirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../lib/server/db/client';
import {
	bookings,
	facilities,
	municipalityProfiles,
	staffRoles,
	users
} from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { localDateTimeToUtc } from '../../lib/server/domain/time';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../lib/server/services/fixtures';
import { createLocalPerson, setSocialTariff } from '../../lib/server/services/staff';
import FreeOptionCard from '../../lib/ui/FreeOptionCard.svelte';
import ConfirmarPage from './confirmar/+page.svelte';
import { actions as confirmarActions, load as loadConfirmar } from './confirmar/+page.server';
import { load as loadNova } from './conserxeria/nova/+page.server';
import { load as loadLibre } from './reservar/[typeId]/libre/+page.server';

const NOW = new Date('2026-11-24T08:00:00+01:00');
const DATE = '2026-11-24';
const SOCIAL = 120;

let db: Db;
let fx: Fixture;
let desk: { id: string; displayName: string };
let brais: { id: string; displayName: string };
let xoanProfile: string;

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	await db
		.update(facilities)
		.set({ priceSocialCents: SOCIAL })
		.where(eq(facilities.id, fx.facilityId));
	const [staff] = await db
		.insert(users)
		.values({ provider: 'local', subject: 'desk', displayName: 'Roi Conserxe' })
		.returning();
	desk = { id: staff.id, displayName: staff.displayName };
	await db
		.insert(staffRoles)
		.values({ userId: staff.id, municipalityId: fx.municipalityId, role: 'conserxe' });
	const xoan = await createLocalPerson(db, fx.municipalityId, {
		displayName: 'Hadrián Seixo Mouriño',
		phone: '600 000 001'
	});
	if (!xoan.ok) throw new Error(xoan.error);
	xoanProfile = xoan.value.profileId;
	await setSocialTariff(db, fx.municipalityId, xoanProfile, 'maior');
	// Telmo (empadroado, perfil do fixture) tamén con tarifa social.
	const [p] = await db
		.select({ userId: municipalityProfiles.userId })
		.from(municipalityProfiles)
		.where(eq(municipalityProfiles.id, fx.residentProfileId));
	brais = { id: p.userId, displayName: 'Telmo Empadroado' };
	await setSocialTariff(db, fx.municipalityId, fx.residentProfileId, 'familia');
});

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => Promise<T>)(event as never);

describe('mostrador: nova reserva', () => {
	it('para Xoán (tarifa maior) as opcións levan o prezo social', async () => {
		const d = await call<any>(
			loadNova,
			makeEvent({
				db,
				user: desk,
				now: NOW,
				url: `http://localhost/ribadavila/conserxeria/nova?persoa=${xoanProfile}&tipo=${fx.typeId}&date=${DATE}&time=18:00`,
				params: { slug: 'ribadavila' }
			})
		);
		expect(d.person.socialTariff).toBe('maior');
		expect(d.options).toHaveLength(1);
		expect(d.options[0].priceCents).toBe(SOCIAL);
	});
});

describe('veciñanza: lo libre e confirmar', () => {
	const url = (hhmm: string) =>
		`http://localhost/ribadavila/confirmar?facility=${fx.facilityId}&startsAt=${localDateTimeToUtc(DATE, hhmm).toISOString()}`;

	it('lo libre: cada opción co prezo da persoa, e a tarxeta ensínao', async () => {
		const d = await call<any>(
			loadLibre,
			makeEvent({
				db,
				user: brais,
				now: NOW,
				url: `http://localhost/ribadavila/reservar/${fx.typeId}/libre?date=${DATE}&time=18:00`,
				params: { slug: 'ribadavila', typeId: fx.typeId }
			})
		);
		expect(d.options[0].priceCents).toBe(SOCIAL);
		const html = render(FreeOptionCard as never, {
			props: { option: d.options[0], resident: d.resident, locale: 'gl' } as never
		}).body;
		expect(html).toContain('1,20');
		expect(html).not.toContain('3,00');
		// Sen sesión, sen prezo persoal: os dous prezos xerais.
		const anon = await call<any>(
			loadLibre,
			makeEvent({
				db,
				now: NOW,
				url: `http://localhost/ribadavila/reservar/${fx.typeId}/libre?date=${DATE}&time=18:00`,
				params: { slug: 'ribadavila', typeId: fx.typeId }
			})
		);
		expect(anon.options[0].priceCents).toBeNull();
	});

	it('confirmar ensina o prezo social e é o mesmo que se garda', async () => {
		const page = await call<any>(
			loadConfirmar,
			makeEvent({ db, user: brais, now: NOW, url: url('19:00'), params: { slug: 'ribadavila' } })
		);
		expect(page.priceCents).toBe(SOCIAL);
		const html = render(ConfirmarPage as never, {
			props: {
				data: { ...page, municipality: { slug: 'ribadavila', name: 'R' }, locale: 'gl' },
				form: null
			} as never
		}).body;
		expect(html).toContain('1,20');

		let thrown: unknown;
		try {
			await call(
				confirmarActions.default,
				makeEvent({
					db,
					user: brais,
					now: NOW,
					url: url('19:00'),
					params: { slug: 'ribadavila' },
					method: 'POST'
				})
			);
		} catch (e) {
			thrown = e;
		}
		expect(isRedirect(thrown)).toBe(true);
		const [stored] = await db
			.select()
			.from(bookings)
			.where(eq(bookings.profileId, fx.residentProfileId));
		expect(stored.priceCents).toBe(page.priceCents);
	});

	it('sen tarifa nin perfil: o prezo xeral de non empadroado', async () => {
		const [stranger] = await db
			.insert(users)
			.values({ provider: 'local', subject: 'stranger', displayName: 'Persoa Nova' })
			.returning();
		const page = await call<any>(
			loadConfirmar,
			makeEvent({
				db,
				user: { id: stranger.id, displayName: stranger.displayName },
				now: NOW,
				url: url('20:00'),
				params: { slug: 'ribadavila' }
			})
		);
		expect(page.priceCents).toBe(600);
	});
});
