// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { requirePageStaff } from '../../../lib/server/http/page-guards';
import { getMunicipalityShell } from '../../../lib/server/services/municipalities';
import type { LayoutServerLoad } from './$types';

/** Zona del personal: conserje o admin del concello; el resto, a «Entrar» o 403. */
export const load: LayoutServerLoad = async (event) => {
	const municipality = await getMunicipalityShell(event.locals.db, event.params.slug);
	if (!municipality) error(404);
	const user = await requirePageStaff(event, municipality.id, ['conserxe', 'apertura']);
	const apertura = await requirePageStaff(event, municipality.id, ['apertura']).then(
		() => true,
		() => false
	);
	const admin = await requirePageStaff(event, municipality.id, ['admin']).then(
		() => true,
		() => false
	);
	// Mostrador completo (conserxe ou admin): sen el só se ve a axenda e validar (rol de apertura).
	const desk = await requirePageStaff(event, municipality.id, ['conserxe']).then(
		() => true,
		() => false
	);
	return { userName: user.displayName, isAdmin: admin, isApertura: apertura, desk };
};
