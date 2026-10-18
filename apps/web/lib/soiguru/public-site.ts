import 'server-only';

/**
 * The public SoiGuru site (soiguru.com, static on Cloudflare) talks to this app for the
 * account menu and saved places (spec 058). These helpers decide which origins may do that
 * and where "back to SoiGuru" links go. `PUBLIC_SITE_ORIGINS` is shared with the places
 * photo routes (spec 056).
 */
export const PUBLIC_SITES: string[] = (process.env.PUBLIC_SITE_ORIGINS || 'https://soiguru.com,https://www.soiguru.com')
	.split(',')
	.map((s) => s.trim().replace(/\/+$/, ''))
	.filter(Boolean);

/** The canonical public site, e.g. `https://soiguru.com`. */
export const PUBLIC_SITE = PUBLIC_SITES[0] ?? 'https://soiguru.com';

/** True when `origin` is one of the public sites. */
export function isPublicSiteOrigin(origin: string | null | undefined): origin is string {
	return !!origin && PUBLIC_SITES.includes(origin);
}

/**
 * A safe absolute URL on the public site, or the site root. Only `https?:` URLs whose
 * origin is a public site pass, so the return link cannot become an open redirect.
 */
export function safePublicUrl(raw: string | null | undefined): string {
	if (!raw) return `${PUBLIC_SITE}/`;
	try {
		const url = new URL(raw);
		if ((url.protocol === 'https:' || url.protocol === 'http:') && isPublicSiteOrigin(url.origin))
			return url.toString();
	} catch {
		// not a URL
	}
	return `${PUBLIC_SITE}/`;
}

/**
 * CORS headers for credentialed calls from the public site: the request's origin is echoed
 * only when it is a public site, with `Allow-Credentials` so the session cookie of this app
 * (same site, `SameSite=Lax`) is sent. Never `*`.
 */
export function publicSiteCors(origin: string | null, methods = 'GET'): Record<string, string> {
	const base: Record<string, string> = { Vary: 'Origin' };
	if (!isPublicSiteOrigin(origin)) return base;
	return {
		...base,
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': `${methods}, OPTIONS`,
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '600'
	};
}
