// SPDX-License-Identifier: EUPL-1.2
import { localDateOf } from '../../../../lib/server/domain/time';
import { getAgenda } from '../../../../lib/server/services/staff';
import { dayParam } from '../dates';
import { deskContext } from '../guard';
import { buildSheet } from './sheet';
import type { PageServerLoad } from './$types';

/** Folla do día para imprimir: `?dia=` válido ou hoxe. Só inicial e apelido, PIN e hora. */
export const load: PageServerLoad = async (event) => {
	const { municipality } = await deskContext(event);
	const today = localDateOf(event.locals.now());
	const date = dayParam(event.url.searchParams.get('dia'), today);
	const agenda = await getAgenda(event.locals.db, municipality.id, date);
	return { date, today, sheet: buildSheet(agenda) };
};
