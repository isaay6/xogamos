// SPDX-License-Identifier: EUPL-1.2
// Avisos do concello: la administradora los redacta y los publica entre dos fechas (bases, 1.1).
// Salen en la pestaña «Avisos» de la vecindad mientras están vigentes.
import { error, fail } from '@sveltejs/kit';
import { addLocalDays, localDateOf, localDateTimeToUtc } from '../../../../lib/server/domain/time';
import {
	createMunicipalityNotice,
	deleteMunicipalityNotice,
	listMunicipalityNoticesAdmin,
	NOTICE_BODY_MAX,
	NOTICE_TITLE_MAX,
	updateMunicipalityNotice,
	type MunicipalityNoticeRow
} from '../../../../lib/server/services/notifications';
import { requireAdminPage } from '../guard';
import { field } from '../form';
import { echo, isUuid } from '../instalacions/form';
import { writeActivity } from '../../../../lib/server/services/activity-log';
import type { Actions, PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type NoticeState = 'proximo' | 'activo' | 'caducado';

function noticeState(n: { startsAt: Date; endsAt: Date | null }, now: Date): NoticeState {
	if (n.startsAt > now) return 'proximo';
	if (n.endsAt && n.endsAt <= now) return 'caducado';
	return 'activo';
}

/** Fila → datos de la página: fechas locales, `to` inclusive (o null si no caduca). */
const view = (n: MunicipalityNoticeRow, now: Date) => ({
	id: n.id,
	title: n.title,
	body: n.body,
	from: localDateOf(n.startsAt),
	to: n.endsAt ? localDateOf(new Date(n.endsAt.getTime() - 1)) : null,
	state: noticeState(n, now)
});

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const now = event.locals.now();
	const rows = await listMunicipalityNoticesAdmin(event.locals.db, municipality.id);
	const notices = rows.map((n) => view(n, now));
	const editId = event.url.searchParams.get('editar');
	const editing = editId ? (notices.find((n) => n.id === editId) ?? null) : null;
	if (editId && !editing) error(404);
	return {
		today: localDateOf(now),
		titleMax: NOTICE_TITLE_MAX,
		bodyMax: NOTICE_BODY_MAX,
		notices,
		editing
	};
};

export const actions: Actions = {
	/** Publicar un aviso nuevo o, con `id`, guardar los cambios de uno del concello. */
	gardar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const db = event.locals.db;
		const now = event.locals.now();
		const form = await event.request.formData();
		const values = echo(form);
		const id = field(form, 'id');
		if (id && !isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const from = field(form, 'from');
		const to = field(form, 'to');
		if (!DATE.test(from) || (to !== '' && (!DATE.test(to) || to < from))) {
			return fail(400, { error: 'INVALID' as const, values });
		}
		const current = id
			? (await listMunicipalityNoticesAdmin(db, municipality.id)).find((n) => n.id === id)
			: undefined;
		if (id && !current) return fail(404, { error: 'NOT_FOUND' as const });
		// Hoy: desde ahora (así sale «Hoxe · 10:15» y arriba de la lista); otro día: desde las 00:00.
		// Al editar, si el día no cambia se conserva la hora de publicación.
		const startsAt =
			current && localDateOf(current.startsAt) === from
				? current.startsAt
				: from === localDateOf(now)
					? now
					: localDateTimeToUtc(from, '00:00');
		const input = {
			title: field(form, 'title'),
			body: field(form, 'body'),
			startsAt,
			endsAt: to ? localDateTimeToUtc(addLocalDays(to, 1), '00:00') : null
		};
		const res = id
			? await updateMunicipalityNotice(db, municipality.id, id, input)
			: await createMunicipalityNotice(db, municipality.id, input, user.id);
		if (!res.ok) {
			return res.error === 'NOT_FOUND'
				? fail(404, { error: 'NOT_FOUND' as const })
				: fail(400, { error: 'INVALID' as const, values });
		}
		await writeActivity(db, {
			municipalityId: municipality.id,
			actorId: user.id,
			kind: 'notice_saved',
			params: { detalle: input.title }
		});
		return id ? { saved: true as const } : { published: true as const };
	},

	borrar: async (event) => {
		const { municipality, user } = await requireAdminPage(event);
		const form = await event.request.formData();
		const id = field(form, 'id');
		if (!isUuid(id)) return fail(404, { error: 'NOT_FOUND' as const });
		const res = await deleteMunicipalityNotice(event.locals.db, municipality.id, id);
		if (!res.ok) return fail(404, { error: 'NOT_FOUND' as const });
		await writeActivity(event.locals.db, {
			municipalityId: municipality.id,
			actorId: user.id,
			kind: 'notice_deleted',
			params: { detalle: id }
		});
		return { deleted: true as const };
	}
};
