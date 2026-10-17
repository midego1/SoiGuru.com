import { NextRequest, NextResponse } from 'next/server';
import { fetchItem } from '@/lib/content';
import { listingPhotos } from '@/lib/services/google-places.service';
import { siteConfig } from '@/lib/config';

/**
 * GET /api/places/photos/{slug} — Google photos for one SoiGuru listing (spec 056), for the
 * public site's fallback when the listing has no photos of its own. Only listings in the
 * content repository are looked up, so the key cannot be used for arbitrary places.
 * Response: `{ photos: [{ url, width, height, author, authorUri }] }`; `url` is absolute.
 */

const SITES = (process.env.PUBLIC_SITE_ORIGINS || 'https://soiguru.com,https://www.soiguru.com')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

function cors(request: NextRequest): Record<string, string> {
	const origin = request.headers.get('origin') ?? '';
	return SITES.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
}

/**
 * The public origin for the photo links. Behind Dokploy's proxy `request.url` is the container
 * address (`https://0.0.0.0:3000`), so use the forwarded host when it is one of ours
 * (`PLACES_PHOTO_ORIGIN`, `NEXT_PUBLIC_APP_URL`, the site URL, or a subdomain of a public site
 * such as owner.soiguru.com), else the first of those.
 */
function publicOrigin(request: NextRequest): string {
	const known = [process.env.PLACES_PHOTO_ORIGIN, process.env.NEXT_PUBLIC_APP_URL, siteConfig.url]
		.map((u) => {
			try {
				return u ? new URL(u).origin : undefined;
			} catch {
				return undefined;
			}
		})
		.filter((o): o is string => !!o && !/\/\/(localhost|0\.0\.0\.0|127\.)/.test(o));
	const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
	const fromHeader = host ? `https://${host.split(',')[0].trim()}` : undefined;
	const domains = SITES.map((o) => new URL(o).hostname.replace(/^www\./, ''));
	const hostname = fromHeader ? new URL(fromHeader).hostname : '';
	if (fromHeader && (known.includes(fromHeader) || domains.some((d) => hostname.endsWith(`.${d}`)))) return fromHeader;
	return known[0] ?? new URL(request.url).origin;
}

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
		const geo = meta.geo as { lat?: number; lng?: number } | undefined;
		const loc = meta.location as { latitude?: number; longitude?: number } | undefined;
		const photos = await listingPhotos(slug, {
			name: meta.name,
			lat: geo?.lat ?? loc?.latitude,
			lng: geo?.lng ?? loc?.longitude,
			area: typeof meta.area === 'string' ? meta.area : undefined,
			city: typeof meta.city === 'string' ? meta.city : undefined
		});
		const base = publicOrigin(request);
		return NextResponse.json({ photos: photos.map((p) => ({ ...p, url: `${base}${p.url}` })) }, { headers });
	} catch (error) {
		console.error('[places/photos]', slug, error instanceof Error ? error.message : error);
		return NextResponse.json({ photos: [] }, { status: 502, headers });
	}
}
