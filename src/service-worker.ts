// SPDX-License-Identifier: EUPL-1.2
// Caché nativa de SvelteKit: la aplicación y solo las reservas personales quedan sin red.
import { self } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { shouldCache } from './lib/pwa/cache';

const SHELL_CACHE = `reservas-shell-${version}`;
const PERSONAL_CACHE = `reservas-persoais-${version}`;
const OFFLINE_URL = '/offline';
// En SvelteKit 3 o manifesto dá obxectos `{ path }`, non cadeas: sen `.path` pedíase «/[object Object]».
const shell = [...immutable, ...assets, ...prerendered].map((f) => f.path).concat(OFFLINE_URL);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(shell)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(key) => key.startsWith('reservas-') && key !== SHELL_CACHE && key !== PERSONAL_CACHE
						)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type !== 'clear-personal-pages') return;
	event.waitUntil(caches.delete(PERSONAL_CACHE));
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(networkFirstNavigation(request));
		return;
	}

	event.respondWith(cacheFirstAsset(request));
});

async function networkFirstNavigation(request: Request): Promise<Response> {
	try {
		const response = await fetch(request);
		if (response.ok && shouldCache(new URL(request.url), request.method)) {
			const cache = await caches.open(PERSONAL_CACHE);
			await cache.put(request, response.clone());
		}
		return response;
	} catch {
		const personal = await caches.open(PERSONAL_CACHE);
		const saved = await personal.match(request);
		if (saved) return saved;
		const shellCache = await caches.open(SHELL_CACHE);
		return (await shellCache.match(OFFLINE_URL)) ?? Response.error();
	}
}

async function cacheFirstAsset(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	return cached ?? fetch(request);
}
