import { NextRequest, NextResponse } from 'next/server';
import { fetchItem } from '@/lib/content';
import { listingPlace, placesListing } from '@/lib/services/google-places.service';
import { placesCors, publicOrigin } from '@/lib/soiguru/places-http';

/**
 * GET /api/places/cards?slugs=a,b,c — the first Google photo for each listing card on the public
 * site (spec 059): the city home's "Open now" cards, nearby and similar places, results. The site
 * asks only for cards that scroll into view and have no photo of their own. Up to 12 slugs per
 * call, looked up in parallel; stored place IDs (`google_place_id`) skip the search. Response:
 * `{ photos: { [slug]: { url, width, height, author, authorUri } | null } }` with absolute URLs.
 * The daily Google budget (`PLACES_DAILY_LIMIT`) applies; over it, cards keep their drawings.
 */

const MAX_SLUGS = 12;

export async function OPTIONS(request: NextRequest) {
	return new NextResponse(null, {
		status: 204,
		headers: { ...placesCors(request), 'Access-Control-Allow-Methods': 'GET' }
	});
}

export async function GET(request: NextRequest) {
	const headers = { ...placesCors(request), 'Cache-Control': 'public, max-age=300' };
	const slugs = [...new Set((request.nextUrl.searchParams.get('slugs') ?? '').split(','))]
		.map((s) => s.trim())
		.filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
		.slice(0, MAX_SLUGS);
	if (slugs.length === 0) return NextResponse.json({ photos: {} }, { status: 400, headers });
	const base = publicOrigin(request);
	const entries = await Promise.all(
		slugs.map(async (slug) => {
			try {
				const item = (await fetchItem(slug)) as { meta?: Record<string, unknown> } | null;
				const meta = (item?.meta ?? item) as Record<string, unknown> | null;
				if (!meta || typeof meta.name !== 'string') return [slug, null] as const;
				const { photos } = await listingPlace(
					slug,
					placesListing(meta as Record<string, unknown> & { name: string }),
					1
				);
				const first = photos[0];
				return [slug, first ? { ...first, url: `${base}${first.url}` } : null] as const;
			} catch (error) {
				console.error('[places/cards]', slug, error instanceof Error ? error.message : error);
				return [slug, null] as const;
			}
		})
	);
	return NextResponse.json({ photos: Object.fromEntries(entries) }, { headers });
}
