// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail } from '../../../../../../lib/server/http/respond';
import { Uuid } from '../../../../../../lib/server/http/schemas';
import {
	clearAvatarPhoto,
	getAvatarPhoto,
	setAvatarPhoto
} from '../../../../../../lib/server/services/avatar';
import { MAX_LOGO_BYTES } from '../../../../../../lib/server/services/logo';

const bad = (message: string) => fail('VALIDATION_FAILED', { issues: [{ path: '', message }] });

/** Solo la propia persona cambia su foto; el id de otra es un 404 (no revela que existe). */
function ownId(user: { id: string } | null, raw: string | undefined): string | null {
	const id = Uuid.safeParse(raw);
	return user && id.success && id.data === user.id ? user.id : null;
}

// Todo lo que no se pueda ver (sin sesión, id ajeno, inexistente o mal formado) es el mismo
// 404, para no revelar si la persona existe.
export const GET: RequestHandler = async ({ locals, params }) => {
	const id = Uuid.safeParse(params.id);
	if (!id.success || !locals.user) return fail('NOT_FOUND');
	const photo = await getAvatarPhoto(locals.db, locals.user.id, id.data);
	if (!photo) return fail('NOT_FOUND');
	return new Response(photo.bytes as BodyInit, {
		headers: {
			'content-type': photo.mime,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, no-cache'
		}
	});
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const id = ownId(locals.user, params.id);
	if (!id) return locals.user ? fail('NOT_FOUND') : fail('UNAUTHENTICATED');
	const header = request.headers.get('content-length');
	if (header !== null && !/^\d+$/.test(header)) return bad('Invalid Content-Length');
	if (header !== null && Number(header) > MAX_LOGO_BYTES) return bad('Image too large');
	// En flujo, cortando al pasar el límite (también sin Content-Length), como el escudo.
	const chunks: Uint8Array[] = [];
	let total = 0;
	const reader = request.body?.getReader();
	while (reader) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > MAX_LOGO_BYTES) {
			await reader.cancel();
			return bad('Image too large');
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let at = 0;
	for (const c of chunks) {
		bytes.set(c, at);
		at += c.length;
	}
	const result = await setAvatarPhoto(locals.db, id, bytes, total);
	if (!result.ok) return bad('Body must be a PNG, JPEG or WebP of at most 262144 bytes');
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const id = ownId(locals.user, params.id);
	if (!id) return locals.user ? fail('NOT_FOUND') : fail('UNAUTHENTICATED');
	await clearAvatarPhoto(locals.db, id);
	return new Response(null, { status: 204 });
};
