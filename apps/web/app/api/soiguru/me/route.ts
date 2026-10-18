import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserClaims, userIsAdmin } from '@/lib/soiguru/claims';
import { getSavedSlugs } from '@/lib/soiguru/saved';
import { publicSiteCors } from '@/lib/soiguru/public-site';

/**
 * GET /api/soiguru/me — who is signed in, for the account menu on the public site (spec 058).
 * Called from soiguru.com with `credentials: 'include'`; CORS only for the public site
 * origins. Response: `{ signedIn: false }` or `{ signedIn: true, name, image, initial,
 * isAdmin, isOwner, saved }` where `saved` is the account's saved listing slugs. No e-mail
 * address or ids leave this app. Never cached.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

export function OPTIONS(request: NextRequest) {
	return new NextResponse(null, { status: 204, headers: publicSiteCors(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
	const headers = { ...NO_STORE, ...publicSiteCors(request.headers.get('origin')) };
	const session = await auth();
	const user = session?.user;
	if (!user?.id) return NextResponse.json({ signedIn: false }, { headers });

	const [admin, claims, saved] = await Promise.all([
		user.isAdmin ? Promise.resolve(true) : userIsAdmin(user.id),
		getUserClaims(user.id).catch(() => []),
		getSavedSlugs(user.id).catch(() => [] as string[])
	]);
	const name = user.name?.trim() || null;
	const initial = (name || user.email || '?').trim().charAt(0).toUpperCase();
	return NextResponse.json(
		{
			signedIn: true,
			name,
			image: user.image ?? null,
			initial,
			isAdmin: admin,
			isOwner: claims.some((c) => c.status === 'approved'),
			hasClaims: claims.length > 0,
			saved
		},
		{ headers }
	);
}
