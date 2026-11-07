// SPDX-License-Identifier: EUPL-1.2
import { redirect } from '@sveltejs/kit';
import { requirePageUser } from '../../../../lib/server/http/page-guards';
import {
	avatarTab,
	readProfileUser,
	removeAvatarPhoto,
	saveAvatarKey,
	saveAvatarPhoto
} from '../../../../lib/server/http/profile-forms';
import { requireMunicipality } from '../../municipality.server';
import { eq } from 'drizzle-orm';
import { users } from '../../../../lib/server/db/schema';
import { dev } from '$app/env';
import type { Actions, PageServerLoad } from './$types';

// O meu perfil: o avatar (debuxo do catálogo, inicial ou foto propia).

export const load: PageServerLoad = async (event) => {
	await requireMunicipality(event.locals.db, event.params.slug);
	const user = requirePageUser(event);
	const me = await readProfileUser(event.locals.db, user.id);
	return {
		userId: user.id,
		name: user.displayName,
		avatar: me.avatar,
		accessibility: {
			textSize: me.textSize,
			highContrast: me.highContrast,
			reduceMotion: me.reduceMotion,
			easyBooking: me.easyBooking
		},
		tab: avatarTab(event.url.searchParams.get('tab')),
		saved: event.url.searchParams.get('gardado') === '1'
	};
};

const back = (slug: string, tab: string) => `/${slug}/eu/perfil?tab=${tab}&gardado=1`;

export const actions: Actions = {
	avatar: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const failed = await saveAvatarKey(event.locals.db, user.id, form);
		if (failed) return failed;
		const tab = String(form.get('avatar') ?? '').startsWith('deporte-') ? 'deportes' : 'persoas';
		redirect(303, back(municipality.slug, tab));
	},
	foto: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const failed = await saveAvatarPhoto(event.locals.db, user.id, await event.request.formData());
		if (failed) return failed;
		redirect(303, back(municipality.slug, 'foto'));
	},
	quitarFoto: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		await removeAvatarPhoto(event.locals.db, user.id);
		redirect(303, back(municipality.slug, 'foto'));
	},
	accesibilidade: async (event) => {
		const municipality = await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const textSize = String(form.get('textSize') ?? 'normal');
		const reduceMotion = String(form.get('reduceMotion') ?? 'system');
		if (
			!['normal', 'large', 'very_large'].includes(textSize) ||
			!['system', 'always', 'never'].includes(reduceMotion)
		)
			return { accessibilityError: true as const };
		const highContrast = form.get('highContrast') === 'on';
		const easyBooking = form.get('easyBooking') === 'on';
		await event.locals.db
			.update(users)
			.set({ textSize, highContrast, reduceMotion, easyBooking })
			.where(eq(users.id, user.id));
		event.cookies.set(
			'quenda_accessibility',
			`${textSize}|${highContrast ? 'alto' : 'normal'}|${reduceMotion}`,
			{ path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', httpOnly: true, secure: !dev }
		);
		redirect(303, back(municipality.slug, 'accesibilidade'));
	}
};
