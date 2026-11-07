// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { staffRoles, users } from '../../lib/server/db/schema';
import { countUnread } from '../../lib/server/services/notifications';
import { hasDeputacionRole } from '../../lib/server/services/deputacion';
import { getMunicipalityShell } from '../../lib/server/services/municipalities';
import { listFollowed } from '../../lib/server/services/profiles';
import type { LayoutServerLoad } from './$types';

const YEAR = 365 * 24 * 60 * 60;

export const load: LayoutServerLoad = async ({ params, locals, cookies, url }) => {
	const municipality = await getMunicipalityShell(locals.db, params.slug);
	if (!municipality) error(404);

	// La raíz `/` recuerda el último concello visitado.
	cookies.set('concello', municipality.slug, {
		path: '/',
		maxAge: YEAR,
		sameSite: 'lax',
		httpOnly: true,
		secure: url.protocol === 'https:'
	});

	const user = locals.user;
	let roles: ('admin' | 'conserxe' | 'apertura')[] = [];
	let isDeputacion = false;
	let unread = 0;
	let avatar = { key: null as string | null, hasPhoto: false };
	let followed: Awaited<ReturnType<typeof listFollowed>> = [];
	if (user) {
		const [row] = await locals.db
			.select({ key: users.avatarKey, mime: users.avatarMime })
			.from(users)
			.where(eq(users.id, user.id));
		avatar = { key: row?.key ?? null, hasPhoto: row?.mime != null };
		const [held, count, choices] = await Promise.all([
			locals.db
				.select({ role: staffRoles.role })
				.from(staffRoles)
				.where(and(eq(staffRoles.userId, user.id), eq(staffRoles.municipalityId, municipality.id))),
			countUnread(locals.db, user.id),
			listFollowed(locals.db, user.id)
		]);
		followed = choices;
		unread = count;
		roles = [...new Set(held.map((r) => r.role))].filter(
			(r): r is 'admin' | 'conserxe' | 'apertura' =>
				r === 'admin' || r === 'conserxe' || r === 'apertura'
		);
		// Aparte de `roles`: la deputación no es personal del concello (solo enlaza su panel).
		isDeputacion = await hasDeputacionRole(locals.db, user.id);
	}

	return {
		municipality: {
			slug: municipality.slug,
			name: municipality.name,
			primaryColor: municipality.primaryColor,
			hasLogo: municipality.hasLogo,
			logoVersion: municipality.logoVersion
		},
		user: user
			? {
					id: user.id,
					initial: Array.from(user.displayName.trim())[0]?.toUpperCase() ?? '?',
					displayName: user.displayName,
					avatar
				}
			: null,
		roles,
		followed,
		isDeputacion,
		unread,
		locale: locals.locale
	};
};
