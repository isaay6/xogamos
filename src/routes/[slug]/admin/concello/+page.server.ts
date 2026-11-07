// SPDX-License-Identifier: EUPL-1.2
import { fail } from '@sveltejs/kit';
import { getSettings } from '../../../../lib/server/services/admin';
import { MAX_LOGO_BYTES, setLogo } from '../../../../lib/server/services/logo';
import { requireAdminPage } from '../guard';
import { field, mergeSettings } from '../form';
import type { Actions, PageServerLoad } from './$types';

const MAX_TEXT = 20_000;

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const settings = await getSettings(event.locals.db, municipality.id);
	return {
		hasLogo: municipality.hasLogo,
		logoVersion: municipality.logoVersion,
		settings: {
			name: settings.name,
			primaryColor: settings.primaryColor,
			legalNotice: settings.legalNotice,
			privacyPolicy: settings.privacyPolicy,
			usageRules: settings.usageRules
		}
	};
};

export const actions: Actions = {
	escudo: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const file = (await event.request.formData()).get('logo');
		if (!(file instanceof File) || file.size === 0 || file.size > MAX_LOGO_BYTES)
			return fail(400, { error: 'LOGO_INVALID' });
		const res = await setLogo(
			event.locals.db,
			municipality.id,
			new Uint8Array(await file.arrayBuffer())
		);
		return res.ok ? { logoSaved: true } : fail(400, { error: 'LOGO_INVALID' });
	},
	gardar: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const name = field(form, 'name').trim();
		const primaryColor = field(form, 'primaryColor').trim();
		const legalNotice = field(form, 'legalNotice');
		const privacyPolicy = field(form, 'privacyPolicy');
		const usageRules = field(form, 'usageRules');
		if (
			!name ||
			name.length > 200 ||
			!/^#[0-9a-fA-F]{6}$/.test(primaryColor) ||
			[legalNotice, privacyPolicy, usageRules].some((x) => x.length > MAX_TEXT)
		)
			return fail(400, { error: 'INVALID' });
		const saved = await mergeSettings(event.locals.db, municipality.id, {
			name,
			primaryColor,
			legalNotice,
			privacyPolicy,
			usageRules
		});
		return saved ? { saved: true } : fail(404, { error: 'NOT_FOUND' });
	}
};
