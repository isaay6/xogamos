// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../lib/server/http/guards';
import { fail } from '../../../../../../../lib/server/http/respond';
import { MAX_LOGO_BYTES, setLogo } from '../../../../../../../lib/server/services/logo';

const tooBig = (message: string) => fail('VALIDATION_FAILED', { issues: [{ path: '', message }] });

export const PUT: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const header = event.request.headers.get('content-length');
	if (header !== null && !/^\d+$/.test(header)) return tooBig('Invalid Content-Length');
	if (header !== null && Number(header) > MAX_LOGO_BYTES) return tooBig('Image too large');
	// Se lee en flujo y se corta en cuanto se supera el límite (sin Content-Length también).
	const chunks: Uint8Array[] = [];
	let total = 0;
	const reader = event.request.body?.getReader();
	while (reader) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > MAX_LOGO_BYTES) {
			await reader.cancel();
			return tooBig('Image too large');
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let at = 0;
	for (const c of chunks) {
		bytes.set(c, at);
		at += c.length;
	}
	const result = await setLogo(event.locals.db, municipality.id, bytes);
	if (!result.ok) {
		return fail(result.error, {
			issues: [{ path: '', message: 'Body must be a PNG, JPEG or WebP of at most 262144 bytes' }]
		});
	}
	return new Response(null, { status: 204 });
};
