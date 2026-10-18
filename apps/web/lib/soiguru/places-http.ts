import type { NextRequest } from 'next/server';
import { siteConfig } from '@/lib/config';

/**
 * Shared by the Google Places routes (`/api/places/photos/[slug]`, `/api/places/cards`;
 * spec 056 and 059): CORS for the public site and the public origin for photo links.
 */

const SITES = (process.env.PUBLIC_SITE_ORIGINS || 'https://soiguru.com,https://www.soiguru.com')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

export function placesCors(request: NextRequest): Record<string, string> {
	const origin = request.headers.get('origin') ?? '';
	return SITES.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
}

/**
 * The public origin for the photo links. Behind Dokploy's proxy `request.url` is the container
 * address (`https://0.0.0.0:3000`), so use the forwarded host when it is one of ours
 * (`PLACES_PHOTO_ORIGIN`, `NEXT_PUBLIC_APP_URL`, the site URL, or a subdomain of a public site
 * such as owner.soiguru.com), else the first of those.
 */
export function publicOrigin(request: NextRequest): string {
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
	if (fromHeader && (known.includes(fromHeader) || domains.some((d) => hostname.endsWith(`.${d}`))))
		return fromHeader;
	return known[0] ?? new URL(request.url).origin;
}
