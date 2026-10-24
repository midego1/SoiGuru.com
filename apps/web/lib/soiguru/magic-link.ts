import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { soiguruMagicLinks, users, ActivityType } from '@/lib/db/schema';
import { getTenantId } from '@/lib/auth/tenant';

/**
 * Passwordless sign-in for SoiGuru (spec 073).
 *
 * `issueMagicLink` stores the SHA-256 of a random 32-byte token and returns the token for the
 * email; `consumeMagicLink` marks the row used in one conditional UPDATE, so a link signs in
 * at most once even when two tabs open it at the same moment. `resolveMagicLinkUser` finds or
 * creates the account: a first sign-in creates the user and client profile (like an OAuth
 * sign-up) and marks the address verified, since the link proves the mailbox.
 */

export const MAGIC_LINK_TTL_MINUTES = 20;
/** Links per address per window, and the shortest gap between two links. */
export const MAGIC_LINK_MAX_PER_WINDOW = 3;
export const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;
export const MAGIC_LINK_MIN_GAP_MS = 30 * 1000;

export function hashMagicLinkToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export type IssueResult =
	| { ok: true; token: string; expiresAt: Date }
	| { ok: false; reason: 'throttled'; retryAfterSeconds: number };

export async function issueMagicLink(rawEmail: string, requestIp?: string | null): Promise<IssueResult> {
	const email = normalizeEmail(rawEmail);
	const now = Date.now();
	const since = new Date(now - MAGIC_LINK_WINDOW_MS);

	const recent = await db
		.select({ createdAt: soiguruMagicLinks.createdAt })
		.from(soiguruMagicLinks)
		.where(and(eq(soiguruMagicLinks.email, email), gt(soiguruMagicLinks.createdAt, since)))
		.orderBy(sql`${soiguruMagicLinks.createdAt} desc`)
		.limit(MAGIC_LINK_MAX_PER_WINDOW);

	const newest = recent[0]?.createdAt?.getTime();
	if (newest && now - newest < MAGIC_LINK_MIN_GAP_MS) {
		return {
			ok: false,
			reason: 'throttled',
			retryAfterSeconds: Math.ceil((MAGIC_LINK_MIN_GAP_MS - (now - newest)) / 1000)
		};
	}
	if (recent.length >= MAGIC_LINK_MAX_PER_WINDOW) {
		const oldest = recent[recent.length - 1].createdAt.getTime();
		return {
			ok: false,
			reason: 'throttled',
			retryAfterSeconds: Math.max(1, Math.ceil((oldest + MAGIC_LINK_WINDOW_MS - now) / 1000))
		};
	}

	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
	await db.insert(soiguruMagicLinks).values({
		email,
		tokenHash: hashMagicLinkToken(token),
		expiresAt,
		requestIp: requestIp ? requestIp.slice(0, 64) : null
	});
	return { ok: true, token, expiresAt };
}

/**
 * Use a link: returns the email it was sent to, or null when it is unknown, used or expired.
 * The other unused links of that address are closed too, so an older email cannot be used
 * after a newer one signed in.
 */
export async function consumeMagicLink(token: string): Promise<string | null> {
	if (!token || token.length < 20 || token.length > 200) return null;
	const now = new Date();
	const [row] = await db
		.update(soiguruMagicLinks)
		.set({ usedAt: now })
		.where(
			and(
				eq(soiguruMagicLinks.tokenHash, hashMagicLinkToken(token)),
				isNull(soiguruMagicLinks.usedAt),
				gt(soiguruMagicLinks.expiresAt, now)
			)
		)
		.returning({ email: soiguruMagicLinks.email });
	if (!row) return null;
	await db
		.update(soiguruMagicLinks)
		.set({ usedAt: now })
		.where(and(eq(soiguruMagicLinks.email, row.email), isNull(soiguruMagicLinks.usedAt)))
		.catch((error) => console.warn('[magic-link] Could not close older links:', error));
	return row.email;
}

/** The user object NextAuth puts in the JWT (same shape as the credentials provider). */
export interface MagicLinkUser {
	id: string;
	email: string;
	name: string | null;
	image: null;
	tenantId?: string;
	clientProfileId?: string;
	isClient: boolean;
	isAdmin: boolean;
}

export async function resolveMagicLinkUser(rawEmail: string): Promise<MagicLinkUser> {
	const email = normalizeEmail(rawEmail);
	// Imported here: the queries module pulls in the whole DB layer.
	const { getUserByEmail, isUserAdmin, getClientProfileByUserId, createClientProfile, logActivity } =
		await import('@/lib/db/queries');

	let user = await getUserByEmail(email);
	let created = false;
	if (!user) {
		const tenantId = await getTenantId();
		if (!tenantId) throw new Error('Tenant ID not found');
		const inserted = await db
			.insert(users)
			.values({ id: crypto.randomUUID(), email, tenantId, emailVerified: new Date() })
			.onConflictDoNothing({ target: users.email })
			.returning();
		user = inserted[0] ?? (await getUserByEmail(email));
		created = Boolean(inserted[0]);
		if (!user) throw new Error('Could not create the user for this sign-in link');
	} else if (!user.emailVerified) {
		await db
			.update(users)
			.set({ emailVerified: new Date(), updatedAt: new Date() })
			.where(eq(users.id, user.id))
			.catch((error) => console.warn('[magic-link] Could not mark email verified:', error));
	}

	if (await isUserAdmin(user.id)) {
		void logActivity(ActivityType.SIGN_IN, user.id, 'user', undefined, user.tenantId || undefined).catch(() => {});
		return {
			id: user.id,
			email,
			name: null,
			image: null,
			tenantId: user.tenantId ?? undefined,
			isClient: false,
			isAdmin: true
		};
	}

	let profile = await getClientProfileByUserId(user.id);
	if (!profile) {
		const local = email.split('@')[0] || 'SoiGuru member';
		profile = await createClientProfile({ userId: user.id, email, name: local, displayName: local });
	}

	void logActivity(created ? ActivityType.SIGN_UP : ActivityType.SIGN_IN, profile.id, 'client').catch(() => {});

	return {
		id: user.id,
		email,
		name: profile.name || profile.displayName || null,
		image: null,
		tenantId: user.tenantId ?? undefined,
		clientProfileId: profile.id,
		isClient: true,
		isAdmin: false
	};
}
