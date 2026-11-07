// SPDX-License-Identifier: EUPL-1.2
// Avisos do concello desde administración (tarefa 6): redactar, publicar entre datas, editar e
// quitar; saen na pestana «Avisos» da veciñanza só mentres están vixentes.
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../../lib/server/db/client';
import { staffRoles, users } from '../../../lib/server/db/schema';
import { createTestDb } from '../../../lib/server/db/test-db';
import { makeEvent } from '../../../lib/server/http/test-event';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { createMunicipalityNotice } from '../../../lib/server/services/notifications';
import { load as residentLoad } from '../avisos/+page.server';
import { actions, load } from './avisos/+page.server';
import AvisosAdminPage from './avisos/+page.svelte';

// Xoves 22 out 2026, 10:00 en Madrid.
const NOW = new Date('2026-10-22T08:00:00Z');
type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;
let outsider: U;

const mkUser = async (subject: string, name: string): Promise<U> => {
	const [u] = await db
		.insert(users)
		.values({ provider: 'local', subject, displayName: name })
		.returning();
	return { id: u.id, displayName: u.displayName };
};

const ev = (user: U | null, form?: Record<string, string>, query = '', path = 'admin/avisos') => {
	const event = makeEvent({
		db,
		now: NOW,
		user,
		params: { slug: 'ribadavila' },
		url: `http://localhost/ribadavila/${path}${query}`,
		method: form ? 'POST' : 'GET'
	});
	if (form) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(form)) fd.set(k, v);
		Object.defineProperty(event, 'request', {
			value: new Request(event.url, { method: 'POST', body: fd })
		});
	}
	return event as never;
};
const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => Promise<T>)(event as never);

const residentTitles = async () => {
	const data = await call<{ notices: { title: string }[] }>(
		residentLoad,
		ev(null, undefined, '', 'avisos')
	);
	return data.notices.map((n) => n.title);
};

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('admin', 'Rebeca Dorrío');
	conserxe = await mkUser('cons', 'Xoán Conserxe');
	outsider = await mkUser('admin-monte', 'Admin Montemaior');
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: outsider.id, municipalityId: fx.otherMunicipalityId, role: 'admin' }
	]);
});

describe('avisos do concello', () => {
	it('un aviso publicado hoxe sae na pestana Avisos da veciñanza; un futuro aínda non', async () => {
		const today = await call(
			actions.gardar,
			ev(admin, {
				title: 'Piscina pechada o luns',
				body: 'Limpeza anual.\nVolve abrir o martes.',
				from: '2026-10-22',
				to: '2026-10-27'
			})
		);
		expect(today).toEqual({ published: true });
		const future = await call(
			actions.gardar,
			ev(admin, { title: 'Torneo de Nadal', body: '', from: '2026-12-01', to: '' })
		);
		expect(future).toEqual({ published: true });

		expect(await residentTitles()).toEqual(['Piscina pechada o luns']);

		const data = await call<{ notices: { title: string; state: string; to: string | null }[] }>(
			load,
			ev(admin)
		);
		expect(data.notices.map((n) => [n.title, n.state, n.to])).toEqual([
			['Torneo de Nadal', 'proximo', null],
			['Piscina pechada o luns', 'activo', '2026-10-27']
		]);
	});

	it('os caducados non saen á veciñanza e a lista dio «Caducado»', async () => {
		await createMunicipalityNotice(
			db,
			fx.municipalityId,
			{
				title: 'Festa do verán',
				body: '',
				startsAt: new Date('2026-07-01T00:00:00+02:00'),
				endsAt: new Date('2026-08-01T00:00:00+02:00')
			},
			admin.id
		);
		expect(await residentTitles()).not.toContain('Festa do verán');
		const data = await call<Record<string, unknown>>(load, ev(admin));
		const html = render(AvisosAdminPage, {
			props: {
				data: {
					...data,
					locale: 'gl',
					municipality: {
						slug: 'ribadavila',
						name: 'Ribadávila',
						primaryColor: '#1d4ed8',
						hasLogo: false,
						logoVersion: 0
					}
				},
				form: null,
				params: {}
			} as never
		}).body;
		expect(html).toContain('Caducado');
		expect(html).toContain('Próximo');
		expect(html).toContain('Activo');
		expect(html).toContain('Así o verá a veciñanza');
		expect(html).toContain('Bando · Ribadávila');
		expect(html).toContain('data-tour="avisos-compor"');
	});

	it('editar e quitar; sen título ou con «ata» antes de «desde» dá 400', async () => {
		const data = await call<{ notices: { id: string; title: string }[] }>(load, ev(admin));
		const piscina = data.notices.find((n) => n.title === 'Piscina pechada o luns')!;
		const editing = await call<{ editing: { title: string } | null }>(
			load,
			ev(admin, undefined, `?editar=${piscina.id}`)
		);
		expect(editing.editing?.title).toBe('Piscina pechada o luns');

		const base = { id: piscina.id, body: '', from: '2026-10-22', to: '' };
		expect(await call(actions.gardar, ev(admin, { ...base, title: '  ' }))).toMatchObject({
			status: 400,
			data: { error: 'INVALID' }
		});
		expect(
			await call(actions.gardar, ev(admin, { ...base, title: 'X', to: '2026-10-01' }))
		).toMatchObject({ status: 400 });
		expect(
			await call(actions.gardar, ev(admin, { ...base, title: 'Piscina aberta de novo' }))
		).toEqual({ saved: true });
		expect(await residentTitles()).toEqual(['Piscina aberta de novo']);

		expect(await call(actions.borrar, ev(admin, { id: piscina.id }))).toEqual({ deleted: true });
		expect(await residentTitles()).toEqual([]);
		expect(await call(actions.borrar, ev(admin, { id: piscina.id }))).toMatchObject({
			status: 404
		});
	});

	it('garda: conserxe e admin doutro concello dan 403; un aviso doutro concello, 404', async () => {
		const form = { title: 'X', body: '', from: '2026-10-22', to: '' };
		for (const user of [conserxe, outsider]) {
			await expect(call(load, ev(user))).rejects.toMatchObject({ status: 403 });
			await expect(call(actions.gardar, ev(user, form))).rejects.toMatchObject({ status: 403 });
			await expect(
				call(actions.borrar, ev(user, { id: crypto.randomUUID() }))
			).rejects.toMatchObject({ status: 403 });
		}
		const other = await createMunicipalityNotice(
			db,
			fx.otherMunicipalityId,
			{ title: 'Do outro concello', body: '', startsAt: NOW },
			outsider.id
		);
		if (!other.ok) throw new Error(other.error);
		await expect(
			call(load, ev(admin, undefined, `?editar=${other.value.id}`))
		).rejects.toMatchObject({ status: 404 });
		expect(await call(actions.gardar, ev(admin, { ...form, id: other.value.id }))).toMatchObject({
			status: 404
		});
		expect(await call(actions.borrar, ev(admin, { id: other.value.id }))).toMatchObject({
			status: 404
		});
	});
});
