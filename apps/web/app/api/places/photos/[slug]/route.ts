import { NextRequest, NextResponse } from 'next/server';
import { fetchItem } from '@/lib/content';
import { listingPlace, placesListing } from '@/lib/services/google-places.service';
import { placesCors as cors, publicOrigin } from '@/lib/soiguru/places-http';

/**
 * GET /api/places/photos/{slug} — Google photos for one SoiGuru listing (spec 056), for the
 * public site's fallback when the listing has no photos of its own. Only listings in the
 * content repository are looked up, so the key cannot be used for arbitrary places.
 * Response: `{ placeId, photos: [{ url, width, height, author, authorUri }] }`; `url` is absolute.
 * `placeId` may be stored with the listing (`google_place_id`), which Google's terms allow.
 */

export async function OPTIONS(request: NextRequest) {
	return new NextResponse(null, {
		status: 204,
		headers: { ...cors(request), 'Access-Control-Allow-Methods': 'GET' }
	});
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const headers = { ...cors(request), 'Cache-Control': 'public, max-age=300' };
	if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.json({ photos: [] }, { status: 400, headers });
	try {
		const item = (await fetchItem(slug)) as { meta?: Record<string, unknown> } | null;
		const meta = (item?.meta ?? item) as Record<string, unknown> | null;
		if (!meta || typeof meta.name !== 'string') return NextResponse.json({ photos: [] }, { status: 404, headers });
		const { placeId, photos } = await listingPlace(
			slug,
			placesListing(meta as Record<string, unknown> & { name: string })
		);
		const base = publicOrigin(request);
		return NextResponse.json(
			{ placeId, photos: photos.map((p) => ({ ...p, url: `${base}${p.url}` })) },
			{ headers }
		);
	} catch (error) {
		console.error('[places/photos]', slug, error instanceof Error ? error.message : error);
		return NextResponse.json({ photos: [] }, { status: 502, headers });
	}
}
