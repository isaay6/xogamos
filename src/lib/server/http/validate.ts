// SPDX-License-Identifier: EUPL-1.2
import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';

export type Issue = { path: string; message: string };

export type Parsed<T> =
	{ ok: true; value: T } | { ok: false; error: 'VALIDATION_FAILED'; issues: Issue[] };

function toIssues(error: z.ZodError): Issue[] {
	return error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
}

function parseWith<T>(schema: z.ZodType<T>, data: unknown): Parsed<T> {
	const r = schema.safeParse(data);
	return r.success
		? { ok: true, value: r.data }
		: { ok: false, error: 'VALIDATION_FAILED', issues: toIssues(r.error) };
}

export async function parseBody<T>(
	event: Pick<RequestEvent, 'request'>,
	schema: z.ZodType<T>
): Promise<Parsed<T>> {
	let data: unknown;
	try {
		const text = await event.request.text();
		data = JSON.parse(text);
	} catch {
		return {
			ok: false,
			error: 'VALIDATION_FAILED',
			issues: [{ path: '', message: 'Body must be valid JSON' }]
		};
	}
	return parseWith(schema, data);
}

export function parseQuery<T>(url: URL, schema: z.ZodType<T>): Parsed<T> {
	return parseWith(schema, Object.fromEntries(url.searchParams));
}

export function parseParams<T>(
	params: Record<string, string | undefined>,
	schema: z.ZodType<T>
): Parsed<T> {
	return parseWith(schema, params);
}
