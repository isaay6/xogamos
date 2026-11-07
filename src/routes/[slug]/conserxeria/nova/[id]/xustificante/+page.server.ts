// SPDX-License-Identifier: EUPL-1.2
import { error } from '@sveltejs/kit';
import { getBookingReceipt } from '../../../../../../lib/server/services/staff';
import { deskContext, UUID } from '../../../guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { municipality } = await deskContext(event);
	const id = event.params.id;
	if (!UUID.test(id)) error(404);
	const receipt = await getBookingReceipt(event.locals.db, municipality.id, id);
	if (!receipt) error(404);
	return { receipt };
};
