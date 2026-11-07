// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(
		JSON.stringify({
			name: 'Reservas deportivas',
			short_name: 'Reservas',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			theme_color: '#17202a',
			background_color: '#eef2f1',
			icons: [
				{ src: '/icons/reservas-192.svg', sizes: '192x192', type: 'image/svg+xml' },
				{ src: '/icons/reservas-512.svg', sizes: '512x512', type: 'image/svg+xml' },
				{
					src: '/icons/reservas-maskable.svg',
					sizes: '512x512',
					type: 'image/svg+xml',
					purpose: 'maskable'
				}
			]
		}),
		{ headers: { 'content-type': 'application/manifest+json; charset=utf-8' } }
	);
