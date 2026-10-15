import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { favorites } from '@/lib/db/schema';
import type { Listing } from './types';

/**
 * Saved places (the "Saved" tab, spec 054). Stored in the template's
 * `favorites` table, keyed by item slug, so the template's own favourites
 * and SoiGuru's Saved tab are the same list.
 */

/** Slugs the user saved, newest first. */
export async function getSavedSlugs(userId: string): Promise<string[]> {
	const rows = await db
		.select({ slug: favorites.itemSlug })
		.from(favorites)
		.where(eq(favorites.userId, userId))
		.orderBy(desc(favorites.createdAt));
	return rows.map((r) => r.slug);
}

export async function addSaved(userId: string, l: Listing): Promise<void> {
	await db
		.insert(favorites)
		.values({
			userId,
			itemSlug: l.slug,
			itemName: l.name,
			itemIconUrl: l.images[0] ?? null,
			itemCategory: l.category.id
		})
		.onConflictDoNothing();
}

export async function removeSaved(userId: string, slug: string): Promise<void> {
	await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.itemSlug, slug)));
}
