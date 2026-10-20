import 'server-only';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getContentPath } from '@/lib/lib';
import { PUBLIC_SITE } from './public-site';

/**
 * Owners' own photos (spec 061). Stored in the content repository next to the listing
 * (`data/<slug>/photos/<file>`) and committed with the listing's `images`, like every other
 * owner edit. The listing keeps absolute URLs on the public site, `https://soiguru.com/media/<slug>/<file>`;
 * soiguru.com's Worker fetches them from this app (`/api/soiguru/media/<slug>/<file>`) and keeps
 * them at Cloudflare's edge. Unlike Google's photos, these may be stored and cached.
 *
 * The browser resizes each photo before upload (1600px, WebP or JPEG); this side only accepts
 * WebP, JPEG or PNG by their file signature, at most `MAX_BYTES`, and at most `MAX_PHOTOS` per listing.
 */

export const MAX_PHOTOS = 8;
export const MAX_BYTES = 3 * 1024 * 1024;

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
const FILE = /^[a-z0-9]{6,40}\.(webp|jpg|png)$/;

export type PhotoType = 'webp' | 'jpg' | 'png';

const MIME: Record<PhotoType, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

/** The type from the first bytes, or null when it is not a WebP, JPEG or PNG image. */
export function sniffPhoto(bytes: Uint8Array): PhotoType | null {
	if (bytes.length < 12) return null;
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
	if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
	return null;
}

function photosDir(slug: string): string {
	if (!SLUG.test(slug)) throw new Error('Invalid listing');
	return path.join(getContentPath(), 'data', slug, 'photos');
}

/** Public URL of an owner photo. */
export function photoUrl(slug: string, file: string): string {
	return `${PUBLIC_SITE}/media/${slug}/${file}`;
}

/** The file name when `url` is one of this listing's owner photos, else null. */
export function ownPhotoFile(slug: string, url: string): string | null {
	const prefix = `${PUBLIC_SITE}/media/${slug}/`;
	if (!url.startsWith(prefix)) return null;
	const file = url.slice(prefix.length);
	return FILE.test(file) ? file : null;
}

/** Write one checked photo into the content repo; returns its public URL (not yet committed). */
export async function writePhoto(slug: string, bytes: Uint8Array): Promise<string> {
	if (bytes.length > MAX_BYTES) throw new Error('too-large');
	const type = sniffPhoto(bytes);
	if (!type) throw new Error('not-an-image');
	const dir = photosDir(slug);
	await fs.mkdir(dir, { recursive: true });
	const file = `${Date.now().toString(36)}${randomBytes(5).toString('hex')}.${type}`;
	await fs.writeFile(path.join(dir, file), bytes);
	return photoUrl(slug, file);
}

/** Delete an owner photo file (when it is one); the caller updates `images`. */
export async function deletePhotoFile(slug: string, url: string): Promise<void> {
	const file = ownPhotoFile(slug, url);
	if (!file) return;
	await fs.rm(path.join(photosDir(slug), file), { force: true });
}

/** Read an owner photo for serving: bytes and content type, or null. */
export async function readPhoto(slug: string, file: string): Promise<{ bytes: Buffer; type: string } | null> {
	if (!SLUG.test(slug) || !FILE.test(file)) return null;
	try {
		const bytes = await fs.readFile(path.join(photosDir(slug), file));
		const ext = file.split('.').pop() as PhotoType;
		return { bytes, type: MIME[ext] };
	} catch {
		return null;
	}
}
