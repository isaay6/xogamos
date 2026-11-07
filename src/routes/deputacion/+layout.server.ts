// SPDX-License-Identifier: EUPL-1.2
import { requirePageDeputacion } from '../../lib/server/http/page-guards';
import type { LayoutServerLoad } from './$types';

// SvelteKit ejecuta layout y página en paralelo: cada una comprueba el rol por su cuenta.
export const load: LayoutServerLoad = async (event) => {
	const user = await requirePageDeputacion(event);
	return { staffName: user.displayName, locale: event.locals.locale };
};
