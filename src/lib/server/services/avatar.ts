// SPDX-License-Identifier: EUPL-1.2
import { and, eq, exists, inArray } from 'drizzle-orm';
import type { AvatarKey } from '../../avatars';
import type { Db } from '../db/client';
import { municipalityProfiles, staffRoles, users } from '../db/schema';
import { detectImageMime, MAX_LOGO_BYTES } from './logo';
import { err, ok, type Result } from './result';

/**
 * Debuxo do catálogo, ou ningún (`null`, a inicial). Borra a foto: se non, a foto seguiría
 * gañando ao debuxo escollido na cabeceira e en Eu.
 */
export async function setAvatarKey(db: Db, userId: string, key: AvatarKey | null): Promise<void> {
	await db
		.update(users)
		.set({ avatarKey: key, avatarPhoto: null, avatarMime: null })
		.where(eq(users.id, userId));
}

/**
 * Foto propia: límite de 256 KB (el mismo que el escudo) y tipo por bytes mágicos, así que
 * SVG y HTML se rechazan. `declaredLength` es la longitud anunciada por la petición.
 */
export async function setAvatarPhoto(
	db: Db,
	userId: string,
	bytes: Uint8Array,
	declaredLength: number
): Promise<Result<void, 'PHOTO_TOO_LARGE' | 'UNSUPPORTED_IMAGE'>> {
	if (declaredLength > MAX_LOGO_BYTES || bytes.length > MAX_LOGO_BYTES) {
		return err('PHOTO_TOO_LARGE');
	}
	if (bytes.length === 0) return err('UNSUPPORTED_IMAGE');
	const mime = detectImageMime(bytes);
	if (!mime) return err('UNSUPPORTED_IMAGE');
	await db.update(users).set({ avatarPhoto: bytes, avatarMime: mime }).where(eq(users.id, userId));
	return ok(undefined);
}

export async function clearAvatarPhoto(db: Db, userId: string): Promise<void> {
	await db.update(users).set({ avatarPhoto: null, avatarMime: null }).where(eq(users.id, userId));
}

/**
 * Foto de `userId` para `requesterId`: solo la propia persona o personal (admin o conserxe)
 * de un concello donde esa persona tiene perfil. En cualquier otro caso, null (sin distinguir
 * «no existe» de «no puedes verla»).
 */
export async function getAvatarPhoto(
	db: Db,
	requesterId: string,
	userId: string
): Promise<{ bytes: Uint8Array; mime: string } | null> {
	const [row] = await db
		.select({ photo: users.avatarPhoto, mime: users.avatarMime })
		.from(users)
		.where(eq(users.id, userId));
	if (!row?.photo || !row.mime) return null;
	if (requesterId !== userId) {
		const [staff] = await db
			.select({ id: staffRoles.id })
			.from(staffRoles)
			.where(
				and(
					eq(staffRoles.userId, requesterId),
					inArray(staffRoles.role, ['admin', 'conserxe']),
					exists(
						db
							.select({ one: municipalityProfiles.id })
							.from(municipalityProfiles)
							.where(
								and(
									eq(municipalityProfiles.userId, userId),
									eq(municipalityProfiles.municipalityId, staffRoles.municipalityId)
								)
							)
					)
				)
			);
		if (!staff) return null;
	}
	return { bytes: new Uint8Array(row.photo), mime: row.mime };
}
