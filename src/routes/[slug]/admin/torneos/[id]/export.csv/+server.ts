// SPDX-License-Identifier: EUPL-1.2
import { toCsv } from '../../../../../../lib/server/export/csv';
import { listTournamentEntries } from '../../../../../../lib/server/services/tournaments';
import { requireAdminPage } from '../../../guard';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { municipality } = await requireAdminPage(event);
	const entries = await listTournamentEntries(event.locals.db, municipality.id, event.params.id);
	const body = toCsv(
		['Persoa', 'Inscrición', 'Equipo', 'Membros', 'Pago', 'Cancelada'],
		entries.map(({ entry, userName }) => [
			userName,
			entry.createdAt,
			entry.teamName,
			entry.members,
			entry.paidWith,
			entry.cancelledAt
		])
	);
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="torneo-${event.params.id}-inscricions.csv"`,
			'cache-control': 'no-store'
		}
	});
};
