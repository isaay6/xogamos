// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import { exportMyData } from '../../../../lib/server/services/exports';
import { requireMunicipality } from '../../municipality.server';
import type { RequestHandler } from './$types';

const lastDownload = new Map<string, number>();
const WAIT_MS = 30_000;

const escapeHtml = (value: unknown) =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

function readable(data: Awaited<ReturnType<typeof exportMyData>>) {
	const item = (label: string, value: unknown) =>
		`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
	const rows = (values: object[]) =>
		values.length === 0
			? '<p>Sen datos.</p>'
			: `<table><thead><tr>${Object.keys(values[0])
					.map((key) => `<th>${escapeHtml(key)}</th>`)
					.join('')}</tr></thead><tbody>${values
					.map(
						(value) =>
							`<tr>${Object.values(value)
								.map(
									(cell) =>
										`<td>${escapeHtml(cell instanceof Date ? cell.toISOString() : typeof cell === 'object' ? JSON.stringify(cell) : cell)}</td>`
								)
								.join('')}</tr>`
					)
					.join('')}</tbody></table>`;
	return `<!doctype html><html lang="gl"><head><meta charset="utf-8"><title>Os meus datos</title><style>body{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#17202A}dl{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1rem}dt{font-weight:700}dd{margin:0}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #6E7172;padding:.45rem;text-align:left;vertical-align:top}@media print{body{max-width:none}}</style></head><body><h1>Os meus datos</h1><p>Exportados o ${escapeHtml(data.exportedAt)}</p><h2>Identidade</h2><dl>${Object.entries(
		data.identity
	)
		.map(([key, value]) => item(key, value))
		.join('')}</dl><h2>Configuración</h2><dl>${Object.entries(data.settings)
		.map(([key, value]) => item(key, value))
		.join(
			''
		)}</dl><h2>Perfís</h2>${rows(data.profiles)}<h2>Reservas</h2>${rows(data.bookings)}<h2>Abonos</h2>${rows(data.passes)}<h2>Monedero</h2><dl>${item('balanceCents', data.wallet.balanceCents)}</dl>${rows(data.wallet.movements)}<h2>Avisos</h2>${rows(data.notices)}</body></html>`;
}

export const GET: RequestHandler = async (event) => {
	await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const previous = lastDownload.get(user.id);
	if (previous && event.locals.now().getTime() - previous < WAIT_MS)
		error(429, 'TOO_MANY_REQUESTS');
	lastDownload.set(user.id, event.locals.now().getTime());
	const data = await exportMyData(event.locals.db, user.id, event.locals.now());
	const json = event.url.searchParams.get('formato') === 'json';
	return new Response(json ? JSON.stringify(data, null, 2) : readable(data), {
		headers: {
			'content-type': json ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
			'content-disposition': `attachment; filename="os-meus-datos.${json ? 'json' : 'html'}"`
		}
	});
};
