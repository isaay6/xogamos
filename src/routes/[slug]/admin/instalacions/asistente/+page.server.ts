// SPDX-License-Identifier: EUPL-1.2
// Asistente de nueva instalación: un paso por pantalla (`?paso=0…6`), estado en campos ocultos.
import { fail, redirect } from '@sveltejs/kit';
import { t, type MessageKey } from '#lib/i18n/index.js';
import {
	createFacilityWithType,
	listAllFacilities
} from '../../../../../lib/server/services/admin';
import { templateByKey, typeColorFor } from '../../../../../lib/server/services/facility-templates';
import type { Db } from '../../../../../lib/server/db/client';
import { requireAdminPage } from '../../guard';
import {
	applyBuilding,
	applyTemplate,
	buildInput,
	clampStep,
	firstInvalid,
	LAST_STEP,
	templateCards,
	valuesOf,
	type Building,
	type Values
} from './wizard';
import type { Actions, PageServerLoad } from './$types';

/** Edificios que ya tienen instalaciones (para tocar en vez de escribir). */
async function buildingsOf(db: Db, municipalityId: string): Promise<Building[]> {
	const seen = new Map<string, Building>();
	for (const f of await listAllFacilities(db, municipalityId)) {
		const location = f.location.trim();
		if (location && !seen.has(location)) {
			seen.set(location, { location, address: f.address.trim() });
		}
	}
	return [...seen.values()].sort((a, b) => a.location.localeCompare(b.location, 'gl'));
}

export const load: PageServerLoad = async (event) => {
	const { municipality } = await requireAdminPage(event);
	return {
		paso: clampStep(event.url.searchParams.get('paso')),
		buildings: await buildingsOf(event.locals.db, municipality.id),
		templates: templateCards()
	};
};

const stepFail = (paso: number, values: Values, errors: Record<string, string>) =>
	fail(400, { paso, values, errors });

export const actions: Actions = {
	/**
	 * Moverse entre pasos (`paso` actual, `ir` destino). Hacia atrás no valida; hacia delante
	 * valida cada paso que se deja atrás. Al salir del paso 0 con un modelo nuevo, lo aplica.
	 */
	paso: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		const from = clampStep(String(form.get('paso') ?? ''));
		const to = clampStep(String(form.get('ir') ?? ''));
		let values = valuesOf(form);
		if (from === 2)
			values = applyBuilding(values, await buildingsOf(event.locals.db, municipality.id));
		for (let s = from; s < to; s++) {
			const bad = firstInvalid(values, s, s + 1);
			if (bad) return stepFail(bad.step, values, bad.errors);
			if (s === 0 && values.modelo !== values.aplicado) values = applyTemplate(values);
		}
		return { paso: to, values, errors: {} as Record<string, string> };
	},

	/** «Crear instalación»: revalida todo y crea tipo (o reutiliza), instalación e horario. */
	crear: async (event) => {
		const { municipality } = await requireAdminPage(event);
		const form = await event.request.formData();
		let values = valuesOf(form);
		values = applyBuilding(values, await buildingsOf(event.locals.db, municipality.id));
		const bad = firstInvalid(values, 0, LAST_STEP);
		if (bad) return stepFail(bad.step, values, bad.errors);
		const input = buildInput(values);
		const template = templateByKey(values.modelo ?? '');
		const names =
			template && template.mascot === input.mascot
				? template.typeName
				: {
						gl: t('gl', `adm.mascota.${input.mascot}` as MessageKey),
						es: t('es', `adm.mascota.${input.mascot}` as MessageKey)
					};
		const res = await createFacilityWithType(
			event.locals.db,
			municipality.id,
			{
				nameGl: names.gl,
				nameEs: names.es,
				mascot: input.mascot,
				color: typeColorFor(input.mascot),
				bookingMode: input.mode
			},
			input.facility,
			input.hours,
			{
				namesIfTaken: {
					nameGl: `${names.gl} · ${t('gl', `adm.asis.tipo_modo.${input.mode}` as MessageKey)}`,
					nameEs: `${names.es} · ${t('es', `adm.asis.tipo_modo.${input.mode}` as MessageKey)}`
				}
			}
		);
		if (!res.ok) {
			return fail(400, {
				paso: LAST_STEP,
				values,
				errors: {} as Record<string, string>,
				error: res.error,
				issues: res.issues ?? []
			});
		}
		redirect(303, `/${municipality.slug}/admin/instalacions/${res.value.id}?creada=1`);
	}
};
