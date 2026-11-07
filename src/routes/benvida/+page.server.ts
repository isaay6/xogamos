// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { safeRedirect } from '../../lib/server/auth/safe-redirect';
import {
	avatarTab,
	checkResidency,
	declareChosenResidency,
	municipalityChoices,
	readProfileUser,
	removeAvatarPhoto,
	saveAvatarKey,
	saveAvatarPhoto,
	saveFollowed,
	saveNoticePrefs,
	slugOfPath
} from '../../lib/server/http/profile-forms';
import { completeOnboarding, listFollowed } from '../../lib/server/services/profiles';
import type { Actions, PageServerLoad } from './$types';

// Benvida en tres pasos (`?paso=1|2|3`), só a primeira vez: concellos, avatar e avisos.
// Funciona sen JS: cada paso é un formulario que garda e redirixe ao seguinte.

type Event = Pick<RequestEvent, 'locals'>;

/** Sen sesión non hai benvida: á raíz, que leva ao concello. */
function requireUser(event: Event) {
	const user = event.locals.user;
	if (!user) redirect(303, '/');
	return user;
}

/** URL dun paso conservando `redirectTo` (crú: só se sanea ao rematar). */
function stepUrl(paso: number, redirectTo: string, extra = '') {
	const q = redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : '';
	return `/benvida?paso=${paso}${extra}${q}`;
}

const redirectToOf = (form: FormData) => {
	const v = form.get('redirectTo');
	return typeof v === 'string' ? v : '';
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const { db } = event.locals;
	const redirectTo = event.url.searchParams.get('redirectTo') ?? '';
	const me = await readProfileUser(db, user.id);
	// Quen xa a fixo non a repite.
	if (me.onboardedAt) redirect(303, safeRedirect(redirectTo || null));

	const raw = Number(event.url.searchParams.get('paso'));
	const paso = raw === 2 || raw === 3 ? raw : 1;
	const followed = await listFollowed(db, user.id);
	if (paso > 1 && followed.length === 0) redirect(303, stepUrl(1, redirectTo));

	const base = { paso, redirectTo, name: user.displayName, userId: user.id };
	if (paso === 1) {
		// O concello desde o que se entrou vai primeiro (e marcado se aínda non segue ningún).
		const first = slugOfPath(safeRedirect(redirectTo || null)) ?? event.cookies.get('concello');
		const choices = await municipalityChoices(db, user.id, first ?? null);
		const none = !choices.some((m) => m.checked);
		return {
			...base,
			municipalities: choices.map((m, i) => ({
				...m,
				checked: m.checked || (none && i === 0 && m.slug === first)
			}))
		};
	}
	if (paso === 2) {
		return { ...base, tab: avatarTab(event.url.searchParams.get('tab')), avatar: me.avatar };
	}
	return {
		...base,
		email: me.email,
		notifyEmail: me.notifyEmail,
		followed: followed.map((f) => ({ id: f.municipalityId, name: f.name }))
	};
};

export const actions: Actions = {
	concellos: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const failed = await saveFollowed(event.locals.db, user.id, form);
		if (failed) return failed;
		redirect(303, stepUrl(2, redirectToOf(form)));
	},
	avatar: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const failed = await saveAvatarKey(event.locals.db, user.id, form);
		if (failed) return failed;
		redirect(303, stepUrl(3, redirectToOf(form)));
	},
	foto: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const failed = await saveAvatarPhoto(event.locals.db, user.id, form);
		if (failed) return failed;
		redirect(303, stepUrl(2, redirectToOf(form), '&tab=foto'));
	},
	quitarFoto: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		await removeAvatarPhoto(event.locals.db, user.id);
		redirect(303, stepUrl(2, redirectToOf(form), '&tab=foto'));
	},
	rematar: async (event) => {
		const user = requireUser(event);
		const { db } = event.locals;
		const now = event.locals.now();
		const form = await event.request.formData();
		const redirectTo = redirectToOf(form);
		// Sen ningún concello non hai benvida rematada: volve ao paso 1.
		const followed = await listFollowed(db, user.id);
		if (followed.length === 0) redirect(303, stepUrl(1, redirectTo));
		// Primeiro todo o que pode fallar; despois gárdase.
		const residency = await checkResidency(db, user.id, form);
		if (!('declare' in residency)) return residency;
		const failed = await saveNoticePrefs(db, user.id, form, now);
		// O empadroamento escollido volve co erro, para non perdelo ao repintar.
		if (failed)
			return fail(400, { ...failed.data, empadroado: String(form.get('empadroado') ?? '') });
		await declareChosenResidency(db, user.id, residency, now);
		await completeOnboarding(db, user.id, now);
		// «/» (o destino por defecto do inicio de sesión) non di nada: mellor o primeiro concello.
		if (redirectTo && redirectTo !== '/') redirect(303, safeRedirect(redirectTo));
		redirect(303, `/${followed[0].slug}`);
	}
};
