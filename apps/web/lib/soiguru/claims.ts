import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { listingClaims, users, type ListingClaim } from '@/lib/db/schema';
import { isAdmin } from '@/lib/db/roles';
import { ItemRepository } from '@/lib/repositories/item.repository';
import { invalidateContentCaches } from '@/lib/cache-invalidation';
import { deleteClaimPhotos, publishClaimPhotos } from './claim-photos';
import { getCityListings } from './content';

/**
 * Listing claims (spec 054). Verification and payment are manual for now:
 * the owner files a claim with a plan, an admin calls the number on the
 * listing, confirms the payment and approves. Approval writes `claimed: true`
 * into the listing YAML, which shows the Verified badge.
 */

export type ClaimPlan = 'monthly' | 'yearly';
export type ClaimVerification = 'call' | 'sign';
export type ClaimPayment = 'promptpay' | 'card';

export const PLAN_PRICE_THB: Record<ClaimPlan, number> = { monthly: 100, yearly: 1000 };

const OPEN_STATUSES = ['pending', 'approved'];

/** Claims of one user, newest first. */
export async function getUserClaims(userId: string): Promise<ListingClaim[]> {
	return db
		.select()
		.from(listingClaims)
		.where(eq(listingClaims.userId, userId))
		.orderBy(desc(listingClaims.createdAt));
}

/** The approved claim that lets `userId` edit a listing, if any. */
export async function getApprovedClaim(userId: string, city: string, slug: string): Promise<ListingClaim | undefined> {
	const rows = await db
		.select()
		.from(listingClaims)
		.where(
			and(
				eq(listingClaims.userId, userId),
				eq(listingClaims.city, city),
				eq(listingClaims.listingSlug, slug),
				eq(listingClaims.status, 'approved')
			)
		)
		.limit(1);
	return rows[0];
}

/** Slugs in a city with a pending or approved claim (shown as "Claimed" in the claim search). */
export async function getClaimedSlugs(city: string): Promise<Set<string>> {
	try {
		const rows = await db
			.select({ slug: listingClaims.listingSlug })
			.from(listingClaims)
			.where(and(eq(listingClaims.city, city), inArray(listingClaims.status, OPEN_STATUSES)));
		return new Set(rows.map((r) => r.slug));
	} catch (error) {
		// No database configured: fall back to the `claimed` flag in the content.
		console.warn('[soiguru] claims lookup failed:', error);
		return new Set();
	}
}

export async function createClaim(input: {
	userId: string;
	city: string;
	listingSlug: string;
	verification: ClaimVerification;
	contactPhone?: string;
	note?: string;
	plan: ClaimPlan;
	paymentMethod: ClaimPayment;
}): Promise<ListingClaim> {
	const existing = await db
		.select()
		.from(listingClaims)
		.where(
			and(
				eq(listingClaims.city, input.city),
				eq(listingClaims.listingSlug, input.listingSlug),
				inArray(listingClaims.status, OPEN_STATUSES)
			)
		);
	const mine = existing.find((c) => c.userId === input.userId);
	if (mine) return mine;
	if (existing.some((c) => c.status === 'approved')) {
		throw new Error('already-claimed');
	}
	const [row] = await db
		.insert(listingClaims)
		.values({
			userId: input.userId,
			city: input.city,
			listingSlug: input.listingSlug,
			verification: input.verification,
			contactPhone: input.contactPhone || null,
			note: input.note || null,
			plan: input.plan,
			paymentMethod: input.paymentMethod
		})
		.returning();
	return row;
}

/** Pending claims plus the claimant's email, oldest first (admin review queue). */
export async function getReviewQueue(): Promise<(ListingClaim & { email: string | null })[]> {
	const rows = await db
		.select({ claim: listingClaims, email: users.email })
		.from(listingClaims)
		.leftJoin(users, eq(users.id, listingClaims.userId))
		.where(eq(listingClaims.status, 'pending'))
		.orderBy(listingClaims.createdAt);
	return rows.map((r) => ({ ...r.claim, email: r.email }));
}

/** Recently decided claims (admin review page). */
export async function getRecentDecisions(limit = 20): Promise<(ListingClaim & { email: string | null })[]> {
	const rows = await db
		.select({ claim: listingClaims, email: users.email })
		.from(listingClaims)
		.leftJoin(users, eq(users.id, listingClaims.userId))
		.where(inArray(listingClaims.status, ['approved', 'rejected']))
		.orderBy(desc(listingClaims.reviewedAt))
		.limit(limit);
	return rows.map((r) => ({ ...r.claim, email: r.email }));
}

export async function userIsAdmin(userId: string): Promise<boolean> {
	try {
		return await isAdmin(userId);
	} catch {
		return false;
	}
}

function addPlanPeriod(from: Date, plan: string): Date {
	const until = new Date(from);
	if (plan === 'monthly') until.setMonth(until.getMonth() + 1);
	else until.setFullYear(until.getFullYear() + 1);
	return until;
}

/**
 * Approve or reject a pending claim. Approving also records the payment as
 * received (the admin confirms it before approving) and marks the listing as
 * claimed in the content repo.
 */
export async function decideClaim(id: string, adminId: string, approve: boolean, reviewNote?: string): Promise<void> {
	const [claim] = await db.select().from(listingClaims).where(eq(listingClaims.id, id)).limit(1);
	if (!claim || claim.status !== 'pending') return;
	const now = new Date();
	await db
		.update(listingClaims)
		.set({
			status: approve ? 'approved' : 'rejected',
			reviewedBy: adminId,
			reviewedAt: now,
			reviewNote: reviewNote || null,
			paidAt: approve ? now : null,
			paidUntil: approve ? addPlanPeriod(now, claim.plan) : null,
			updatedAt: now
		})
		.where(eq(listingClaims.id, id));
	if (approve) {
		// The claimant's photos (spec 064) become the listing's first photos.
		let photos: string[] = [];
		try {
			photos = await publishClaimPhotos(claim.userId, claim.city, claim.listingSlug);
		} catch (error) {
			console.warn('[soiguru] claim photos not published:', error);
		}
		const current = (await getCityListings(claim.city)).find((l) => l.slug === claim.listingSlug)?.images ?? [];
		await new ItemRepository().patchFields(
			claim.listingSlug,
			{ claimed: true, updated_by: 'owner', ...(photos.length ? { images: [...photos, ...current] } : {}) },
			`Claim approved: ${claim.city}/${claim.listingSlug}${photos.length ? ` (+${photos.length} photos)` : ''}`
		);
		await invalidateContentCaches();
	} else {
		await deleteClaimPhotos(claim.userId, claim.city, claim.listingSlug).catch(() => {});
	}
}

/** Write owner edits to the listing YAML and refresh the content caches. */
export async function saveListingFields(slug: string, patch: Record<string, unknown>, message: string): Promise<void> {
	await new ItemRepository().patchFields(slug, { ...patch, updated_by: 'owner' }, message);
	await invalidateContentCaches();
}
