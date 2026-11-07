// SPDX-License-Identifier: EUPL-1.2
// Entrada del personal desde la vecindad (Eu y cabecera) y vuelta desde su zona.
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../../lib/server/auth/types';
import type { Db } from '../../lib/server/db/client';
import { staffRoles, users } from '../../lib/server/db/schema';
import { createTestDb } from '../../lib/server/db/test-db';
import { makeEvent } from '../../lib/server/http/test-event';
import { seedFixture } from '../../lib/server/services/fixtures';
import AppHeader from '../../lib/ui/AppHeader.svelte';
import StaffShell from '../../lib/ui/StaffShell.svelte';
import { load as loadLayout } from './+layout.server';
import { load as loadEu } from './eu/+page.server';
import EuPage from './eu/+page.svelte';

const call = <T>(fn: unknown, event: unknown) => (fn as (e: never) => T)(event as never);

let db: Db;
let vecina: SessionUser;
let conserxe: SessionUser;
let admin: SessionUser;

beforeAll(async () => {
	db = await createTestDb();
	const fx = await seedFixture(db);
	vecina = { id: fx.userId, displayName: 'Nerea Veciña' };
	const mk = async (subject: string, name: string): Promise<SessionUser> => {
		const [u] = await db
			.insert(users)
			.values({ provider: 'local', subject, displayName: name })
			.returning();
		return { id: u.id, displayName: u.displayName };
	};
	conserxe = await mk('sl-cons', 'Telmo Novo');
	admin = await mk('sl-admin', 'Rebeca Dorrío');
	await db.insert(staffRoles).values([
		{ userId: conserxe.id, municipalityId: fx.municipalityId, role: 'conserxe' },
		{ userId: admin.id, municipalityId: fx.municipalityId, role: 'admin' }
	]);
});

async function euHtml(user: SessionUser) {
	const event = () =>
		makeEvent({
			db,
			user,
			params: { slug: 'ribadavila' },
			url: 'http://localhost/ribadavila/eu'
		});
	const layout = await call<Promise<Record<string, unknown>>>(loadLayout, event());
	const data = await call<Promise<object>>(loadEu, event());
	return render(EuPage as never, { props: { data: { ...layout, ...data } } as never }).body;
}

describe('acceso do persoal desde Eu', () => {
	it('unha veciña non ve ningunha ligazón de persoal', async () => {
		const out = await euHtml(vecina);
		expect(out).not.toContain('/ribadavila/conserxeria');
		expect(out).not.toContain('/ribadavila/admin');
	});

	it('o conserxe ve Conserxería pero non Administración', async () => {
		const out = await euHtml(conserxe);
		expect(out).toContain('href="/ribadavila/conserxeria"');
		expect(out).toContain('Conserxería');
		expect(out).not.toContain('/ribadavila/admin');
	});

	it('o admin ve Administración (e tamén Conserxería)', async () => {
		const out = await euHtml(admin);
		expect(out).toContain('href="/ribadavila/admin"');
		expect(out).toContain('Administración');
		expect(out).toContain('href="/ribadavila/conserxeria"');
	});
});

describe('cabeceira', () => {
	const props = (roles: ('admin' | 'conserxe')[]) => ({
		municipality: {
			slug: 'ribadavila',
			name: 'Ribadávila',
			primaryColor: '#0a5',
			hasLogo: false,
			logoVersion: 0
		},
		user: { id: 'u-1', initial: 'B', displayName: 'Telmo' },
		locale: 'gl' as const,
		current: '/ribadavila',
		roles
	});

	it('mostra a ligazón só co rol, a do admin ao admin', () => {
		expect(render(AppHeader, { props: props([]) }).body).not.toContain('class="persoal"');
		const cons = render(AppHeader, { props: props(['conserxe']) }).body;
		expect(cons).toContain('href="/ribadavila/conserxeria"');
		const adm = render(AppHeader, { props: props(['admin', 'conserxe']) }).body;
		expect(adm).toContain('href="/ribadavila/admin"');
		expect(adm).not.toContain('href="/ribadavila/conserxeria"');
	});
});

describe('StaffShell: volta á veciñanza', () => {
	it('ten «Ver como veciño»', () => {
		const { body } = render(StaffShell, {
			props: {
				menu: [{ href: '/ribadavila/conserxeria', label: 'Axenda', icon: 'agenda' }],
				current: '/ribadavila/conserxeria',
				userName: 'Telmo',
				municipality: { slug: 'ribadavila', name: 'Ribadávila', hasLogo: false, logoVersion: 0 },
				locale: 'gl',
				children: createRawSnippet(() => ({ render: () => '<p>x</p>' }))
			}
		});
		expect(body).toMatch(/<a[^>]*href="\/ribadavila"[^>]*>Ver como veciño/);
	});
});
