// SPDX-License-Identifier: EUPL-1.2
import { asc, eq, getTableColumns, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { municipalities } from '../db/schema';

/** Fila del concello sin los bytes del escudo (`getLogo` los lee); `hasLogo` dice si hay. */
export type MunicipalityRow = Omit<typeof municipalities.$inferSelect, 'logo'> & {
	hasLogo: boolean;
};

/** Columnas del concello salvo el escudo: un `select()` genérico no debe arrastrar los bytes. */
export const { logo: _logoColumn, ...municipalityColumns } = getTableColumns(municipalities);

export async function getMunicipalityBySlug(db: Db, slug: string): Promise<MunicipalityRow | null> {
	const [row] = await db
		.select({ ...municipalityColumns, hasLogo: isNotNull(municipalities.logo) })
		.from(municipalities)
		.where(eq(municipalities.slug, slug));
	return row ? { ...row, hasLogo: Boolean(row.hasLogo) } : null;
}

export function listMunicipalities(db: Db) {
	return db
		.select({
			id: municipalities.id,
			slug: municipalities.slug,
			name: municipalities.name,
			province: municipalities.province,
			primaryColor: municipalities.primaryColor
		})
		.from(municipalities)
		.orderBy(asc(municipalities.name));
}

/** Lista para el selector de la raíz: como `listMunicipalities`, más si tiene escudo subido. */
export async function listMunicipalityCards(db: Db) {
	const rows = await db
		.select({
			slug: municipalities.slug,
			name: municipalities.name,
			province: municipalities.province,
			primaryColor: municipalities.primaryColor,
			hasLogo: isNotNull(municipalities.logo),
			logoVersion: municipalities.logoVersion
		})
		.from(municipalities)
		.orderBy(asc(municipalities.name));
	return rows.map((r) => ({ ...r, hasLogo: Boolean(r.hasLogo) }));
}

/** Datos mínimos del armazón de la vecindad; no lee los bytes del escudo. */
export async function getMunicipalityShell(db: Db, slug: string) {
	const [row] = await db
		.select({
			id: municipalities.id,
			slug: municipalities.slug,
			name: municipalities.name,
			primaryColor: municipalities.primaryColor,
			hasLogo: isNotNull(municipalities.logo),
			logoVersion: municipalities.logoVersion
		})
		.from(municipalities)
		.where(eq(municipalities.slug, slug));
	return row ? { ...row, hasLogo: Boolean(row.hasLogo) } : null;
}
