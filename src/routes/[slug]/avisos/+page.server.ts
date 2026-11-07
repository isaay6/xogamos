// SPDX-License-Identifier: EUPL-1.2
// Avisos (tarea 5): «Do concello» (los de los concellos seguidos y el actual) y «Para ti» (los
// personales de la persona con sesión). Sin sesión solo se ven los del concello.
import { error } from '@sveltejs/kit';
import { localDateOf } from '../../../lib/server/domain/time';
import { requirePageUser } from '../../../lib/server/http/page-guards';
import {
	countUnread,
	listNotifications,
	markAllRead,
	markRead
} from '../../../lib/server/services/notifications';
import { requireMunicipality } from '../municipality.server';
import { visibleNotices } from '../notices.server';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	const now = locals.now();
	const user = locals.user;

	const all = await visibleNotices(locals.db, municipality.id, user?.id ?? null, now);
	// Os do concello actual primeiro; a páxina fai un bando por concello co seu escudo e nome.
	const current = (n: (typeof all)[number]) => Number(n.municipalityId === municipality.id);
	const notices = [...all]
		.sort((a, b) => current(b) - current(a))
		.map((n) => ({
			id: n.id,
			municipalityName: n.municipalityName,
			municipality: {
				slug: n.municipalitySlug,
				name: n.municipalityName,
				primaryColor: n.municipalityColor,
				hasLogo: n.municipalityHasLogo,
				logoVersion: n.municipalityLogoVersion
			},
			title: n.title,
			body: n.body,
			startsAt: n.startsAt,
			endsAt: n.endsAt
		}));

	if (!user) return { needsLogin: true, notices, personal: [], unread: 0, today: localDateOf(now) };

	const mine = await listNotifications(locals.db, user.id);
	const personal = mine.map((n) => ({
		id: n.id,
		kind: n.kind,
		params: n.params,
		bookingId: n.bookingId,
		// La reserva cuelga del concello del aviso; si no lo trae, del actual.
		href: n.bookingId ? `/${n.municipalitySlug ?? municipality.slug}/reserva/${n.bookingId}` : null,
		createdAt: n.createdAt,
		unread: n.readAt === null
	}));
	return {
		needsLogin: false,
		notices,
		personal,
		unread: await countUnread(locals.db, user.id),
		today: localDateOf(now)
	};
};

export const actions: Actions = {
	// Un aviso ajeno (o que no existe) es 404, igual que en el resto de recursos propios.
	ler: async (event) => {
		await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		const form = await event.request.formData();
		const id = form.get('id');
		if (typeof id !== 'string' || !UUID.test(id)) error(404);
		if (!(await markRead(event.locals.db, user.id, id))) error(404);
		return { ok: true };
	},
	lertodo: async (event) => {
		await requireMunicipality(event.locals.db, event.params.slug);
		const user = requirePageUser(event);
		await markAllRead(event.locals.db, user.id);
		return { ok: true };
	}
};
