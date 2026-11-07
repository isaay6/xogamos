// SPDX-License-Identifier: EUPL-1.2
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createTestDb } from '../../../lib/server/db/test-db';
import type { Db } from '../../../lib/server/db/client';
import { municipalityProfiles, staffRoles, users } from '../../../lib/server/db/schema';
import { seedFixture, type Fixture } from '../../../lib/server/services/fixtures';
import { getSettings, updateSettings } from '../../../lib/server/services/admin';
import { getLogo } from '../../../lib/server/services/logo';
import { listStaff } from '../../../lib/server/services/staff';
import { makeEvent } from '../../../lib/server/http/test-event';
import { contrastRatio } from '../../../lib/ui/format';
import { actions as normasActions, load as normasLoad } from './normas/+page.server';
import { actions as persoalActions, load as persoalLoad } from './persoal/+page.server';
import { actions as concelloActions, load as concelloLoad } from './concello/+page.server';
import NormasPage from './normas/+page.svelte';
import PersoalPage from './persoal/+page.svelte';
import ConcelloPage from './concello/+page.svelte';

type U = { id: string; displayName: string };
let db: Db;
let fx: Fixture;
let admin: U;
let conserxe: U;
let candidate: U;
let foreigner: U;

const mkUser = async (provider: 'clave' | 'local', subject: string, name: string): Promise<U> => {
	const [u] = await db.insert(users).values({ provider, subject, displayName: name }).returning();
	return { id: u.id, displayName: u.displayName };
};

const ev = (user: U | null, form?: Record<string, string | Blob>, path = 'admin/normas') => {
	const event = makeEvent({
		db,
		user,
		params: { slug: 'ribadavila' },
		url: `http://localhost/ribadavila/${path}`,
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

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const png = () => new File([PNG], 'escudo.png', { type: 'image/png' });

beforeAll(async () => {
	db = await createTestDb();
	fx = await seedFixture(db);
	admin = await mkUser('local', 'admin', 'Rebeca Dorrío');
	conserxe = await mkUser('local', 'cons', 'Xoán Conserxe');
	candidate = await mkUser('clave', 'cl-1', 'Nerea Sanmartín');
	foreigner = await mkUser('clave', 'cl-2', 'Nerea Forasteira');
	await db.insert(municipalityProfiles).values([
		{ municipalityId: fx.municipalityId, userId: candidate.id, isResident: false },
		{ municipalityId: fx.otherMunicipalityId, userId: foreigner.id, isResident: false }
	]);
	await db.insert(staffRoles).values([
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' },
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' }
	]);
});

const props = (data: Record<string, unknown>) => ({
	props: {
		data: {
			locale: 'gl',
			municipality: { slug: 'ribadavila', name: 'Ribadávila' },
			...data
		} as never,
		form: undefined as never,
		params: {} as never
	}
});

describe('admin: normas', () => {
	it('a páxina só é para admin', async () => {
		await expect(normasLoad(ev(conserxe))).rejects.toMatchObject({ status: 403 });
	});

	it('gardar «2 h» deixa 120 minutos e conserva o resto dos axustes', async () => {
		const before = await getSettings(db, fx.municipalityId);
		const res = await normasActions.default(
			ev(admin, { cancelHours: '2', maxDaysAhead: '14', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(res).toMatchObject({ saved: true });
		const after = await getSettings(db, fx.municipalityId);
		expect(after.cancellationDeadlineMinutes).toBe(120);
		expect(after.maxDaysAhead).toBe(14);
		expect(after.noShowThreshold).toBe(3);
		expect(after.penaltyDays).toBe(30);
		expect(after.name).toBe(before.name);
		expect(after.legalNotice).toBe(before.legalNotice);
	});

	it('maxDaysAhead = 0 dá 400 e non garda', async () => {
		const res = await normasActions.default(
			ev(admin, { cancelHours: '2', maxDaysAhead: '0', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(res).toMatchObject({ status: 400 });
		expect((await getSettings(db, fx.municipalityId)).maxDaysAhead).toBe(14);
		const bad = await normasActions.default(
			ev(admin, { cancelHours: '5', maxDaysAhead: '14', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(bad).toMatchObject({ status: 400 });
	});

	it('un plazo de 30 minutos fóra da lista sobrevive ao gardar outro campo', async () => {
		const before = await getSettings(db, fx.municipalityId);
		await updateSettings(db, fx.municipalityId, { ...before, cancellationDeadlineMinutes: 30 });
		const data = await normasLoad(ev(admin));
		const html = render(NormasPage, props(data as never) as never).body;
		expect(html).toMatch(/<option value="m30" selected[^>]*>30 minutos</);
		expect(html).not.toMatch(/<option value="\d+" selected/);

		// O formulario envía `m30`; cambiar só os días de antelación non toca o plazo.
		const res = await normasActions.default(
			ev(admin, { cancelHours: 'm30', maxDaysAhead: '21', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(res).toMatchObject({ saved: true });
		const after = await getSettings(db, fx.municipalityId);
		expect(after.cancellationDeadlineMinutes).toBe(30);
		expect(after.maxDaysAhead).toBe(21);

		// Non se pode usar `m…` para meter outro valor distinto do gardado.
		const forged = await normasActions.default(
			ev(admin, { cancelHours: 'm45', maxDaysAhead: '21', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(forged).toMatchObject({ status: 400 });
		expect((await getSettings(db, fx.municipalityId)).cancellationDeadlineMinutes).toBe(30);

		await updateSettings(db, fx.municipalityId, { ...before, cancellationDeadlineMinutes: 120 });
	});

	it('os rangos coinciden cos da API: antelación ata 90 e penalización desde 0', async () => {
		const ok = await normasActions.default(
			ev(admin, { cancelHours: '2', maxDaysAhead: '90', noShowThreshold: '3', penaltyDays: '0' })
		);
		expect(ok).toMatchObject({ saved: true });
		const html = render(NormasPage, props((await normasLoad(ev(admin))) as never) as never).body;
		expect(html).toMatch(/name="maxDaysAhead"[^>]*max="90"/);
		expect(html).toMatch(/name="penaltyDays"[^>]*min="0"/);
		const over = await normasActions.default(
			ev(admin, { cancelHours: '2', maxDaysAhead: '91', noShowThreshold: '3', penaltyDays: '30' })
		);
		expect(over).toMatchObject({ status: 400 });
		await normasActions.default(
			ev(admin, { cancelHours: '2', maxDaysAhead: '14', noShowThreshold: '3', penaltyDays: '30' })
		);
	});

	it('a páxina explica cada campo á veciñanza', async () => {
		const data = await normasLoad(ev(admin));
		const html = render(NormasPage, props(data as never) as never).body;
		expect(html).toContain('Normas de reserva');
		expect(html).toContain('name="cancelHours"');
		expect(html).toContain('<option value="2" selected');
		expect(html).toContain('name="maxDaysAhead"');
	});
});

describe('admin: persoal', () => {
	it('engadir un candidato como conserxe e quitalo', async () => {
		const found = (await persoalActions.buscar(
			ev(admin, { q: 'nerea' }, 'admin/persoal')
		)) as unknown as { busca: { q: string; candidates: { userId: string }[] } };
		// Ruling 14: solo quien tiene perfil en este concello; «Nerea Forasteira» no sale.
		expect(found.busca.candidates.map((c) => c.userId)).toEqual([candidate.id]);
		expect(found.busca.q).toBe('nerea');

		const res = await persoalActions.engadir(
			ev(admin, { userId: candidate.id, role: 'conserxe' }, 'admin/persoal')
		);
		expect(res).toMatchObject({ added: true });
		const staff = await listStaff(db, fx.municipalityId);
		const added = staff.find((s) => s.userId === candidate.id);
		expect(added?.role).toBe('conserxe');

		const html = render(PersoalPage, props({ staff }) as never).body;
		expect(html).toContain('Nerea Sanmartín');
		expect(html).toContain('Quitar');

		const rm = await persoalActions.quitar(ev(admin, { roleId: added!.roleId }, 'admin/persoal'));
		expect(rm).toMatchObject({ removed: true });
		expect((await listStaff(db, fx.municipalityId)).some((s) => s.userId === candidate.id)).toBe(
			false
		);
	});

	it('rol non válido dá 400; quitar o último admin dá 409 LAST_ADMIN', async () => {
		const bad = await persoalActions.engadir(
			ev(admin, { userId: candidate.id, role: 'deputacion' }, 'admin/persoal')
		);
		expect(bad).toMatchObject({ status: 400 });
		const roleId = (await listStaff(db, fx.municipalityId)).find((s) => s.role === 'admin')!.roleId;
		const res = await persoalActions.quitar(ev(admin, { roleId }, 'admin/persoal'));
		expect(res).toMatchObject({ status: 409, data: { error: 'LAST_ADMIN' } });
		const html = render(PersoalPage, {
			props: {
				data: props({ staff: [] }).props.data,
				form: { error: 'LAST_ADMIN' } as never,
				params: {} as never
			}
		}).body;
		expect(html).toContain('Non se pode quitar o último administrador');
	});
});

describe('admin: persoal (busca por POST, ids e perfil)', () => {
	it('a páxina non le q da URL: o load só devolve o persoal', async () => {
		const data = (await persoalLoad(ev(admin, undefined, 'admin/persoal?q=nerea'))) as never as {
			staff: unknown[];
			candidates?: unknown;
			q?: unknown;
		};
		expect(data.candidates).toBeUndefined();
		expect(data.q).toBeUndefined();
		const empty = (await persoalActions.buscar(
			ev(admin, { q: '  ' }, 'admin/persoal')
		)) as never as {
			busca: { candidates: unknown[] };
		};
		expect(empty.busca.candidates).toEqual([]);
	});

	it('quen só ten perfil noutro concello non se pode engadir (422)', async () => {
		const res = await persoalActions.engadir(
			ev(admin, { userId: foreigner.id, role: 'conserxe' }, 'admin/persoal')
		);
		expect(res).toMatchObject({ status: 422, data: { error: 'NO_PROFILE' } });
		expect((await listStaff(db, fx.municipalityId)).some((s) => s.userId === foreigner.id)).toBe(
			false
		);
		const html = render(PersoalPage, {
			props: {
				data: props({ staff: [] }).props.data,
				form: { error: 'NO_PROFILE' } as never,
				params: {} as never
			}
		}).body;
		expect(html).toContain('Esa persoa non ten perfil neste concello');
	});

	it('ids que non son UUID dan 400, nunca 500', async () => {
		expect(
			await persoalActions.engadir(
				ev(admin, { userId: 'non-uuid', role: 'conserxe' }, 'admin/persoal')
			)
		).toMatchObject({ status: 400 });
		expect(
			await persoalActions.quitar(ev(admin, { roleId: "x' or 1=1" }, 'admin/persoal'))
		).toMatchObject({ status: 400 });
		expect(await persoalActions.quitar(ev(admin, {}, 'admin/persoal'))).toMatchObject({
			status: 400
		});
	});
});

describe('admin: concello', () => {
	it('o escudo SVG dá 400 e o PNG pequeno gárdase', async () => {
		const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'e.svg', {
			type: 'image/svg+xml'
		});
		const bad = await concelloActions.escudo(ev(admin, { logo: svg }, 'admin/concello'));
		expect(bad).toMatchObject({ status: 400 });
		expect(await getLogo(db, fx.municipalityId)).toBeNull();
		const none = await concelloActions.escudo(ev(admin, {}, 'admin/concello'));
		expect(none).toMatchObject({ status: 400 });

		const ok = await concelloActions.escudo(ev(admin, { logo: png() }, 'admin/concello'));
		expect(ok).toMatchObject({ logoSaved: true });
		expect((await getLogo(db, fx.municipalityId))?.mime).toBe('image/png');
		const data = await concelloLoad(ev(admin));
		expect(data).toMatchObject({ hasLogo: true });
	});

	it('gardar nome, cor e textos legais; cor inválida dá 400', async () => {
		const form = {
			name: 'Concello de Ribadávila',
			primaryColor: '#1AA6C8',
			legalNotice: 'Aviso legal de exemplo',
			privacyPolicy: 'Privacidade de exemplo',
			usageRules: 'Normas de uso de exemplo'
		};
		const res = await concelloActions.gardar(ev(admin, form, 'admin/concello'));
		expect(res).toMatchObject({ saved: true });
		const s = await getSettings(db, fx.municipalityId);
		expect(s).toMatchObject({ ...form, maxDaysAhead: 14, cancellationDeadlineMinutes: 120 });

		const bad = await concelloActions.gardar(
			ev(admin, { ...form, primaryColor: 'azul' }, 'admin/concello')
		);
		expect(bad).toMatchObject({ status: 400 });
		const empty = await concelloActions.gardar(ev(admin, { ...form, name: ' ' }, 'admin/concello'));
		expect(empty).toMatchObject({ status: 400 });
		expect((await getSettings(db, fx.municipalityId)).name).toBe('Concello de Ribadávila');
	});

	it('o branco sobre #1AA6C8 non chega a 4.5:1 e a páxina avisa', async () => {
		expect(contrastRatio('#FFFFFF', '#1AA6C8')).toBeLessThan(4.5);
		expect(contrastRatio('#FFFFFF', '#17202A')).toBeGreaterThan(4.5);
		expect(contrastRatio('#fff', 'nope')).toBeNull();
		const data = await concelloLoad(ev(admin));
		const html = render(ConcelloPage, props(data as never) as never).body;
		expect(html).toContain('name="primaryColor"');
		expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
		expect(html).toContain('action="?/escudo"');
		expect(html).toContain('Aviso legal de exemplo');
		expect(html).toContain('role="alert"');
		const dark = render(
			ConcelloPage,
			props({
				...(data as object),
				settings: { ...(data as { settings: object }).settings, primaryColor: '#17202A' }
			}) as never
		).body;
		expect(dark).not.toContain('class="aviso-cor"');
	});
});
