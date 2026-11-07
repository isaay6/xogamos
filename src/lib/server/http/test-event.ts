// SPDX-License-Identifier: EUPL-1.2
// Ayuda para pruebas: construye un RequestEvent sin servidor.
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { SessionUser } from '../auth/types';
import type { Db } from '../db/client';
import type { Locale } from '../../i18n';

export type SetCookie = { name: string; value: string; opts: Record<string, unknown> };
export type MemoryCookies = Cookies & { sets: SetCookie[] };

function memoryCookies(initial: Record<string, string>): MemoryCookies {
	const jar = new Map(Object.entries(initial));
	const sets: SetCookie[] = [];
	return {
		sets,
		get: (name) => jar.get(name),
		getAll: () => [...jar].map(([name, value]) => ({ name, value })),
		set: (name, value, opts) => {
			jar.set(name, value);
			sets.push({ name, value, opts: { ...opts } });
		},
		delete: (name, opts) => {
			jar.delete(name);
			sets.push({ name, value: '', opts: { ...opts, maxAge: 0 } });
		},
		serialize: (name, value) => `${name}=${value}`,
		parse: ((str: string) => {
			const [name, ...rest] = str.split(';')[0].split('=');
			return { name, value: rest.join('=') };
		}) as Cookies['parse']
	};
}

export type MakeEventOptions = {
	db: Db;
	now?: Date;
	user?: SessionUser | null;
	params?: Record<string, string>;
	url?: string;
	method?: string;
	body?: unknown;
	rawBody?: string;
	/** Cuerpo binario crudo (p. ej. un escudo). */
	bytes?: Uint8Array;
	contentType?: string;
	cookies?: Record<string, string>;
	locale?: Locale;
};

export function makeEvent(opts: MakeEventOptions): RequestEvent & { cookies: MemoryCookies } {
	const method = opts.method ?? 'GET';
	const url = new URL(opts.url ?? 'http://localhost/');
	const raw =
		opts.rawBody !== undefined
			? opts.rawBody
			: opts.body !== undefined
				? JSON.stringify(opts.body)
				: undefined;
	const noBody = method === 'GET' || method === 'HEAD';
	const request = new Request(url, {
		method,
		headers: opts.bytes
			? { 'content-type': opts.contentType ?? 'application/octet-stream' }
			: raw !== undefined
				? { 'content-type': 'application/json' }
				: {},
		body: noBody ? undefined : ((opts.bytes as BodyInit | undefined) ?? raw)
	});
	const now = opts.now ?? new Date();
	const cookies = memoryCookies(opts.cookies ?? {});
	return {
		request,
		url,
		params: opts.params ?? {},
		cookies,
		locals: {
			db: opts.db,
			now: () => now,
			user: opts.user ?? null,
			sessionId: null,
			locale: opts.locale ?? 'gl'
		},
		route: { id: null },
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {},
		tracing: undefined
	} as unknown as RequestEvent & { cookies: MemoryCookies };
}
