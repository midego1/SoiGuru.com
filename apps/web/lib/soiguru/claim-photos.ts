import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { soiguruClaimPhotos } from '@/lib/db/schema';
import { MAX_BYTES, sniffPhoto, writePhoto } from './photos';

/**
 * Photos an owner takes while claiming (spec 064): the shop front, the inside and the menu or
 * services. They are kept with the claim in the database (private; a redeploy must not lose
 * them) and shown to the admin on the review screen, where a shop-front photo is also proof
 * that the claimant stood at the shop. On approval they are written into the content repo as
 * the listing's first photos (spec 061) and removed here.
 */

export const CLAIM_PHOTO_KINDS = ['front', 'inside', 'menu'] as const;
export type ClaimPhotoKind = (typeof CLAIM_PHOTO_KINDS)[number];

export function isClaimPhotoKind(v: string): v is ClaimPhotoKind {
	return (CLAIM_PHOTO_KINDS as readonly string[]).includes(v);
}

export interface ClaimPhotoRef {
	id: string;
	kind: ClaimPhotoKind;
	contentType: string;
}

const MIME = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const;

/** Store or replace the claimant's photo of one kind. Throws `too-large` / `not-an-image`. */
export async function putClaimPhoto(
	userId: string,
	city: string,
	listingSlug: string,
	kind: ClaimPhotoKind,
	bytes: Uint8Array
): Promise<ClaimPhotoRef> {
	if (bytes.length > MAX_BYTES) throw new Error('too-large');
	const type = sniffPhoto(bytes);
	if (!type) throw new Error('not-an-image');
	const contentType = MIME[type];
	const [row] = await db
		.insert(soiguruClaimPhotos)
		.values({ userId, city, listingSlug, kind, contentType, bytes: Buffer.from(bytes) })
		.onConflictDoUpdate({
			target: [
				soiguruClaimPhotos.userId,
				soiguruClaimPhotos.city,
				soiguruClaimPhotos.listingSlug,
				soiguruClaimPhotos.kind
			],
			set: { contentType, bytes: Buffer.from(bytes), createdAt: new Date() }
		})
		.returning({
			id: soiguruClaimPhotos.id,
			kind: soiguruClaimPhotos.kind,
			contentType: soiguruClaimPhotos.contentType
		});
	return { ...row, kind: row.kind as ClaimPhotoKind };
}

/** The claimant's photos for a listing, without the bytes, in slot order. */
export async function listClaimPhotos(userId: string, city: string, listingSlug: string): Promise<ClaimPhotoRef[]> {
	const rows = await db
		.select({
			id: soiguruClaimPhotos.id,
			kind: soiguruClaimPhotos.kind,
			contentType: soiguruClaimPhotos.contentType
		})
		.from(soiguruClaimPhotos)
		.where(
			and(
				eq(soiguruClaimPhotos.userId, userId),
				eq(soiguruClaimPhotos.city, city),
				eq(soiguruClaimPhotos.listingSlug, listingSlug)
			)
		)
		.orderBy(asc(soiguruClaimPhotos.createdAt));
	const order = (k: string) => CLAIM_PHOTO_KINDS.indexOf(k as ClaimPhotoKind);
	return rows.map((r) => ({ ...r, kind: r.kind as ClaimPhotoKind })).sort((a, b) => order(a.kind) - order(b.kind));
}

/** One photo with its bytes and who owns it (the GET route checks the viewer). */
export async function readClaimPhoto(
	id: string
): Promise<{ userId: string; contentType: string; bytes: Buffer } | null> {
	const [row] = await db
		.select({
			userId: soiguruClaimPhotos.userId,
			contentType: soiguruClaimPhotos.contentType,
			bytes: soiguruClaimPhotos.bytes
		})
		.from(soiguruClaimPhotos)
		.where(eq(soiguruClaimPhotos.id, id))
		.limit(1);
	return row ? { ...row, bytes: Buffer.from(row.bytes) } : null;
}

/**
 * On approval: write the claim photos into the content repo (front, inside, menu) and return
 * their public URLs; the rows are removed. Returns [] when there are none.
 */
export async function publishClaimPhotos(userId: string, city: string, listingSlug: string): Promise<string[]> {
	const rows = await db
		.select()
		.from(soiguruClaimPhotos)
		.where(
			and(
				eq(soiguruClaimPhotos.userId, userId),
				eq(soiguruClaimPhotos.city, city),
				eq(soiguruClaimPhotos.listingSlug, listingSlug)
			)
		);
	const order = (k: string) => CLAIM_PHOTO_KINDS.indexOf(k as ClaimPhotoKind);
	const urls: string[] = [];
	for (const row of rows.sort((a, b) => order(a.kind) - order(b.kind))) {
		urls.push(await writePhoto(listingSlug, new Uint8Array(row.bytes)));
	}
	if (rows.length) await deleteClaimPhotos(userId, city, listingSlug);
	return urls;
}

/** Remove the claimant's photos for a listing (after publishing, or on rejection). */
export async function deleteClaimPhotos(userId: string, city: string, listingSlug: string): Promise<void> {
	await db
		.delete(soiguruClaimPhotos)
		.where(
			and(
				eq(soiguruClaimPhotos.userId, userId),
				eq(soiguruClaimPhotos.city, city),
				eq(soiguruClaimPhotos.listingSlug, listingSlug)
			)
		);
}
