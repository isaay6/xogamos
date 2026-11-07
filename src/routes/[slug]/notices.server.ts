// SPDX-License-Identifier: EUPL-1.2
// Avisos do concello que ve unha persoa: só os do concello actual. Cada concello é a súa propia
// rede e non se mesturan (para os outros, o selector de concellos). A portada e a pestana Avisos
// usan o mesmo conxunto, así que o número coincide.
import type { Db } from '../../lib/server/db/client';
import { listMunicipalityNotices } from '../../lib/server/services/notifications';

export async function visibleNotices(
	db: Db,
	municipalityId: string,
	userId: string | null,
	now: Date
) {
	void userId;
	return listMunicipalityNotices(db, [municipalityId], now);
}
