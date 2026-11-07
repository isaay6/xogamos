// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, invalidateSession } from '../../../lib/server/services/sessions';

/** Solo rutas del propio sitio: empieza por '/', no por '//' ni '/\\', sin barras invertidas ni control. */
function safeTo(value: unknown): string {
	if (typeof value !== 'string') return '/';
	if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
	// eslint-disable-next-line no-control-regex
	if (/[\\\u0000-\u001f\u007f]/.test(value)) return '/';
	return value;
}

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
	if (locals.sessionId) await invalidateSession(locals.db, locals.sessionId);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	const type = request.headers.get('content-type') ?? '';
	if (/^(application\/x-www-form-urlencoded|multipart\/form-data)/i.test(type)) {
		const form = await request.formData().catch(() => null);
		return new Response(null, { status: 303, headers: { location: safeTo(form?.get('to')) } });
	}
	return new Response(null, { status: 204 });
};
