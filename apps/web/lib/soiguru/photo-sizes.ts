import sharp from 'sharp';

/**
 * Owner photo sizes (spec 067). Every accepted photo is stored as three WebP files next to the
 * listing: `<id>.webp` (at most 1600px on the long side), `<id>-800.webp` (800×600) and
 * `<id>-400.webp` (400×300), the last two cropped to cover with attention-based framing. The
 * listing's `images` keeps only the main URL; the public site derives the copies from it
 * (`photoVariant` in the Astro site's `lib/soiguru/media.ts`).
 *
 * Kept apart from `photos.ts` (server-only) so it can be unit-tested.
 */

export type PhotoSize = 800 | 400;

export const PHOTO_SIZES: readonly PhotoSize[] = [800, 400];

const MAIN_EDGE = 1600;
const QUALITY = 80;
const BOX: Record<PhotoSize, { width: number; height: number }> = {
	800: { width: 800, height: 600 },
	400: { width: 400, height: 300 },
};

/** `<id>-800.webp` → `{ id, size: 800 }`; null for any other name. */
export function parseCopyName(file: string): { id: string; size: PhotoSize } | null {
	const m = /^([a-z0-9]{6,40})-(800|400)\.webp$/.exec(file);
	return m ? { id: m[1], size: Number(m[2]) as PhotoSize } : null;
}

/** File name of a smaller copy: `abc123.webp` → `abc123-800.webp`; null for non-WebP files. */
export function copyName(file: string, size: PhotoSize): string | null {
	const m = /^([a-z0-9]{6,40})\.webp$/.exec(file);
	return m ? `${m[1]}-${size}.webp` : null;
}

/** The main WebP: EXIF rotation applied, at most 1600px on the long side. Throws on undecodable input. */
export async function encodeMain(bytes: Uint8Array): Promise<Buffer> {
	return sharp(bytes)
		.rotate()
		.resize({ width: MAIN_EDGE, height: MAIN_EDGE, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: QUALITY })
		.toBuffer();
}

/** A cropped copy (800×600 or 400×300) of any decodable image. */
export async function encodeCopy(bytes: Uint8Array, size: PhotoSize): Promise<Buffer> {
	const { width, height } = BOX[size];
	return sharp(bytes)
		.rotate()
		.resize({ width, height, fit: 'cover', position: sharp.strategy.attention })
		.webp({ quality: QUALITY })
		.toBuffer();
}
