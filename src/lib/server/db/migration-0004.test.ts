// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { LEGACY_MASCOT } from '../../mascots';

const statements = (name: string) =>
	readFileSync(`drizzle/${name}.sql`, 'utf8')
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter(Boolean);

describe('migración 0004', () => {
	it('convierte las claves antiguas de mascot con LEGACY_MASCOT y conserva el resto', async () => {
		const pg = new PGlite();
		for (const f of [
			'0000_lying_spyke',
			'0001_integrity_constraints',
			'0002_tenant_types_and_checks',
			'0003_sessions_and_staff'
		]) {
			for (const s of statements(f)) await pg.exec(s);
		}
		await pg.exec(
			`insert into municipalities (id, slug, name, province, primary_color)
			 values ('00000000-0000-0000-0000-000000000001', 'x', 'X', 'Lugo', '#000000')`
		);
		for (const [i, old] of Object.keys(LEGACY_MASCOT).entries()) {
			await pg.exec(
				`insert into facility_types (municipality_id, name_gl, name_es, mascot, color, booking_mode)
				 values ('00000000-0000-0000-0000-000000000001', 'T${i}', 'T${i}', '${old}', '#000000', 'slot')`
			);
		}
		for (const s of statements('0004_ui_support')) await pg.exec(s);
		const { rows } = await pg.query<{ name_gl: string; mascot: string }>(
			'select name_gl, mascot::text as mascot from facility_types order by name_gl'
		);
		expect(rows.map((r) => r.mascot)).toEqual(Object.values(LEGACY_MASCOT));
		// El default nuevo es 'sala'.
		await pg.exec(
			`insert into facility_types (municipality_id, name_gl, name_es, color, booking_mode)
			 values ('00000000-0000-0000-0000-000000000001', 'D', 'D', '#000000', 'slot')`
		);
		const d = await pg.query<{ mascot: string }>(
			`select mascot::text as mascot from facility_types where name_gl = 'D'`
		);
		expect(d.rows[0].mascot).toBe('sala');
		await expect(
			pg.exec(`update municipalities set logo_mime = 'image/svg+xml'`)
		).rejects.toThrow();
	});
});
