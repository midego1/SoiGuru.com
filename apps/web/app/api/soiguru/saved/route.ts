import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getListings } from '@/lib/soiguru/content';
import { addSaved, getSavedSlugs, removeSaved } from '@/lib/soiguru/saved';
import { isPublicSiteOrigin, publicSiteCors } from '@/lib/soiguru/public-site';

/**
 * POST /api/soiguru/saved — keep the public site's saved places in the account (spec 058).
 * Body `{ add?: string[], remove?: string[] }` (listing slugs). The public site sends the
 * places saved on the device once after sign-in (merge, nothing is removed) and every heart
 * tap after that. Only slugs of listings in the content repository are stored. Responds with
 * the account's saved slugs, newest first.
 *
 * Called cross-origin with credentials, so the request must come from a public site origin
 * (or this app itself); a form post from anywhere else is refused.
 */

export const dynamic = 'force-dynamic';

const Body = z.object({
	add: z.array(z.string().min(1).max(200)).max(500).optional(),
	remove: z.array(z.string().min(1).max(200)).max(500).optional()
});

export function OPTIONS(request: NextRequest) {
	return new NextResponse(null, { status: 204, headers: publicSiteCors(request.headers.get('origin'), 'POST') });
}

export async function POST(request: NextRequest) {
	const origin = request.headers.get('origin');
	const headers = { 'Cache-Control': 'no-store', ...publicSiteCors(origin, 'POST') };
	if (origin && !isPublicSiteOrigin(origin) && origin !== new URL(request.url).origin) {
		return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers });
	}
	const session = await auth();
	const userId = session?.user?.id;
	if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers });

	let body: z.infer<typeof Body>;
	try {
		// Sent as text/plain from the public site (no preflight); JSON either way.
		body = Body.parse(JSON.parse(await request.text()));
	} catch {
		return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers });
	}

	const listings = new Map((await getListings()).map((l) => [l.slug, l]));
	const current = new Set(await getSavedSlugs(userId));
	// Oldest first, so the newest add ends up first (`created_at` order).
	for (const slug of [...(body.add ?? [])].reverse()) {
		const l = listings.get(slug);
		if (l && !current.has(slug)) {
			await addSaved(userId, l);
			current.add(slug);
		}
	}
	for (const slug of body.remove ?? []) {
		if (current.has(slug)) await removeSaved(userId, slug);
	}
	return NextResponse.json({ saved: await getSavedSlugs(userId) }, { headers });
}
