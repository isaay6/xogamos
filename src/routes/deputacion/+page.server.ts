// SPDX-License-Identifier: EUPL-1.2
import { eq } from 'drizzle-orm';
import { municipalities } from '../../lib/server/db/schema';
import { localDateOf } from '../../lib/server/domain/time';
import { requirePageDeputacion } from '../../lib/server/http/page-guards';
import { compareMunicipalities } from '../../lib/server/services/deputacion';
import { rangeFor } from './range';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requirePageDeputacion(event);
	const { db } = event.locals;
	const { rango, from, to } = rangeFor(
		event.url.searchParams.get('rango'),
		localDateOf(event.locals.now())
	);
	const rows = await compareMunicipalities(db, from, to);

	// Aviso tras crear un concello: solo el slug viaja en la URL, y solo se muestra si existe.
	const slug = event.url.searchParams.get('novo');
	let novo: { slug: string; name: string } | null = null;
	if (slug) {
		const [m] = await db
			.select({ slug: municipalities.slug, name: municipalities.name })
			.from(municipalities)
			.where(eq(municipalities.slug, slug));
		novo = m ?? null;
	}
	return { rows, rango, from, to, novo };
};
