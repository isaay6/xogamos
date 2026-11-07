// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { IsoInstant, LocalDate, Slug, Uuid } from './schemas';
import { parseBody, parseQuery } from './validate';
import { makeEvent } from './test-event';
import type { Db } from '../db/client';

const db = {} as Db; // parseBody no toca la base de datos

describe('LocalDate', () => {
	it('acepta una fecha real', () => {
		expect(LocalDate.safeParse('2026-11-24').success).toBe(true);
	});
	it.each(['2026-02-30', '2026-13-01', '24/11/2026', '2026-1-1', ''])('rechaza %s', (v) => {
		expect(LocalDate.safeParse(v).success).toBe(false);
	});
});

describe('IsoInstant', () => {
	it('acepta desfase y Z y devuelve Date', () => {
		const a = IsoInstant.parse('2026-11-24T18:00:00+01:00');
		const b = IsoInstant.parse('2026-11-24T17:00:00Z');
		expect(a).toBeInstanceOf(Date);
		expect(a.getTime()).toBe(b.getTime());
	});
	it.each(['2026-11-24T18:00:00', '2026-11-24', 'ayer', '2026-02-30T10:00:00Z'])(
		'rechaza %s',
		(v) => {
			expect(IsoInstant.safeParse(v).success).toBe(false);
		}
	);
});

describe('Uuid y Slug', () => {
	it('validan formato', () => {
		expect(Uuid.safeParse('nope').success).toBe(false);
		expect(Slug.safeParse('montemaior-do-rio').success).toBe(true);
		expect(Slug.safeParse('Mal_Slug').success).toBe(false);
		expect(Slug.safeParse('-a').success).toBe(false);
	});
});

describe('parseBody / parseQuery', () => {
	const schema = z.object({ n: z.number() });
	it('devuelve el valor válido', async () => {
		const r = await parseBody(makeEvent({ db, method: 'POST', body: { n: 1 } }), schema);
		expect(r).toEqual({ ok: true, value: { n: 1 } });
	});
	it.each([
		['JSON roto', { rawBody: '{nope' }],
		['cuerpo vacío', { rawBody: '' }],
		['tipo erróneo', { body: { n: 'x' } }]
	])('%s da VALIDATION_FAILED', async (_n, opts) => {
		const r = await parseBody(makeEvent({ db, method: 'POST', ...opts }), schema);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error).toBe('VALIDATION_FAILED');
			expect(r.issues?.length).toBeGreaterThan(0);
		}
	});
	it('parseQuery valida parámetros de consulta', () => {
		const q = z.object({ date: LocalDate });
		expect(parseQuery(new URL('http://x/?date=2026-11-24'), q).ok).toBe(true);
		const bad = parseQuery(new URL('http://x/?date=2026-02-30'), q);
		expect(bad.ok).toBe(false);
	});
});
