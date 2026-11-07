// SPDX-License-Identifier: EUPL-1.2
import { fail, redirect } from '@sveltejs/kit';
import { requirePageDeputacion } from '../../../lib/server/http/page-guards';
import {
	createMunicipality,
	PROVINCES,
	RESERVED_SLUGS
} from '../../../lib/server/services/deputacion';
import { CreateMunicipalityBody } from '../../api/v1/deputacion/municipalities/municipalities.openapi';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requirePageDeputacion(event);
	return { provinces: [...PROVINCES], reserved: RESERVED_SLUGS };
};

const text = (form: FormData, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v : '';
};

/** Campo del formulario al que pertenece cada ruta de error del esquema. */
const FIELD: Record<string, string> = {
	slug: 'slug',
	name: 'name',
	province: 'province',
	primaryColor: 'primaryColor',
	'firstAdmin.provider': 'provider',
	'firstAdmin.subject': 'subject',
	'firstAdmin.displayName': 'adminName'
};

export const actions: Actions = {
	default: async (event) => {
		await requirePageDeputacion(event);
		const form = await event.request.formData();
		const values = {
			name: text(form, 'name'),
			slug: text(form, 'slug'),
			province: text(form, 'province'),
			primaryColor: text(form, 'primaryColor'),
			adminName: text(form, 'adminName'),
			provider: text(form, 'provider'),
			subject: text(form, 'subject')
		};
		const parsed = CreateMunicipalityBody.safeParse({
			slug: values.slug,
			name: values.name,
			province: values.province,
			primaryColor: values.primaryColor,
			firstAdmin: {
				provider: values.provider,
				subject: values.subject,
				displayName: values.adminName
			}
		});
		if (!parsed.success) {
			const errors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const field = FIELD[issue.path.join('.')];
				if (field && !(field in errors)) errors[field] = field;
			}
			return fail(400, { errors, values });
		}
		const res = await createMunicipality(event.locals.db, parsed.data);
		if (!res.ok) return fail(409, { errors: { slug: 'SLUG_TAKEN' }, values });
		// Solo el slug viaja en la URL.
		redirect(303, `/deputacion?novo=${res.value.slug}`);
	}
};
