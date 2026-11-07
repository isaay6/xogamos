// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { facilities, facilityPhotos } from '../db/schema';
import { detectImageMime, MAX_LOGO_BYTES } from './logo';
import { err, ok, type Result } from './result';
import { writeActivity } from './activity-log';

export const MAX_FACILITY_PHOTOS = 3;

export type FacilityPhoto = {
	id: string;
	position: number;
	altGl: string;
	altEs: string | null;
};

export async function listFacilityPhotos(db: Db, facilityId: string): Promise<FacilityPhoto[]> {
	return db
		.select({
			id: facilityPhotos.id,
			position: facilityPhotos.position,
			altGl: facilityPhotos.altGl,
			altEs: facilityPhotos.altEs
		})
		.from(facilityPhotos)
		.where(eq(facilityPhotos.facilityId, facilityId))
		.orderBy(asc(facilityPhotos.position));
}

/** Añade una foto a la instalación del municipio, nunca más de tres. */
export async function addFacilityPhoto(
	db: Db,
	municipalityId: string,
	facilityId: string,
	bytes: Uint8Array,
	declaredLength: number,
	altGl: string,
	altEs: string,
	actorId?: string
): Promise<
	Result<
		void,
		'NOT_FOUND' | 'PHOTO_LIMIT' | 'PHOTO_TOO_LARGE' | 'UNSUPPORTED_IMAGE' | 'ALT_REQUIRED'
	>
> {
	if (!altGl.trim()) return err('ALT_REQUIRED');
	if (declaredLength > MAX_LOGO_BYTES || bytes.length > MAX_LOGO_BYTES)
		return err('PHOTO_TOO_LARGE');
	if (bytes.length === 0) return err('UNSUPPORTED_IMAGE');
	const mime = detectImageMime(bytes);
	if (!mime) return err('UNSUPPORTED_IMAGE');
	return db.transaction(async (tx) => {
		const [facility] = await tx
			.select({ id: facilities.id })
			.from(facilities)
			.where(and(eq(facilities.id, facilityId), eq(facilities.municipalityId, municipalityId)));
		if (!facility) return err('NOT_FOUND');
		const photos = await listFacilityPhotos(tx as Db, facilityId);
		if (photos.length >= MAX_FACILITY_PHOTOS) return err('PHOTO_LIMIT');
		await tx.insert(facilityPhotos).values({
			facilityId,
			position: photos.length,
			photo: bytes,
			mime,
			altGl: altGl.trim(),
			altEs: altEs.trim() || null
		});
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_saved',
				params: { instalacion: facilityId }
			});
		return ok(undefined);
	});
}

async function ownedPhoto(db: Db, municipalityId: string, facilityId: string, photoId: string) {
	const [row] = await db
		.select({ id: facilityPhotos.id, position: facilityPhotos.position })
		.from(facilityPhotos)
		.innerJoin(facilities, eq(facilities.id, facilityPhotos.facilityId))
		.where(
			and(
				eq(facilityPhotos.id, photoId),
				eq(facilityPhotos.facilityId, facilityId),
				eq(facilities.municipalityId, municipalityId)
			)
		);
	return row ?? null;
}

export async function deleteFacilityPhoto(
	db: Db,
	municipalityId: string,
	facilityId: string,
	photoId: string,
	actorId?: string
): Promise<Result<void, 'NOT_FOUND'>> {
	return db.transaction(async (tx) => {
		const photo = await ownedPhoto(tx as Db, municipalityId, facilityId, photoId);
		if (!photo) return err('NOT_FOUND');
		const rows = await tx
			.select()
			.from(facilityPhotos)
			.where(eq(facilityPhotos.facilityId, facilityId))
			.orderBy(asc(facilityPhotos.position));
		// La restricción única de posición es inmediata: reconstruir las filas evita colisiones al
		// compactar 2 → 1 mientras la antigua posición 1 aún existe.
		await tx.delete(facilityPhotos).where(eq(facilityPhotos.facilityId, facilityId));
		const kept = rows
			.filter((row) => row.id !== photoId)
			.map((row, position) => ({ ...row, position }));
		if (kept.length) await tx.insert(facilityPhotos).values(kept);
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_saved',
				params: { instalacion: facilityId }
			});
		return ok(undefined);
	});
}

export async function moveFacilityPhoto(
	db: Db,
	municipalityId: string,
	facilityId: string,
	photoId: string,
	direction: -1 | 1,
	actorId?: string
): Promise<Result<void, 'NOT_FOUND'>> {
	return db.transaction(async (tx) => {
		const photo = await ownedPhoto(tx as Db, municipalityId, facilityId, photoId);
		if (!photo) return err('NOT_FOUND');
		const target = photo.position + direction;
		const rows = await tx
			.select()
			.from(facilityPhotos)
			.where(eq(facilityPhotos.facilityId, facilityId))
			.orderBy(asc(facilityPhotos.position));
		if (!rows.some((row) => row.position === target)) return ok(undefined);
		const ordered = [...rows];
		const from = ordered.findIndex((row) => row.id === photoId);
		if (from === -1) return err('NOT_FOUND');
		const moved = ordered.splice(from, 1)[0];
		if (!moved) return err('NOT_FOUND');
		ordered.splice(target, 0, moved);
		// Como al borrar, la reconstrucción conserva los UUID y evita una colisión transitoria de
		// `facility_id, position` al intercambiar dos posiciones.
		await tx.delete(facilityPhotos).where(eq(facilityPhotos.facilityId, facilityId));
		await tx.insert(facilityPhotos).values(ordered.map((row, position) => ({ ...row, position })));
		if (actorId)
			await writeActivity(tx, {
				municipalityId,
				actorId,
				kind: 'facility_saved',
				params: { instalacion: facilityId }
			});
		return ok(undefined);
	});
}

/** Foto pública: solo existe cuando la instalación activa pertenece a ese municipio. */
export async function getPublicFacilityPhoto(
	db: Db,
	municipalityId: string,
	facilityId: string,
	photoId: string
): Promise<{ bytes: Uint8Array; mime: string } | null> {
	const [row] = await db
		.select({ photo: facilityPhotos.photo, mime: facilityPhotos.mime })
		.from(facilityPhotos)
		.innerJoin(facilities, eq(facilities.id, facilityPhotos.facilityId))
		.where(
			and(
				eq(facilityPhotos.id, photoId),
				eq(facilityPhotos.facilityId, facilityId),
				eq(facilities.municipalityId, municipalityId),
				eq(facilities.active, true)
			)
		);
	return row ? { bytes: new Uint8Array(row.photo), mime: row.mime } : null;
}
