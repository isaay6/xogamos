// SPDX-License-Identifier: EUPL-1.2
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { municipalities } from '../db/schema';
import { err, ok, type Result } from './result';

export const MAX_LOGO_BYTES = 262_144;

export type LogoMime = 'image/png' | 'image/jpeg' | 'image/webp';

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
	b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

/** Tipo de imagen por bytes mágicos; la cabecera de la petición no cuenta. SVG y HTML dan null. */
export function detectImageMime(bytes: Uint8Array): LogoMime | null {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	// RIFF....WEBP
	if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
		return 'image/webp';
	return null;
}

/** Guarda el escudo y sube `logo_version`, que cambia el URL (`logoUrl`) y vacía las cachés. */
export async function setLogo(
	db: Db,
	municipalityId: string,
	bytes: Uint8Array
): Promise<Result<void, 'VALIDATION_FAILED'>> {
	if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return err('VALIDATION_FAILED');
	const mime = detectImageMime(bytes);
	if (!mime) return err('VALIDATION_FAILED');
	await db
		.update(municipalities)
		.set({
			logo: bytes,
			logoMime: mime,
			logoVersion: sql`${municipalities.logoVersion} + 1`
		})
		.where(eq(municipalities.id, municipalityId));
	return ok(undefined);
}

export async function getLogo(
	db: Db,
	municipalityId: string
): Promise<{ bytes: Uint8Array; mime: string; version: number } | null> {
	const [row] = await db
		.select({
			logo: municipalities.logo,
			logoMime: municipalities.logoMime,
			version: municipalities.logoVersion
		})
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	if (!row?.logo || !row.logoMime) return null;
	return { bytes: new Uint8Array(row.logo), mime: row.logoMime, version: row.version };
}
