import { distanceMetres } from './format';
import { getOpenStatus, isOpenNow, type OpenStatus } from './hours';
import type { GeoPoint, Listing } from './types';

const STALE_HOURS_DAYS = 90;

/**
 * A listing's open status. Unclaimed listings whose data is older than 90
 * days show "Hours not confirmed" (OpenStatus spec: stale certainty is worse
 * than none).
 */
export function listingStatus(l: Listing, now: Date = new Date()): OpenStatus {
	if (!l.claimed && l.updatedAt && now.getTime() - l.updatedAt.getTime() > STALE_HOURS_DAYS * 86_400_000) {
		return { state: 'unknown' };
	}
	return getOpenStatus(l.hours, now);
}

export type SortKey = 'nearest' | 'top-rated' | 'recent';

export const SORT_KEYS: readonly SortKey[] = ['nearest', 'top-rated', 'recent'];

export interface RankedListing {
	listing: Listing;
	status: OpenStatus;
	open: boolean;
	/** Metres from the reference point, when both have coordinates. */
	distance?: number;
}

export function rankListings(
	listings: Listing[],
	opts: { origin?: GeoPoint; sort?: SortKey; now?: Date } = {}
): RankedListing[] {
	const now = opts.now ?? new Date();
	const ranked = listings.map((listing) => {
		const status = listingStatus(listing, now);
		return {
			listing,
			status,
			open: isOpenNow(status),
			distance: opts.origin && listing.geo ? distanceMetres(opts.origin, listing.geo) : undefined
		};
	});
	const sort = opts.sort ?? 'nearest';
	return ranked.sort((a, b) => {
		if (sort === 'top-rated') return (b.listing.rating ?? 0) - (a.listing.rating ?? 0);
		if (sort === 'recent') return (b.listing.updatedAt?.getTime() ?? 0) - (a.listing.updatedAt?.getTime() ?? 0);
		return (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE);
	});
}

/** Plain-text search over names (both scripts), category and description. */
export function matchesQuery(l: Listing, q: string): boolean {
	const needle = q.trim().toLowerCase();
	if (!needle) return true;
	return [l.name, l.nameTh, l.category.name, l.category.name_th, l.description, l.descriptionTh, l.address]
		.filter(Boolean)
		.some((s) => s!.toLowerCase().includes(needle));
}

/** "New" badge: listings added in the last 30 days (VerifiedBadge spec). */
export function isNew(l: Listing, now: Date = new Date()): boolean {
	return !!l.updatedAt && l.updatedBy === 'import' && now.getTime() - l.updatedAt.getTime() < 30 * 86_400_000;
}
