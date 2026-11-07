// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { fail } from '../../../../../lib/server/http/respond';
import { avatarSvg } from '../../../../../lib/server/services/avatar-svg';

// Debuxo público e estático (non é un dato persoal): a clave só elixe un do catálogo.
export const GET: RequestHandler = ({ params }) => {
	const svg = avatarSvg(params.key ?? '');
	if (!svg) return fail('NOT_FOUND');
	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml',
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
			'cache-control': 'public, max-age=86400'
		}
	});
};
