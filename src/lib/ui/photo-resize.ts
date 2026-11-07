// SPDX-License-Identifier: EUPL-1.2
// Foto do avatar: no navegador redúcese antes de subila, para que unha foto de móbil (varios
// MB) entre no límite de 256 KB do servidor. Sen JavaScript sóbese tal cal e o servidor di
// se é grande de máis.

/** Lado maior da foto reducida, en píxeles. */
export const PHOTO_MAX_SIDE = 512;
const JPEG_QUALITY = 0.85;

/** Medidas que caben en `max` × `max` coa mesma proporción; nunca agranda. */
export function fitWithin(
	width: number,
	height: number,
	max = PHOTO_MAX_SIDE
): { width: number; height: number } {
	const scale = Math.min(1, max / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Reduce a foto a `PHOTO_MAX_SIDE` no lado maior e gárdaa en WebP (ou JPEG se o navegador non
 * sabe facer WebP). Devolve null se non se pode ler: entón sóbese a orixinal.
 */
export async function downscalePhoto(file: File): Promise<File | null> {
	try {
		const bitmap = await createImageBitmap(file);
		const size = fitWithin(bitmap.width, bitmap.height);
		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(bitmap, 0, 0, size.width, size.height);
		bitmap.close();
		// Un navegador sen WebP devolve PNG: entón JPEG, que pesa moito menos.
		let blob = await toBlob(canvas, 'image/webp', JPEG_QUALITY);
		if (!blob || blob.type !== 'image/webp')
			blob = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
		if (!blob) return null;
		const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
		return new File([blob], `avatar.${ext}`, { type: blob.type });
	} catch {
		return null;
	}
}
